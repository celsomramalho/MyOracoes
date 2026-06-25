const CACHE_NOME = 'minhas-oracoes-v1';
const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NOME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  // Fontes do Google Fonts: tenta rede, sem quebrar offline se falhar
  if(evento.request.url.includes('fonts.googleapis.com') || evento.request.url.includes('fonts.gstatic.com')){
    evento.respondWith(
      fetch(evento.request).catch(() => caches.match(evento.request))
    );
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      return respostaCache || fetch(evento.request).then((respostaRede) => {
        return caches.open(CACHE_NOME).then((cache) => {
          cache.put(evento.request, respostaRede.clone());
          return respostaRede;
        });
      }).catch(() => respostaCache);
    })
  );
});
