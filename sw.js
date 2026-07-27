const CACHE_NAME = "quizlab-v2-firebase";
const APP_FILES = [
  "./",
  "./index.html",
  "./admin.html",
  "./gestor.html",
  "./styles.css",
  "./admin.css",
  "./gestor.css",
  "./app.js",
  "./admin.js",
  "./tracking.js",
  "./firebase-init.js",
  "./gestor.js",
  "./data/banco-preguntas.js",
  "./assets/favicon.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
