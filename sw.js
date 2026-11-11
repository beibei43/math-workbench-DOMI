/* 数学学习工作台 · 离线缓存（仅 http/https 生效；file:// 直接打开时自动跳过） */
const CACHE = 'mxwb-v12';
const FILES = [
  './', './index.html', './styles.css', './data.js', './topics.js', './calcguide.js', './classify.js', './variants.js', './calendar.js', './sync.js', './app.js',
  './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(FILES.map(f => c.add(f).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; /* OCR 组件等外部资源不缓存 */
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
