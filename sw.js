// Offline helper: always tries the internet first (so updates show up),
// and falls back to the saved copy when there's no connection.
const CACHE = "my-journal-v96";
// Build 24: style.css and app.js carry ?v= so a design change is never served from a
// stale copy — the browser treats a new address as a new file. Bump both here and in
// index.html together.
const APP_FILES = ["./", "index.html", "style.css?v=25", "app.js?v=25", "patrick-hand.woff2", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Build 23.1: only the app's own files are saved. Before, any address the app happened to ask
  // for was copied into the cache, including ones from elsewhere that can't even be read back.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // Build 23.5: version.json is the one file that must never come from the saved copies. It is what
  // tells the app a new build is live, and a saved copy would always name the build already running
  // — which would send the app into reloading itself over and over. Left alone here, it either
  // reaches the internet or fails, and a failure means the app simply doesn't check this time.
  if (new URL(event.request.url).pathname.endsWith("/version.json")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
