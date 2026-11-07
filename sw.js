// 수의계산기 서비스 워커 — 오프라인 사용 지원
// index.html을 수정해서 다시 올릴 때는 아래 버전 숫자를 올려주세요 (v1 → v2).
const CACHE = 'vetcalc-v1.2';
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
    // 디자인(Tailwind) 스크립트도 미리 저장 → 인터넷 없이도 화면이 깨지지 않음
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

// 인터넷 연결 시: 최신 파일을 받아 저장 / 끊겼을 때: 저장본 사용
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(e.request);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(e.request, fresh.clone());
      return fresh;
    } catch (_) {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      if (e.request.mode === 'navigate') return cache.match('./index.html');
      throw _;
    }
  })());
});
