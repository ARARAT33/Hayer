const CACHE = "hayer-shell-v3";
const CORE = ["./", "./index.html", "./registry.json", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // The registry and app shell must refresh from the network first. This avoids
  // keeping an old instance list or old frontend after a GitHub Pages deploy.
  const isRegistry = url.pathname.endsWith("/registry.json");
  const isNavigation = request.mode === "navigate" || url.pathname.endsWith("/index.html");

  if (isRegistry || isNavigation) {
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" }))
        .then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("./index.html")) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
