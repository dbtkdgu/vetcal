// 수의계산기 서비스 워커 — 오프라인 사용 + 약한 신호 대응
// 동작: 최신 파일을 먼저 시도 → 3초 안에 응답 없으면 저장된 버전으로 즉시 열기
//       (늦게 도착한 최신 파일은 뒤에서 저장 → 다음 실행 때 반영)
const CACHE = 'vetcalc-v1.4';
const TIMEOUT_MS = 3000;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const TAILWIND = 'https://cdn.tailwindcss.com';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    try {
      const res = await fetch(TAILWIND, { mode: 'no-cors' });
      await cache.put(TAILWIND, res);
    } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // 네트워크 요청 (성공 시 저장)
  const network = (async () => {
    const res = await fetch(e.request);
    if (res && (res.ok || res.type === 'opaque')) {
      const cache = await caches.open(CACHE);
      await cache.put(e.request, res.clone());
    }
    return res;
  })();
  // 늦게 도착해도 저장은 끝까지 완료
  e.waitUntil(network.catch(() => {}));

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(e.request, { ignoreSearch: true })) ||
                   (e.request.mode === 'navigate' ? await cache.match('./index.html') : undefined);

    // 저장본이 없으면 (첫 실행) 네트워크를 끝까지 기다림
    if (!cached) return network;

    // 저장본이 있으면: 3초 경쟁 → 먼저 오는 쪽 사용
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
    try {
      const winner = await Promise.race([network, timeout]);
      return winner === 'timeout' ? cached : winner;
    } catch (_) {
      return cached; // 오프라인/서버 오류
    }
  })());
});
