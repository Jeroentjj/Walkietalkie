// Minimal offline shell so Android offers "Install app".
const CACHE = 'walkie-v8';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg', 'fonts/DSEG7Classic-Bold.woff2', 'fonts/DSEG14Classic-Bold.woff2', 'fonts/nunito-latin-700-normal.woff2', 'vendor/qrcode.js'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
);
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Ring from the partner (payload-less push, see functions/api).
self.addEventListener('push', (e) =>
  e.waitUntil(self.registration.showNotification('📻 Walkie', {
    body: 'Je wordt opgeroepen op je walkie!',
    icon: 'icon.svg',
    tag: 'walkie-ring',
    renotify: true,
    vibrate: [200, 100, 200],
  }))
);
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) =>
    ws.length ? ws[0].focus() : clients.openWindow('./')));
});
