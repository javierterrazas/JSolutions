// La cola del teléfono sin señal (legacy/pruebas/prueba_cola.js y prueba_fotos_despues_ui.py; el criterio de
// "terminado" de la fase 2): el PM cierra el día sin señal, la app abre sin señal, y al volver la señal se envía solo,
// sin duplicar nada; lo que una regla rechaza lo ve con la razón, sin atorar lo que venía detrás; y las fotos se
// suben después aunque cierre la app. Cada prueba cierra el día de hoy en una obra nueva que da de alta el dueño.
import { expect, type Page, type Request, test } from '@playwright/test';
import { admin, entrar, es, hoy, obraNueva, otroCelular, t, tomarFoto } from './apoyo';

/** Una acción del servidor (un POST de Next con su encabezado) cuyo cuerpo lleva `texto`. */
const esAccion = (r: Request, texto: string) =>
  r.method() === 'POST' &&
  !!r.headers()['next-action'] &&
  (r.postDataBuffer()?.toString('latin1') ?? '').includes(texto);

/** Los cierres vigentes de hoy en la obra, con cuántas fotos tienen ya guardadas. */
async function cierresDeHoy(obraId: string): Promise<number[]> {
  const base = admin();
  const { data, error } = await base
    .from('bitacora')
    .select('id')
    .eq('obra_id', obraId)
    .eq('dia', hoy())
    .eq('estado', 'vigente');
  if (error) throw error;
  return Promise.all(
    data.map(async (b) => {
      const { count, error: e } = await base
        .from('fotos')
        .select('id', { count: 'exact', head: true })
        .eq('ref_tipo', 'bitacora')
        .eq('ref_id', b.id);
      if (e) throw e;
      return count ?? 0;
    }),
  );
}

/** Espera a que el service worker tenga guardada la app sin señal. */
const appGuardada = (page: Page) =>
  page.waitForFunction(async () => !!(await caches.match('/sin-senal')), undefined, { timeout: 30_000 });

/**
 * El cierre de hoy: la demolición y `fotos` fotos. Sin cuadrilla: las otras pruebas ya anotaron a Juan el día de hoy
 * en otras obras de Carlos, y la app no deja anotarlo dos veces.
 */
async function llenarCierre(page: Page, obraId: string, fotos: number) {
  await page.goto(`/obras/${obraId}/cierre`);
  await page.getByRole('checkbox', { name: 'Demolición y retiro de escombro' }).check();
  for (let i = 0; i < fotos; i++) await tomarFoto(page, 'es', i + 1);
}

/** El recuadro de lo que la cola tiene por enviar (con su botón "Enviar ahora" o "Enviando…"). */
const porEnviar = (page: Page) => page.getByRole('status').filter({ has: page.getByRole('button') });

test('sin señal: el cierre se queda en el teléfono, la app abre sin señal y al volver la señal se envía solo', async ({
  page,
  context,
  browser,
}) => {
  const cliente = 'Familia Sin Señal';
  const obraId = await obraNueva(browser, cliente);
  await entrar(page, 'pm');
  await appGuardada(page);
  await llenarCierre(page, obraId, 2);

  await context.setOffline(true);
  await page.getByRole('button', { name: es.cierre.cerrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.cierre.guardadoSinRed);
  expect(await cierresDeHoy(obraId)).toEqual([]);

  // sin señal, el teléfono abre lo que guardó: el día está en el teléfono, con el cierre y sus 2 fotos por enviar
  await page.getByRole('link', { name: es.cierre.volver }).last().click();
  await expect(page.getByRole('heading', { name: es.sinSenal.titulo })).toBeVisible();
  await expect(page.locator('li').filter({ hasText: cliente })).toContainText(es.sinSenal.enElTelefono);
  await expect(page.getByText(t.es('cola.pendientes', { n: 3 }))).toBeVisible();

  // vuelve la señal: se envía solo, una vez
  await context.setOffline(false);
  await expect(porEnviar(page)).toHaveCount(0, { timeout: 40_000 });
  await expect.poll(() => cierresDeHoy(obraId), { timeout: 20_000 }).toEqual([2]);
  await page.goto('/');
  await expect(page.locator('article').filter({ hasText: cliente })).toContainText(es.inicioPm.cerradoHoy);
});

test('un cierre que llegó al servidor pero cuya respuesta se perdió no se duplica al reenviarlo', async ({
  page,
  browser,
}) => {
  const obraId = await obraNueva(browser, 'Familia Respuesta Perdida');
  await entrar(page, 'pm');
  await llenarCierre(page, obraId, 1);

  // el cierre llega y se guarda, pero al teléfono no le llega la respuesta
  let cortada = false;
  await page.route('**/*', async (route) => {
    if (cortada || !esAccion(route.request(), 'claveEnvio')) return route.continue();
    cortada = true;
    await route.fetch();
    await route.abort('internetdisconnected');
  });
  await page.getByRole('button', { name: es.cierre.cerrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.cierre.guardadoSinRed);
  expect(await cierresDeHoy(obraId)).toEqual([0]);
  await page.unrouteAll();

  // el inicio lo reenvía con la misma clave: no se guarda otra vez, ni se rechaza
  await page.getByRole('link', { name: es.cierre.volver }).last().click();
  await expect(porEnviar(page)).toHaveCount(0, { timeout: 40_000 });
  await expect.poll(() => cierresDeHoy(obraId), { timeout: 20_000 }).toEqual([1]);
  await expect(page.getByRole('button', { name: es.cola.entendido })).toHaveCount(0);
});

test('un cierre que una regla rechaza se ve con su razón, y el gasto que venía detrás sí se envía', async ({
  page,
  context,
  browser,
}) => {
  const cliente = 'Familia Dos Teléfonos';
  const obraId = await obraNueva(browser, cliente);
  await entrar(page, 'pm');
  await appGuardada(page);
  await llenarCierre(page, obraId, 1);
  await context.setOffline(true);
  await page.getByRole('button', { name: es.cierre.cerrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.cierre.guardadoSinRed);

  // sin señal también registra un gasto, desde la app guardada
  await page.getByRole('link', { name: es.cierre.volver }).last().click();
  await page
    .locator('li')
    .filter({ hasText: cliente })
    .getByRole('button', { name: es.sinSenal.registrarGasto })
    .click();
  await page.getByRole('textbox', { name: es.gasto.monto }).fill('86');
  await page.getByRole('textbox', { name: es.gasto.proveedor }).fill('Home Depot');
  await page.getByRole('textbox', { name: es.gasto.descripcion }).fill('Thinset');
  await page.getByRole('button', { name: es.gasto.registrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.gasto.guardadoSinRed);
  await page.getByRole('button', { name: es.sinSenal.volver }).last().click();
  await expect(page.getByText(t.es('cola.pendientes', { n: 3 }))).toBeVisible();

  // mientras, el mismo día se cerró con señal desde otro teléfono del PM
  const otro = await otroCelular(browser);
  try {
    const p2 = await otro.newPage();
    await entrar(p2, 'pm');
    await llenarCierre(p2, obraId, 1);
    await p2.getByRole('button', { name: es.cierre.cerrar }).click();
    await expect(p2.getByRole('status')).toHaveText(es.cierre.listo);
  } finally {
    await otro.close();
  }

  // vuelve la señal: el cierre se rechaza con su razón, el gasto pasa, y no queda nada atorado
  await context.setOffline(false);
  await expect(porEnviar(page)).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByText(es.errores.dia_ya_cerrado)).toBeVisible();
  const { count } = await admin()
    .from('gastos')
    .select('id', { count: 'exact', head: true })
    .eq('obra_id', obraId);
  expect(count, 'el gasto que venía detrás se guardó').toBe(1);
  expect(await cierresDeHoy(obraId), 'solo el cierre del otro teléfono').toHaveLength(1);

  // el PM lo da por visto
  await page.getByRole('button', { name: es.cola.entendido }).click();
  await expect(page.getByText(es.errores.dia_ya_cerrado)).toHaveCount(0);
});

test('las fotos del cierre se suben después, aunque el PM cierre la app', async ({ context, browser }) => {
  const obraId = await obraNueva(browser, 'Familia Fotos Después');
  let page = await context.newPage();
  await entrar(page, 'pm');
  await llenarCierre(page, obraId, 3);

  // la señal alcanza para el cierre, pero no para las fotos
  await context.route('**/*', (route) =>
    esAccion(route.request(), 'tomadaEn') ? route.abort('internetdisconnected') : route.continue(),
  );
  await page.getByRole('button', { name: es.cierre.cerrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.cierre.listo);
  await expect(page.getByText(t.es('cierre.fotosEsperan', { n: 3 }))).toBeVisible();
  expect(await cierresDeHoy(obraId), 'el día quedó cerrado, sin sus fotos todavía').toEqual([0]);

  // el PM cierra la app; la vuelve a abrir ya con señal, y las fotos siguen en su cola y se suben
  await page.close();
  await context.unrouteAll();
  page = await context.newPage();
  await page.goto('/');
  await expect(porEnviar(page)).toHaveCount(0, { timeout: 40_000 });
  await expect.poll(() => cierresDeHoy(obraId), { timeout: 20_000 }).toEqual([3]);
});
