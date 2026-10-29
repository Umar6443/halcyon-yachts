/*
 * Media cache. The first visit downloads the frames; this stores each one in the browser so every later visit opens
 * instantly. Frame URLs carry a content version (?v=...) from their manifest, so a rebuilt sequence can never be
 * served from an old cache entry; manifests themselves are always fetched fresh (cache only as an offline fallback).
 * Bump CACHE to drop everything. Never touches range requests (video streaming) or anything that failed.
 */
const CACHE = "blocktide-media-v3";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        // this site's previous caches, and the ones of the earlier version of the project hosted at the same address
        if ((key.startsWith("blocktide-media-") && key !== CACHE) || key.startsWith("halcyon-media-")) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !/\/(frames|img|video)\//.test(url.pathname)) return;

  if (url.pathname.endsWith("/manifest.json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || Response.error()),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.status === 200) {
        const copy = res.clone();
        event.waitUntil(cache.put(req, copy).catch(() => {}));
      }
      return res;
    })(),
  );
});
