// Buzz service worker: offline copy of the site, and the handlers that show a notification and open the story when tapped.
// Strategy: network first, fall back to the saved copy when offline.
// Network-first means a new version of the site is picked up straight away, so people are never stuck on an old one.
// Only same-site GET requests are saved. Nothing private exists in Stage 1.

const CACHE = 'buzz-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'scenes.js', 'motifs.js', 'charts.js', 'ask.js', 'profile.js', 'search.js', 'speech.js', 'notify.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch other sites

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
      )
  );
});

// ---------- Notifications ----------
// A push message is JSON: { title, body, url, tag }. Everything is clipped and treated as plain text.
// Every push MUST show a notification (iPhone cancels push for sites that do not), so we always show something.

function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function safeTarget(raw) {
  try {
    const u = new URL(String(raw || './'), self.registration.scope);
    if (u.origin !== self.location.origin) return self.registration.scope;
    return u.toString();
  } catch (e) {
    return self.registration.scope;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = clip(data.title, 80) || 'Buzz';
  const options = {
    body: clip(data.body, 200) || 'Your headlines are ready.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: clip(data.tag, 40) || 'buzz',
    data: { url: safeTarget(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        try {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        } catch (e) { /* try the next window, or open a new one */ }
      }
      return self.clients.openWindow(url);
    })
  );
});
