// يخلي التطبيق يفتح من غير نت. غيّر الرقم ده مع كل نسخة جديدة.
var V = 'site-sheet-v83';
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
// ===== إرسال في الخلفية: أول ما النت يرجع، الموبايل بيصحّي ده حتى لو التطبيق مقفول =====
function idb() {
  return new Promise(function (ok, no) {
    var q = indexedDB.open('qc_outbox', 1);
    q.onupgradeneeded = function () { var db = q.result; if (!db.objectStoreNames.contains('out')) db.createObjectStore('out'); if (!db.objectStoreNames.contains('done')) db.createObjectStore('done'); };
    q.onsuccess = function () { ok(q.result); }; q.onerror = function () { no(q.error); };
  });
}
function req(r) { return new Promise(function (ok, no) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
function flushOutbox() {
  return idb().then(function (db) {
    var st = db.transaction('out').objectStore('out');
    return Promise.all([req(st.getAllKeys()), req(st.getAll())]).then(function (kv) {
      var keys = kv[0], vals = kv[1], fail = 0;
      return keys.reduce(function (p, k, i) {
        return p.then(function () {
          var it = vals[i];
          return fetch(it.url, { method: 'POST', body: it.body }).then(function (r) { return r.json(); }).then(function (res) {
            if (!res || (!res.ok && !res.handedOver)) { fail++; return; }
            var tx = db.transaction(['out', 'done'], 'readwrite');
            tx.objectStore('out').get(k).onsuccess = function (e) { var cur = e.target.result; if (cur && cur.v === it.v) tx.objectStore('out').delete(k); };
            tx.objectStore('done').put({ v: it.v, ids: it.ids || null, res: { ok: !!res.ok, sid: res.sid, final: res.final, handedOver: res.handedOver, owner: res.owner } }, k);
            return new Promise(function (ok) { tx.oncomplete = ok; tx.onerror = ok; });
          }).catch(function () { fail++; });
        });
      }, Promise.resolve()).then(function () {
        db.close();
        if (!fail) return;
        // لسه مبعتتش من ربع ساعة أو أكتر: إشعار للفني حتى لو التطبيق مقفول
        var old = vals.reduce(function (a, x) { return Math.min(a, x.since || x.v || Date.now()); }, Date.now()), min = Math.round((Date.now() - old) / 60000);
        var p = min >= 15 ? self.registration.showNotification('⚠️ فيه ' + vals.length + ' حاجة متبعتتش للسيرفر', { body: 'من ' + min + ' دقيقة — افتح النت عشان توصل', tag: 'pending', renotify: true }).catch(function () {}) : Promise.resolve();
        return p.then(function () { throw new Error('retry'); });
      });
    });
  });
}
self.addEventListener('sync', function (e) { if (e.tag === 'outbox') e.waitUntil(flushOutbox()); });
self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'update') return;
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(FILES.map(function (f) { return fetch(f, { cache: 'no-store' }).then(function (r) { if (r.ok) return c.put(f, r); }).catch(function () {}); })); })
    .then(function () { return self.registration.update(); }).then(function () { return flushOutbox().catch(function () {}); }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) return cs[i].focus();
    return self.clients.openWindow('./');
  }));
});
