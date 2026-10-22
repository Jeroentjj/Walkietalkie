import { DurableObject } from 'cloudflare:workers';

// Cloudflare Worker: serves the static app from public/, relays channel audio and a Web Push "ring" API.
//   WS   /api/ch/<room>   join a channel (Durable Object "Channel"); audio is E2E-encrypted by the clients
// Needs one KV namespace bound as WALKIE. VAPID keys are generated on first use and kept in KV.
//   GET  /api/vapid      -> { key }            public key for pushManager.subscribe
//   POST /api/subscribe  { ch, id, sub }       remember this device's push subscription for a channel
//   POST /api/ring       { ch, id }            push a notification to the other device(s) in the channel
// Pushes carry no payload, so no message encryption is needed; the service worker shows a fixed text.

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const valid = (s) => typeof s === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(s);

async function vapidKeys(env) {
  const saved = await env.WALKIE.get('vapid', 'json');
  if (saved) return saved;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const keys = { jwk, pub };
  await env.WALKIE.put('vapid', JSON.stringify(keys));
  return keys;
}

async function vapidHeader(endpoint, keys) {
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:walkie@dopimo.app',
  })}`;
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.pub}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const room = url.pathname.match(/^\/api\/ch\/([a-f0-9]{40})$/)?.[1];
    if (room) {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket expected' }, 426);
      return env.CHANNEL.get(env.CHANNEL.idFromName(room)).fetch(request);
    }
    return api(request, env, url.pathname.slice(5));
  },
};

async function api(request, env, route) {
  if (!env.WALKIE) return json({ error: 'KV binding WALKIE missing' }, 500);

  if (route === 'vapid' && request.method === 'GET') return json({ key: (await vapidKeys(env)).pub });
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);

  const body = await request.json().catch(() => ({}));
  if (!valid(body.ch) || !valid(body.id)) return json({ error: 'bad request' }, 400);
  const kvKey = `ch:${body.ch}`;
  const subs = (await env.WALKIE.get(kvKey, 'json')) || {};

  if (route === 'subscribe') {
    if (!body.sub?.endpoint?.startsWith('https://')) return json({ error: 'bad subscription' }, 400);
    subs[body.id] = { endpoint: body.sub.endpoint, t: Date.now() };
    const trimmed = Object.fromEntries(Object.entries(subs).sort((a, b) => b[1].t - a[1].t).slice(0, 30));
    await env.WALKIE.put(kvKey, JSON.stringify(trimmed), { expirationTtl: 60 * 60 * 24 * 90 });
    return json({ ok: true });
  }

  if (route === 'ring') {
    const keys = await vapidKeys(env);
    let sent = 0, changed = false;
    for (const [id, s] of Object.entries(subs)) {
      if (id === body.id) continue;
      const res = await fetch(s.endpoint, {
        method: 'POST',
        headers: { Authorization: await vapidHeader(s.endpoint, keys), TTL: '60', Urgency: 'high' },
      });
      if (res.status === 404 || res.status === 410) { delete subs[id]; changed = true; } else if (res.ok) sent++;
    }
    if (changed) await env.WALKIE.put(kvKey, JSON.stringify(subs));
    return json({ sent });
  }

  return json({ error: 'not found' }, 404);
}

const MAX_TURN_MS = 60000;

// One instance per channel. Holds who may talk (speaker) and who is waiting (queue), and relays
// encrypted audio frames from the speaker to everyone else. It never has the key to decrypt them.
export class Channel extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.speaker = null;
    this.since = 0;
    this.queue = [];
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const name = (new URL(request.url).searchParams.get('name') || 'Iemand').slice(0, 24);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), name });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  sockets(skip) { return this.ctx.getWebSockets().filter((w) => w !== skip && w.readyState === WebSocket.OPEN); }
  info(ws) { return ws.deserializeAttachment() || {}; }
  find(id) { return this.sockets().find((w) => this.info(w).id === id); }

  broadcast(skip) {
    const all = this.sockets(skip);
    const sp = this.speaker && this.find(this.speaker);
    for (const w of all) {
      const me = this.info(w).id;
      const you = this.speaker === me ? 'tx' : this.queue.indexOf(me) + 1;
      try { w.send(JSON.stringify({ t: 'state', n: all.length, speaker: sp && this.speaker !== me ? this.info(sp).name : null, you })); } catch {}
    }
  }

  nextTurn(skip) {
    this.queue = this.queue.filter((id) => this.find(id));
    this.speaker = this.queue.shift() || null;
    this.since = Date.now();
    this.broadcast(skip);
  }

  leave(id, skip) {
    this.queue = this.queue.filter((x) => x !== id);
    if (this.speaker === id) this.nextTurn(skip); else this.broadcast(skip);
  }

  async webSocketMessage(ws, msg) {
    const me = this.info(ws).id;
    if (typeof msg !== 'string') {
      if (this.speaker !== me) return;
      if (Date.now() - this.since > MAX_TURN_MS) return this.leave(me); // nobody hogs the channel
      for (const w of this.sockets(ws)) try { w.send(msg); } catch {}
      return;
    }
    let m; try { m = JSON.parse(msg); } catch { return; }
    if (m.t === 'req') {
      if (this.speaker && (!this.find(this.speaker) || Date.now() - this.since > MAX_TURN_MS)) this.speaker = null;
      if (!this.speaker) { this.speaker = me; this.since = Date.now(); }
      else if (this.speaker !== me && !this.queue.includes(me)) this.queue.push(me);
      this.broadcast();
    } else if (m.t === 'rel') this.leave(me);
  }

  webSocketClose(ws) { this.leave(this.info(ws).id, ws); }
  webSocketError(ws) { this.leave(this.info(ws).id, ws); }
}
