import { DurableObject } from 'cloudflare:workers';
import { license, identify } from './license.js';
import { admin, report } from './admin.js';
import { TIERS } from './tiers.js';
export { Quota } from './quota.js';

// Cloudflare Worker: serves the static app from public/, relays channel audio and a Web Push "ring" API.
//   WS   /api/ch/<room>?name&dev&lic   join a channel (Durable Object "Channel"); audio is E2E-encrypted by the clients.
//        The version (web/basic/plus/pro) comes from the licence and is enforced here, not in the page.
// Needs one KV namespace bound as WALKIE. VAPID keys are generated on first use and kept in KV.
//   GET  /api/vapid      -> { key }            public key for pushManager.subscribe
//   POST /api/subscribe  { ch, id, sub }       remember this device's push subscription for a channel
//   POST /api/ring       { ch, id }            push a notification to the other device(s) in the channel
//   POST /api/license/*                        paid versions, see license.js
//   POST /api/admin/*                          gift links for specific people, see admin.js (secret ADMIN_KEY)
//   POST /api/report                           problem report from a beta tester, see admin.js
// Pushes carry no payload, so no message encryption is needed; the service worker shows a fixed text.

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); // the Android app calls from its own origin
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
    sub: 'mailto:privacy@wlky.app',
  })}`;
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.pub}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // One stable link for every "get the app" button; change the target here.
    if (url.pathname === '/app') return Response.redirect(PLAY_URL, 302);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const room = url.pathname.match(/^\/api\/ch\/([a-f0-9]{40})$/)?.[1];
    if (room) {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket expected' }, 426);
      const dev = valid(url.searchParams.get('dev')) ? url.searchParams.get('dev') : 'x';
      const who = await identify(env, url.searchParams.get('lic'), dev, request.headers.get('cf-connecting-ip') || 'x');
      // Only the Worker sets these; anything a client sends under the same names is replaced.
      const headers = new Headers(request.headers);
      for (const k of [...headers.keys()]) if (k.startsWith('x-wlky-')) headers.delete(k);
      headers.set('x-wlky-tier', who.tier); headers.set('x-wlky-subject', who.subject);
      headers.set('x-wlky-dev', dev); headers.set('x-wlky-room', room);
      return env.CHANNEL.get(env.CHANNEL.idFromName(room)).fetch(new Request(request, { headers }));
    }
    return api(request, env, url.pathname.slice(5));
  },
};

// Per-IP limit on the push API (Workers Rate Limiting binding; skipped when not configured).
async function limited(env, request) {
  if (!env.LIMITER) return false;
  const { success } = await env.LIMITER.limit({ key: request.headers.get('cf-connecting-ip') || 'x' });
  return !success;
}

async function api(request, env, route) {
  if (!env.WALKIE) return json({ error: 'KV binding WALKIE missing' }, 500);
  if (route !== 'vapid' && (await limited(env, request))) return json({ error: 'too many requests' }, 429);

  if (route === 'vapid' && request.method === 'GET') return json({ key: (await vapidKeys(env)).pub });
  if (route.startsWith('license/')) return license(request, env, route.slice(8), json);
  if (route.startsWith('admin/')) return admin(request, env, route.slice(6), json);
  if (route === 'report') return report(request, env, json);
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);

  const body = await request.json().catch(() => ({}));
  if (!valid(body.ch) || !valid(body.id)) return json({ error: 'bad request' }, 400);
  const kvKey = `ch:${body.ch}`;
  const subs = (await env.WALKIE.get(kvKey, 'json')) || {};

  if (route === 'subscribe') {
    if (!body.sub?.endpoint?.startsWith('https://') || body.sub.endpoint.length > 1000) return json({ error: 'bad subscription' }, 400);
    // Skip the KV write (daily quota) when nothing changed recently.
    const old = subs[body.id];
    if (old?.endpoint === body.sub.endpoint && Date.now() - old.t < 7 * 864e5) return json({ ok: true });
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

const PLAY_URL = 'https://play.google.com/store/apps/details?id=app.wlky';
const MAX_PEOPLE = 10;
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

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
    const url = new URL(request.url);
    // Internal (from Quota): how many connections does this subject+device have here?
    if (url.pathname === '/alive') {
      const n = this.sockets().filter((w) => { const a = this.info(w); return a.subject === url.searchParams.get('s') && a.dev === url.searchParams.get('d'); }).length;
      return Response.json({ n });
    }
    const h = request.headers, who = { tier: h.get('x-wlky-tier') || 'web', subject: h.get('x-wlky-subject') || 'W:x', dev: h.get('x-wlky-dev') || 'x', room: h.get('x-wlky-room') };
    // The name is encrypted by the clients; we only pass it along.
    const raw = url.searchParams.get('name') || '';
    const name = /^[A-Za-z0-9_-]{1,200}$/.test(raw) ? raw : 'x';
    // The founder proves it with a secret only their phone has; the first one to show it owns the channel.
    const own = url.searchParams.get('own') || '';
    let owner = false;
    if (/^[A-Za-z0-9_-]{16,64}$/.test(own)) {
      const h = await sha(own), saved = await this.ctx.storage.get('owner');
      if (!saved) await this.ctx.storage.put('owner', h);
      owner = !saved || saved === h;
    }
    const [client, server] = Object.values(new WebSocketPair());
    if (!owner && who.dev !== 'x' && ((await this.ctx.storage.get('banned')) || []).includes(who.dev)) {
      server.accept();
      server.send(JSON.stringify({ t: 'kicked' }));
      server.close(4002, 'kicked');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (this.sockets().length >= MAX_PEOPLE) {
      server.accept();
      server.send(JSON.stringify({ t: 'full' }));
      server.close(4000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    if (!(await this.quota(who, '/join')).ok) {
      server.accept();
      server.send(JSON.stringify({ t: 'limit', what: 'channels', tier: who.tier }));
      server.close(4001, 'limit');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), name, owner, ...who });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  quota(who, path) {
    return this.env.QUOTA.get(this.env.QUOTA.idFromName(who.subject))
      .fetch(`https://quota${path}`, { method: 'POST', body: JSON.stringify(who) }).then((r) => r.json());
  }

  turnMs(id) { const w = this.find(id); return (TIERS[w ? this.info(w).tier : 'web'] || TIERS.web).turnSec * 1000; }

  sockets(skip) { return this.ctx.getWebSockets().filter((w) => w !== skip && w.readyState === WebSocket.OPEN); }
  info(ws) { return ws.deserializeAttachment() || {}; }
  find(id) { return this.sockets().find((w) => this.info(w).id === id); }

  broadcast(skip) {
    const all = this.sockets(skip);
    const sp = this.speaker && this.find(this.speaker);
    const members = all.map((w) => { const a = this.info(w); return { id: a.id, name: a.name, o: a.owner ? 1 : 0 }; });
    for (const w of all) {
      const a = this.info(w), me = a.id;
      const you = this.speaker === me ? 'tx' : this.queue.indexOf(me) + 1;
      try { w.send(JSON.stringify({ t: 'state', n: all.length, speaker: sp && this.speaker !== me ? this.info(sp).name : null, sid: sp && this.speaker !== me ? this.speaker : null, you, me, own: a.owner ? 1 : 0, members })); } catch {}
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

  // Token bucket per connection: plenty for ~25 audio frames/s, stops floods. Kept in memory only.
  allow(id, binary) {
    const now = Date.now(), b = (this.buckets ||= new Map()).get(id) || { tokens: 60, t: now };
    b.tokens = Math.min(60, b.tokens + ((now - b.t) / 1000) * 40); b.t = now;
    const cost = binary ? 1 : 4;
    if (b.tokens < cost) return false;
    b.tokens -= cost; this.buckets.set(id, b);
    return true;
  }

  async webSocketMessage(ws, msg) {
    const who = this.info(ws), me = who.id, L = TIERS[who.tier] || TIERS.web;
    if (!this.allow(me, typeof msg !== 'string')) return;
    if ((typeof msg === 'string' ? msg.length : msg.byteLength) > 16384) return;
    if (typeof msg !== 'string') {
      if (this.speaker !== me) return;
      if (Date.now() - this.since > this.turnMs(me)) return this.leave(me); // turn over (20 s web, 60 s app)
      for (const w of this.sockets(ws)) try { w.send(msg); } catch {}
      return;
    }
    let m; try { m = JSON.parse(msg); } catch { return; }
    if (m.t === 'req') {
      (this.want ||= new Map()).set(me, true);
      const waiting = this.speaker === me || this.queue.includes(me);
      if (!waiting && L.talksPerDay !== Infinity && !(await this.quota(who, '/talk')).ok) return ws.send(JSON.stringify({ t: 'limit', what: 'talk' }));
      if (!this.want.get(me) || !this.find(me)) return; // released or gone while we asked the quota
      if (this.speaker && (!this.find(this.speaker) || Date.now() - this.since > this.turnMs(this.speaker))) this.speaker = null;
      if (!this.speaker) { this.speaker = me; this.since = Date.now(); }
      else if (this.speaker !== me && !this.queue.includes(me)) this.queue.push(me);
      this.broadcast();
    } else if (m.t === 'rel') { this.want?.set(me, false); this.leave(me); }
    else if (m.t === 'kick' && who.owner && typeof m.id === 'string' && m.id !== me) {
      const target = this.find(m.id);
      if (!target) return;
      // Remembered by device code, so the same phone cannot walk back in with the old link.
      const dev = this.info(target).dev, banned = (await this.ctx.storage.get('banned')) || [];
      if (dev !== 'x' && !banned.includes(dev)) await this.ctx.storage.put('banned', [...banned, dev].slice(-50));
      try { target.send(JSON.stringify({ t: 'kicked' })); } catch {}
      try { target.close(4002, 'kicked'); } catch {}
    } else if (m.t === 'ring') {
      // A call to everyone online in this channel; at most once per 10 s per person.
      const now = Date.now(), last = (this.rang ||= new Map()).get(me) || 0;
      if (now - last < 10000) return;
      this.rang.set(me, now);
      for (const w of this.sockets(ws)) try { w.send(JSON.stringify({ t: 'ring', from: who.name })); } catch {}
    }
    else if (m.t === 'chat' && typeof m.d === 'string' && m.d.length < 4000) {
      if (L.chatPerDay !== Infinity && !(await this.quota(who, '/chat')).ok) return ws.send(JSON.stringify({ t: 'limit', what: 'chat' }));
      // Encrypted chat text; relayed, never stored.
      for (const w of this.sockets(ws)) try { w.send(JSON.stringify({ t: 'chat', d: m.d })); } catch {}
    }
  }

  closed(ws) {
    const who = this.info(ws);
    this.want?.delete(who.id);
    this.leave(who.id, ws);
    if (who.subject) return this.quota(who, '/leave').catch(() => {});
  }

  // Answer the close ourselves, or the client's socket stays half-closed and never reconnects.
  webSocketClose(ws, code) { try { ws.close(code >= 1000 && code < 1005 ? code : 1000); } catch {} return this.closed(ws); }
  webSocketError(ws) { return this.closed(ws); }
}
