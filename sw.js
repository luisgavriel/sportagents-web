// Service worker: la web abre sin conexión con los últimos datos descargados.
// - Archivos de la app: primero la red; supabase-js y fuentes: primero la caché.
// - Lecturas de Supabase (GET /rest/v1/...): primero la red; sin conexión, la última respuesta guardada.
// Escrituras (guardar fuerza) y el login siempre van a la red.
const VERSION = "v9";
const SHELL = `shell-${VERSION}`, DATA = "data-v1";
const FILES = ["./", "index.html", "app.js", "guides.js", "figures.js", "style.css", "manifest.webmanifest", "icons/icon-192.png"];
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES).then(() => c.add(CDN).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// La consulta cambia cada día (p. ej. «desde hace 120 días»), así que se guarda por ruta, sin parámetros.
const dataKey = (url) => url.origin + url.pathname;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.includes("/rest/v1/")) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(DATA).then((c) => c.put(dataKey(url), copy)); }
      return r;
    }).catch(() => caches.open(DATA).then((c) => c.match(dataKey(url))).then((r) => r || Response.error())));
    return;
  }
  if (url.pathname.includes("/auth/v1/")) return;
  // Archivos propios: primero la red, saltándose la caché HTTP (GitHub Pages guarda 10 min) para ver siempre la última versión; sin conexión, la caché.
  if (url.origin === location.origin) {
    e.respondWith(caches.open(SHELL).then((c) => fetch(req, { cache: "no-cache" })
      .then((r) => { if (r.ok) c.put(req, r.clone()); return r; })
      .catch(async () => (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? c.match("index.html") : Response.error()))));
    return;
  }
  // supabase-js (versión fija) y fuentes: primero la caché.
  if (url.hostname === "cdn.jsdelivr.net" || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.open(SHELL).then(async (c) => (await c.match(req)) ||
      fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; })));
  }
});
