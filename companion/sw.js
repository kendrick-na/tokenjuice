const CACHE = "tokenjuice-pocket-v13";
const ASSETS = ["./", "./index.html", "./guide.html", "./privacy.html", "./app.css", "./app.js", "./resume.js", "./work-summary.js", "./guide.js", "./manifest.webmanifest", "./icons/tokenjuice-192.png", "./icons/tokenjuice-512.png"];
// Activate only a complete cache. Do not reload clients: unsaved drafts stay in
// their current page until the user chooses to refresh for the new interface.
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE)
  .then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("tokenjuice-pocket-") && key !== CACHE)
    .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()),
));
self.addEventListener("fetch", (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));
