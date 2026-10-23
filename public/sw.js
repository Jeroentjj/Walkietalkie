// Minimal offline shell so Android offers "Install app".
const CACHE = 'walkie-v10';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg', 'badge.png', 'fonts/DSEG7Classic-Bold.woff2', 'fonts/DSEG14Classic-Bold.woff2', 'fonts/nunito-latin-700-normal.woff2', 'fonts/share-tech-mono-latin-400-normal.woff2', 'vendor/qrcode.js'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
);
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Ring from a channel member (payload-less push, see src/api.js).
// App open on screen: ring inside the page. Otherwise a long, repeating notification.
self.addEventListener('push', (e) =>
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const seen = ws.filter((w) => w.visibilityState === 'visible');
    if (seen.length) return seen.forEach((w) => w.postMessage({ t: 'ring' }));
    return self.registration.showNotification('WLKY', {
      body: 'Je wordt opgeroepen op je walkie!',
      icon: 'icon.svg',
      badge: 'badge.png', // small white walkie-talkie in the status bar (Android wants a PNG)
      tag: 'walkie-ring',
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 150, 400, 150, 400, 150, 400, 150, 400],
    });
  }))
);
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) =>
    ws.length ? ws[0].focus() : clients.openWindow('./')));
});
