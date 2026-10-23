// Paid versions (Plus / Pro) bought in the Android app, also usable in the web app on linked devices.
//   POST /api/license/claim   { product, token, dev }  app: verify a Google Play purchase -> { lic, tier }
//   POST /api/license/check   { lic }                  any device: is this licence still valid? -> { tier }
//   POST /api/license/link    { lic }                  app: one-time code (10 min) to link a web device -> { code, url }
//   POST /api/license/redeem  { code, dev }            web: use a link code -> { lic, tier }
//   POST /api/license/nonce   {}                       app: one-time nonce for a Play Integrity request
//   POST /api/license/attest  { token, nonce, dev }    app: Play Integrity proof -> 7-day Basic licence
// identify() turns a licence into the version the server enforces (see tiers.js); no valid licence = web.
// A licence is "<payload>.<HMAC>" signed with a key that is generated once and kept in KV, so nobody can forge one.
// Records live in KV under lic:<sha256(purchase token)>; the raw purchase token is never stored.
// Purchases and Play Integrity tokens are verified with Google using the service-account JSON in the secret GOOGLE_SA.

const PACKAGE = 'app.wlky';
export const PRODUCTS = { wlky_plus: 'plus', wlky_pro: 'pro' };
const WEB_DEVICES = { plus: 1, pro: 3 }; // linked web devices per purchase
const LINK_TTL = 600;

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const sha = async (s) => b64u(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 32);
const okId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(s);

async function hmacKey(env) {
  let raw = await env.WALKIE.get('licsecret');
  if (!raw) { raw = b64u(crypto.getRandomValues(new Uint8Array(32))); await env.WALKIE.put('licsecret', raw); }
  return crypto.subtle.importKey('raw', unb64u(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64u(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body)))}`;
}

async function open(env, lic) {
  if (typeof lic !== 'string' || lic.length > 600) return null;
  const [body, sig] = lic.split('.');
  if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(env), unb64u(sig), enc.encode(body)))) return null;
    return JSON.parse(new TextDecoder().decode(unb64u(body)));
  } catch { return null; }
}

// --- Google Play Developer API (service account -> OAuth token -> purchases.products)
const tokenCache = {};
async function googleToken(env, scope) {
  const cached = tokenCache[scope];
  if (cached && cached.exp > Date.now() + 60e3) return cached.token;
  const sa = JSON.parse(env.GOOGLE_SA);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64u(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: `https://www.googleapis.com/auth/${scope}`,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const jwt = `${head}.${claim}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claim}`)))}`;
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error('google auth ' + res.status);
  const t = await res.json();
  tokenCache[scope] = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

async function verifyPurchase(env, product, token) {
  const base = env.GOOGLE_API_BASE || 'https://androidpublisher.googleapis.com'; // overridable for local tests only
  const url = `${base}/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${product}/tokens/${encodeURIComponent(token)}`;
  const auth = { authorization: `Bearer ${await googleToken(env, 'androidpublisher')}` };
  const res = await fetch(url, { headers: auth });
  if (!res.ok) return false;
  const p = await res.json();
  if (p.purchaseState !== 0) return false; // 0 = purchased (not pending, not cancelled/refunded)
  // Google refunds purchases that are not acknowledged within 3 days.
  if (p.acknowledgementState === 0) await fetch(`${url}:acknowledge`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}' });
  return true;
}

// Play Integrity: is this request really from WLKY installed via Google Play (not the web, not a modified app)?
async function verifyIntegrity(env, token, nonce) {
  const base = env.GOOGLE_INTEGRITY_BASE || 'https://playintegrity.googleapis.com'; // overridable for local tests only
  const res = await fetch(`${base}/v1/${PACKAGE}:decodeIntegrityToken`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await googleToken(env, 'playintegrity')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ integrity_token: token }),
  });
  if (!res.ok) return false;
  const p = (await res.json()).tokenPayloadExternal || {};
  return p.requestDetails?.nonce === nonce && p.requestDetails?.requestPackageName === PACKAGE
    && p.appIntegrity?.packageName === PACKAGE && p.appIntegrity?.appRecognitionVerdict === 'PLAY_RECOGNIZED';
}

// The version for a connection. Shared licences give nothing extra: the quota belongs to the licence + device.
export async function identify(env, licence, dev, ip) {
  const p = await open(env, licence);
  if (p?.b && p.d === dev && p.x > Date.now()) return { tier: 'basic', subject: `B:${dev}` };
  if (p?.r && p.d === dev) {
    const rec = await env.WALKIE.get(`lic:${p.r}`, 'json');
    if (rec && (!p.w || rec.web.some((d) => d.id === dev))) return { tier: rec.tier, subject: `L:${p.r}:${dev}` };
  }
  return { tier: 'web', subject: `W:${ip}` };
}

export async function license(request, env, route, json) {
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  const body = await request.json().catch(() => ({}));

  if (route === 'claim') {
    const tier = PRODUCTS[body.product];
    if (!tier || typeof body.token !== 'string' || body.token.length > 1000 || !okId(body.dev)) return json({ error: 'bad request' }, 400);
    if (!env.GOOGLE_SA) return json({ error: 'verification not configured' }, 503);
    const id = await sha(body.token);
    let rec = await env.WALKIE.get(`lic:${id}`, 'json');
    if (!rec) {
      if (!(await verifyPurchase(env, body.product, body.token).catch(() => false))) return json({ error: 'purchase not valid' }, 402);
      rec = { tier, web: [], t: Date.now() };
      await env.WALKIE.put(`lic:${id}`, JSON.stringify(rec));
    }
    return json({ lic: await sign(env, { r: id, d: body.dev, w: 0 }), tier: rec.tier });
  }

  if (route === 'nonce') {
    const nonce = b64u(crypto.getRandomValues(new Uint8Array(24)));
    await env.WALKIE.put(`nonce:${nonce}`, '1', { expirationTtl: 300 });
    return json({ nonce });
  }

  if (route === 'attest') {
    if (typeof body.token !== 'string' || body.token.length > 10000 || typeof body.nonce !== 'string' || !okId(body.dev)) return json({ error: 'bad request' }, 400);
    if (!env.GOOGLE_SA) return json({ error: 'verification not configured' }, 503);
    if (!(await env.WALKIE.get(`nonce:${body.nonce}`))) return json({ error: 'nonce expired' }, 410);
    await env.WALKIE.delete(`nonce:${body.nonce}`); // single use
    if (!(await verifyIntegrity(env, body.token, body.nonce).catch(() => false))) return json({ error: 'not the Play app' }, 403);
    const x = Date.now() + 7 * 864e5;
    return json({ lic: await sign(env, { b: 1, d: body.dev, x }), tier: 'basic', x });
  }

  if (route === 'check') {
    const p = await open(env, body.lic);
    if (p?.b) return json({ tier: p.x > Date.now() ? 'basic' : null });
    const rec = p?.r && (await env.WALKIE.get(`lic:${p.r}`, 'json'));
    if (!rec || (p.w && !rec.web.some((d) => d.id === p.d))) return json({ tier: null });
    return json({ tier: rec.tier });
  }

  if (route === 'link') {
    const p = await open(env, body.lic);
    const rec = p?.r && !p.w && (await env.WALKIE.get(`lic:${p.r}`, 'json'));
    if (!rec) return json({ error: 'no licence' }, 403);
    const code = b64u(crypto.getRandomValues(new Uint8Array(12)));
    await env.WALKIE.put(`link:${code}`, p.r, { expirationTtl: LINK_TTL });
    return json({ code, url: `https://wlky.app/#link=${code}`, ttl: LINK_TTL });
  }

  if (route === 'redeem') {
    if (typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{16}$/.test(body.code) || !okId(body.dev)) return json({ error: 'bad request' }, 400);
    const r = await env.WALKIE.get(`link:${body.code}`);
    const rec = r && (await env.WALKIE.get(`lic:${r}`, 'json'));
    if (!rec) return json({ error: 'code expired' }, 410);
    await env.WALKIE.delete(`link:${body.code}`); // single use
    // Keep the most recent devices; the oldest linked device loses access when the limit is passed.
    rec.web = [{ id: body.dev, t: Date.now() }, ...rec.web.filter((d) => d.id !== body.dev)].slice(0, WEB_DEVICES[rec.tier] || 0);
    await env.WALKIE.put(`lic:${r}`, JSON.stringify(rec));
    return json({ lic: await sign(env, { r, d: body.dev, w: 1 }), tier: rec.tier });
  }

  return json({ error: 'not found' }, 404);
}
