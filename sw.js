const CACHE = 'spiderman-v7';
const FILES = ["./accounts.js?v=7", "./firebase-config.js?v=7", "./icons/icon-192.png", "./icons/icon-512.png", "./", "./index.html", "./app.js?v=7", "./spiderman-game.js?v=7", "./css/mobile.css?v=7", "./css/spiderman-game.css", "./manifest.webmanifest", "./images/background.jpg", "./images/building.png", "./images/doctor-octopus.png", "./images/goblin.png", "./images/heart.png", "./images/jump.png", "./images/knife.png", "./images/mysterio.png", "./images/running-change-step.png", "./images/running-left-step.png", "./images/running-right-step.png", "./images/sandman.png", "./images/shoot-change-step.png", "./images/shoot-jump.png", "./images/shoot-left-step.png", "./images/shoot-right-step.png", "./images/shoot.png", "./images/slide.png", "./images/spider-head.png", "./images/standing.png", "./images/thug-light.png", "./images/thug.png", "./images/venom-original.png", "./images/venom.png", "./images/wall.jpg", "./images/web.png", "./audio/60-theme-song.mp3", "./audio/amazing-spider-man-2.mp3", "./audio/animated-series-theme.mp3", "./audio/old-theme.mp3", "./audio/shooting-web.mp3", "./fonts/Adventure.ttf", "./fonts/pixel.otf"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('spiderman-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  const shell = event.request.mode === 'navigate' || /\.(js|css)$/.test(url.pathname);
  event.respondWith(caches.open(CACHE).then(async cache => {
    if (shell) {
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        return (await cache.match(event.request)) || (event.request.mode === 'navigate' && await cache.match('./index.html')) || Response.error();
      }
    }
    return (await cache.match(event.request)) || fetch(event.request);
  }));
});
