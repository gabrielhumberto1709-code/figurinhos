// Offline básico: mostra o que está no cache e atualiza por trás. A API nunca é guardada.
const CACHE = 'figurinhos-v44';
const BASICO = ['/', '/css/app.css', '/js/app.js', '/js/pixel.js', '/js/motor/util.js', '/js/motor/calendario.js', '/js/motor/partida.js', '/js/motor/mundo.js', '/js/motor/noticias.js', '/js/motor/mercado.js', '/js/motor/financas.js', '/js/aovivo.js', '/js/campinho.js', '/js/sons.js', '/js/elenco.js', '/js/mercado.js', '/js/torneios.js', '/js/jornal.js', '/js/coletiva.js', '/js/motor/imprensa.js', '/js/motor/copa.js', '/js/motor/dm.js', '/js/motor/carreira.js', '/js/motor/continental.js', '/js/motor/regionais.js', '/js/motor/treino.js', '/js/motor/rivais.js', '/js/motor/forma.js', '/js/motor/correio.js', '/js/motor/arbitros.js', '/js/motor/vestiario.js', '/js/motor/eventos.js', '/js/motor/gala.js', '/js/motor/selecao.js', '/js/motor/jornais.js', '/js/motor/potencial.js', '/js/motor/confrontos.js', '/js/gala.js', '/js/motor/temporada.js', '/data/brasil.json', '/manifest.webmanifest', '/img/icone-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICO))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const salvo = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => salvo);
    return salvo || rede;
  }));
});
