const CACHE = "vocaverse-shell-v15";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/vocaverse.svg",
  "/assets/studio.js",
  "/assets/studio.css",
  "/assets/inter-latin.woff2",
  "/assets/inter-vietnamese.woff2",
  "/assets/inter-latin-semibold.woff2",
  "/assets/inter-vietnamese-semibold.woff2",
  "/assets/jetbrains-mono.woff2",
  "/practice/data/safety_params.json",
  "/practice/config/thresholds.json",
  "/practice/config/lessons.json",
  "/practice/config/cue_context.json",
  "/practice/data/cues.json",
  "/api/lessons",
  "/api/flute-chart",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("vocaverse-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match("/index.html")) ?? Response.error(),
      ),
    );
    return;
  }

  // Trạng thái dựng và kiểm chứng phải lấy từ máy chủ đang chạy.
  if (url.pathname.startsWith("/api/lessons/")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const refresh = fetch(request).then(async (response) => {
          if (response.ok) {
            const copy = response.clone();
            await (await caches.open(CACHE)).put(request, copy);
          }
          return response;
        });
        if (cached) {
          event.waitUntil(refresh.catch(() => {}));
          return cached;
        }
        return refresh.catch(() => Response.error());
      })(),
    );
    return;
  }

  // Bundle chính không có hash trong tên → mạng trước, mất mạng mới dùng bản lưu (luôn nhận bản build mới).
  if (/^\/assets\/studio\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? Response.error()),
    );
    return;
  }

  if (
    /^\/(assets|icons|practice)\//.test(url.pathname) ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});
