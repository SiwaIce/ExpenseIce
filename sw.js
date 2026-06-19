const CACHE = 'expense-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/pinlock.js',
  './js/storage.js',
  './js/helpers.js',
  './js/pos.js',
  './js/views.js',
  './js/accounts.js',
  './js/savings.js',
  './js/subscriptions.js',
  './js/loans.js',
  './js/chatbot.js',
  './js/features.js',
  './js/firebase-sync.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // Skip Firebase/API calls — never cache
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebasestorage.googleapis.com') ||
      url.includes('identitytoolkit.google') ||
      url.includes('googleapis.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('gstatic.com')) {
    return;
  }

  // Network-first for HTML and JS so updates deploy immediately
  const isCodeFile = /\.(js|html)(\?|$)/.test(url) || url.endsWith('/') || url === location.origin + '/';
  if (isCodeFile) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for icons and other static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
