"use strict";
const CACHE_NAME = "wortin-shell-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./learning-media.js", "./learning-media.css", "./favicon.svg", "./manifest.webmanifest", "./theme-init.js", "./pwa-register.js", "./404.html", "./assets/wortin-logo.webp", "./assets/wortin-app-icon.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("wortin-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("./index.html", response.clone()));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && url.pathname.startsWith(self.location.pathname.replace(/[^/]*$/, ""))) {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
