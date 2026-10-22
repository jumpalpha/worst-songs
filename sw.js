/* Worst Song Ever app service worker.
   Pages: network first, cached copy if offline. Images/CSS/JS: cached copy first, refreshed in the background.
   Audio, Supabase and anything off-site are never touched. */
var CACHE = "wse-v1";
var SHELL = ["/", "/app/", "/assets/style.css", "/assets/app/icon-192.png", "/assets/brand/logo.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.headers.has("range") || /\.(mp3|m4a|wav)$/i.test(url.pathname)) return;
  if (url.pathname.indexOf("/request/") === 0) return;

  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") > -1) {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("/"); });
    }));
    return;
  }

  if (/\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
