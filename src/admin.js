// Personal gift links: the owner gives specific people Plus or Pro without a purchase (public/admin.html).
//   POST /api/admin/list    { key }                                  -> { gifts: [...] }
//   POST /api/admin/create  { key, name, tier, days, devices }       -> { code, url }
//   POST /api/admin/revoke  { key, code }                            gift stops working at once
//   POST /api/admin/reset   { key, code }                            forget its devices (new phone)
//   POST /api/admin/reports     { key }                              -> { reports: [...] } (problem reports from beta testers)
//   POST /api/admin/report-del  { key, id }
// "key" must equal the secret ADMIN_KEY. Gifts live in KV under gift:<code>; redeeming is /api/license/gift.

import { identify } from './license.js';

const sha = async (s) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))));

// POST /api/report { lic, dev, name, text, info }: problem report from a beta tester (others are refused).
// Kept 90 days in KV under report:<time>:<random>; read on admin.html.
export async function report(request, env, json) {
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const dev = typeof body.dev === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(body.dev) ? body.dev : 'x';
  if ((await identify(env, body.lic, dev, '')).tier !== 'beta') return json({ error: 'beta only' }, 403);
  const text = String(body.text || '').trim().slice(0, 2000);
  if (!text) return json({ error: 'empty' }, 400);
  const info = JSON.stringify(body.info ?? null).slice(0, 4000);
  const id = `report:${Date.now()}:${crypto.randomUUID().slice(0, 6)}`;
  await env.WALKIE.put(id, JSON.stringify({ t: Date.now(), name: String(body.name || '').slice(0, 40), text, info }), { expirationTtl: 90 * 86400 });
  return json({ ok: true });
}

export async function admin(request, env, route, json) {
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  if (!env.ADMIN_KEY) return json({ error: 'ADMIN_KEY not configured' }, 503);
  const body = await request.json().catch(() => ({}));
  if (typeof body.key !== 'string' || (await sha(body.key)) !== (await sha(env.ADMIN_KEY))) return json({ error: 'wrong key' }, 401);

  if (route === 'list') {
    const gifts = [];
    let cursor;
    do {
      const page = await env.WALKIE.list({ prefix: 'gift:', cursor });
      for (const k of page.keys) {
        const g = await env.WALKIE.get(k.name, 'json');
        if (g) gifts.push({ code: k.name.slice(5), name: g.name, tier: g.tier, until: g.until, devices: g.devices, used: g.web.length, revoked: g.revoked, created: g.created });
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return json({ gifts: gifts.sort((a, b) => b.created - a.created) });
  }

  if (route === 'create') {
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name || !['plus', 'pro'].includes(body.tier)) return json({ error: 'bad request' }, 400);
    const days = Math.max(0, Math.min(3650, Number(body.days) || 0)), devices = Math.max(1, Math.min(5, Number(body.devices) || 1));
    const code = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(15)))).replace(/\+/g, '-').replace(/\//g, '_');
    const gift = { name, tier: body.tier, until: days ? Date.now() + days * 864e5 : 0, devices, web: [], revoked: false, created: Date.now() };
    await env.WALKIE.put(`gift:${code}`, JSON.stringify(gift));
    return json({ code, url: `https://wlky.app/#gift=${code}` });
  }

  if (route === 'reports') {
    const reports = [];
    let cursor;
    do {
      const page = await env.WALKIE.list({ prefix: 'report:', cursor });
      for (const k of page.keys) { const r = await env.WALKIE.get(k.name, 'json'); if (r) reports.push({ id: k.name, ...r }); }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return json({ reports: reports.sort((a, b) => b.t - a.t) });
  }

  if (route === 'report-del') {
    if (typeof body.id !== 'string' || !body.id.startsWith('report:')) return json({ error: 'bad request' }, 400);
    await env.WALKIE.delete(body.id);
    return json({ ok: true });
  }

  if (route === 'revoke' || route === 'reset') {
    const g = typeof body.code === 'string' && (await env.WALKIE.get(`gift:${body.code}`, 'json'));
    if (!g) return json({ error: 'not found' }, 404);
    if (route === 'revoke') g.revoked = true; else g.web = [];
    await env.WALKIE.put(`gift:${body.code}`, JSON.stringify(g));
    return json({ ok: true });
  }

  return json({ error: 'not found' }, 404);
}
