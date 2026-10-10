// El service worker de la app: la hace instalable y la abre sin señal (fase 2, paso 5c; D-047).
//
// Guarda la página /sin-senal con todo su código. Cuando el teléfono abre una página y el servidor no contesta en
// 6 segundos (sin señal, o una señal que casi conecta), muestra esa página guardada, que trabaja con la copia del
// teléfono. Con señal, todo va al servidor como siempre: nada de lo del miembro se guarda aquí.

const CACHE = 'ijm-app';
const PAGINA_SIN_SENAL = '/sin-senal';
const ESPERA_MS = 6000;
/** Cada cuánto vuelve a guardar la app, como mucho, si nada cambió. */
const MINUTOS_ENTRE_GUARDADOS = 5;

let ultimoGuardado = 0;
let ultimoIdioma = null;

/** Las rutas del código que usa una página: las de sus etiquetas y las que vienen dentro de sus datos. */
function recursosDe(html) {
  const rutas = new Set();
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) rutas.add(m[0]);
  for (const m of html.matchAll(/["'(]static\/(?:chunks|css|media)\/[^"'\s\\)]+/g))
    rutas.add(`/_next/${m[0].slice(1)}`);
  return [...rutas];
}

/**
 * Guarda la página sin señal y su código. Todo o nada: si algo no baja, se queda lo que había, para no dejar una
 * página a medias.
 */
async function guardarApp() {
  const pagina = await fetch(PAGINA_SIN_SENAL, { cache: 'no-store', credentials: 'same-origin' });
  if (!pagina.ok || pagina.redirected) return;
  const html = await pagina.clone().text();
  const rutas = ['/manifest.webmanifest', ...recursosDe(html)];
  const respuestas = await Promise.all(
    rutas.map(async (r) => {
      const res = await fetch(r, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`no bajó ${r}`);
      return [r, res];
    }),
  );
  const cache = await caches.open(CACHE);
  for (const vieja of await cache.keys()) await cache.delete(vieja);
  await cache.put(PAGINA_SIN_SENAL, pagina);
  for (const [r, res] of respuestas) await cache.put(r, res);
  ultimoGuardado = Date.now();
}

self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(guardarApp().catch(() => {}));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nombre of await caches.keys()) if (nombre !== CACHE) await caches.delete(nombre);
      await self.clients.claim();
    })(),
  );
});

// El inicio del PM lo pide cada vez que abre con señal: así la página guardada sigue la versión y el idioma.
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo !== 'guardar-app') return;
  const idioma = evento.data.idioma ?? null;
  if (idioma === ultimoIdioma && Date.now() - ultimoGuardado < MINUTOS_ENTRE_GUARDADOS * 60_000) return;
  ultimoIdioma = idioma;
  evento.waitUntil(guardarApp().catch(() => {}));
});

/** La respuesta del servidor, o un error si no llega en `ms`. */
function conLimite(promesa, ms) {
  return new Promise((listo, falla) => {
    const reloj = setTimeout(() => falla(new Error('sin respuesta')), ms);
    promesa.then(
      (r) => {
        clearTimeout(reloj);
        listo(r);
      },
      (e) => {
        clearTimeout(reloj);
        falla(e);
      },
    );
  });
}

async function navegar(peticion) {
  try {
    return await conLimite(fetch(peticion), ESPERA_MS);
  } catch {
    const guardada = await caches.match(PAGINA_SIN_SENAL, { cacheName: CACHE });
    return guardada ?? Response.error();
  }
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);
  if (peticion.method !== 'GET' || url.origin !== self.location.origin) return;
  if (peticion.mode === 'navigate') {
    evento.respondWith(navegar(peticion));
    return;
  }
  // el código de Next lleva su huella en el nombre: no cambia, así que lo guardado sirve igual
  if (url.pathname.startsWith('/_next/static/')) {
    evento.respondWith(
      caches.match(peticion, { cacheName: CACHE }).then((guardada) => guardada ?? fetch(peticion)),
    );
  }
});
