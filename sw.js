// يخلي التطبيق يفتح من غير نت. غيّر الرقم ده مع كل نسخة جديدة.
var V = 'site-sheet-v30';
var FILES = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // من الشبكة الأول (علشان التحديثات) ولو مفيش نت من الكاش
  e.respondWith(fetch(e.request).then(function (r) {
    var cp = r.clone(); caches.open(V).then(function (c) { c.put(e.request, cp); }); return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
});
