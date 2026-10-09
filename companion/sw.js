const CACHE = "tokenjuice-pocket-v10";
const ASSETS = ["./", "./index.html", "./guide.html", "./privacy.html", "./app.css", "./app.js", "./guide.js", "./manifest.webmanifest", "./icons/tokenjuice-192.png", "./icons/tokenjuice-512.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("tokenjuice-pocket-") && key !== CACHE)
    .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()),
));
self.addEventListener("fetch", (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));
