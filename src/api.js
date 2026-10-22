// Cloudflare Worker: serves the static app from public/ and a Web Push "ring" API.
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
    // Two people per channel; keep the most recent few devices.
    const trimmed = Object.fromEntries(Object.entries(subs).sort((a, b) => b[1].t - a[1].t).slice(0, 4));
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
