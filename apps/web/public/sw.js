// El service worker de la app. Por ahora solo la hace instalable y toma el control en cuanto se actualiza.
// Lo que se guarda sin señal (la cola, D-007) llega en el paso 5 del plan de la fase 2.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});
