const CACHE_NOME = 'minhas-oracoes-v6';
const ARQUIVOS_PARA_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './state.js',
  './manifest.json',
  './oracoes-oficiais.json',
  './js/utils.js',
  './js/oracoes-data.js',
  './js/oracoes-oficiais-data.js',
  './js/rezar-core.js',
  './js/render-tree.js',
  './js/speech.js',
  './js/editor-core.js',
  './js/components/card.js',
  './js/components/toast.js',
  './js/components/progresso.js',
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
  // Ignora requisições que não sejam http/https (ex: chrome-extension://,
  // injetadas por extensões do navegador). O Cache API não aceita esses
  // esquemas e tentar usá-los gera erro no console sem benefício algum.
  if (!evento.request.url.startsWith('http')) {
    return;
  }

  // Fontes do Google Fonts: tenta rede, sem quebrar offline se falhar
  if(evento.request.url.includes('fonts.googleapis.com') || evento.request.url.includes('fonts.gstatic.com')){
    evento.respondWith(
      fetch(evento.request).catch(() => caches.match(evento.request))
    );
    return;
  }

  // Estratégia: rede primeiro para os arquivos principais, para qualquer
  // .js / .css do app, e para QUALQUER navegação de página (ex: "/", "/admin",
  // ou futuras páginas). Isso garante que o HTML servido nunca fique
  // "preso" numa versão antiga em cache — mesmo em rotas que não estão
  // na lista fixa abaixo.
  const url = new URL(evento.request.url);
  const ehNavegacaoDePagina = evento.request.mode === 'navigate';
  const ehArquivoPrincipal =
    ehNavegacaoDePagina ||
    ARQUIVOS_PARA_CACHE.some(a =>
      evento.request.url.endsWith(a.replace('./', '/')) ||
      evento.request.url.endsWith('/')
    ) ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (ehArquivoPrincipal) {
    evento.respondWith(
      fetch(evento.request).then((respostaRede) => {
        return caches.open(CACHE_NOME).then((cache) => {
          cache.put(evento.request, respostaRede.clone());
          return respostaRede;
        });
      }).catch(() => caches.match(evento.request))
    );
    return;
  }

  // Para outros recursos: cache primeiro, rede como fallback
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
