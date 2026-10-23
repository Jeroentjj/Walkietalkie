import { DurableObject } from 'cloudflare:workers';
import { TIERS, WEB_PER_IP } from './tiers.js';

// One instance per "subject": a licensed device (L:<purchase>:<device>, B:<device>) or, for the free
// web version, an IP address (W:<ip>) with the devices behind it. Called only by Channel objects:
//   /join  { room, dev, tier, subject }   may this device open one more channel?
//   /leave { room, dev }                  a channel connection closed
//   /talk  { dev, tier }                  count one audio message (push-to-talk) for today
//   /chat  { dev, tier }                  count one chat message for today
// Counters reset at 00:00 UTC. State is stored, so it survives restarts.
export class Quota extends DurableObject {
  async fetch(request) {
    const path = new URL(request.url).pathname, q = await request.json();
    const s = (await this.ctx.storage.get('s')) || { day: '', devs: {} };
    const day = new Date().toISOString().slice(0, 10);
    if (s.day !== day) { s.day = day; for (const d of Object.values(s.devs)) { d.talks = 0; d.chats = 0; } }
    const dev = (s.devs[q.dev] ||= { rooms: {}, talks: 0, chats: 0 });
    const L = TIERS[q.tier] || TIERS.web, web = q.tier === 'web';
    const total = (f) => Object.values(s.devs).reduce((n, d) => n + f(d), 0);
    const rooms = (d) => Object.keys(d.rooms).length;
    let ok = true;

    if (path === '/join' && !dev.rooms[q.room]) {
      const over = () => rooms(dev) >= L.channels || (web && total(rooms) >= L.channels * WEB_PER_IP);
      if (over()) await this.prune(s, q.subject); // maybe some "open" channels were never closed properly
      ok = !over();
    }
    if (path === '/join' && ok) dev.rooms[q.room] = (dev.rooms[q.room] || 0) + 1;
    if (path === '/leave') { if (dev.rooms[q.room] > 1) dev.rooms[q.room]--; else delete dev.rooms[q.room]; }
    if (path === '/talk') {
      ok = dev.talks < L.talksPerDay && (!web || total((d) => d.talks) < L.talksPerDay * WEB_PER_IP);
      if (ok) dev.talks++;
    }
    if (path === '/chat') {
      ok = dev.chats < L.chatPerDay && (!web || total((d) => d.chats) < L.chatPerDay * WEB_PER_IP);
      if (ok) dev.chats++;
    }

    for (const [id, d] of Object.entries(s.devs)) if (id !== q.dev && !rooms(d) && !d.talks && !d.chats) delete s.devs[id];
    await this.ctx.storage.put('s', s);
    return Response.json({ ok });
  }

  // Ask each channel how many connections this subject really has there (a deploy or crash can drop
  // connections without a close event). Only runs when a limit would be hit, so it costs nothing normally.
  async prune(s, subject) {
    for (const [id, d] of Object.entries(s.devs)) {
      for (const room of Object.keys(d.rooms)) {
        const res = await this.env.CHANNEL.get(this.env.CHANNEL.idFromName(room))
          .fetch(`https://channel/alive?s=${encodeURIComponent(subject)}&d=${encodeURIComponent(id)}`);
        const { n } = await res.json();
        if (n) d.rooms[room] = n; else delete d.rooms[room];
      }
    }
  }
}
