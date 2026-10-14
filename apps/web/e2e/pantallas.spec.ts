// Lo de cualquier pantalla del PM en el teléfono:
// - la política de contenido (CSP) no bloquea nada de la app (D-055);
// - se desliza hasta abajo y de regreso, sin nada que se salga a los lados (legacy/pruebas/prueba_scroll.py: allá el
//   problema era el marco de Apps Script; aquí, que una pantalla larga se pueda recorrer completa con el dedo);
// - los textos de ejemplo de los campos cambian con el idioma (prueba_placeholder.py).
import { expect, type Page, test } from '@playwright/test';
import { en, entrar, es, OBRAS } from './apoyo';

const PANTALLAS = [
  ...['', 'cierre', 'calidad', 'gasto', 'aviso', 'ordenes', 'entrega', 'album'].map((p) =>
    p ? `/obras/${OBRAS.carlos}/${p}` : '/',
  ),
  '/obras/terminadas',
  `/obras/${OBRAS.carlosEntregada}/album`,
];

const desplazamiento = (page: Page) =>
  page.evaluate(() => ({
    y: window.scrollY,
    max: document.documentElement.scrollHeight - window.innerHeight,
    ancho: document.documentElement.scrollWidth - window.innerWidth,
  }));

test('cada pantalla del PM se recorre completa, sin salirse a los lados ni chocar con el CSP', async ({
  page,
}) => {
  // lo que el navegador bloquea por la política de contenido (D-055) sale en la consola
  const bloqueado: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) bloqueado.push(`${page.url()}: ${m.text()}`);
  });
  await entrar(page, 'pm');
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { level: 1 }), ruta).toBeVisible();
    // arriba, el nombre de la empresa del PM, no el de la app (D-065)
    await expect(page.getByText('IJM Construction', { exact: true }), ruta).toBeVisible();
    expect((await desplazamiento(page)).ancho, `${ruta}: nada se sale a los lados`).toBeLessThanOrEqual(0);
  }
  expect(bloqueado).toEqual([]);

  // el inicio es largo: hasta abajo llega a "Salir", y un gesto hacia arriba regresa
  await page.goto('/');
  const { max } = await desplazamiento(page);
  expect(max, 'el inicio del seed es más largo que la pantalla').toBeGreaterThan(300);
  await page.mouse.move(200, 400);
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await desplazamiento(page)).y).toBeGreaterThanOrEqual(max - 1);
  await expect(page.getByRole('button', { name: es.inicio.salir })).toBeInViewport();
  await page.mouse.wheel(0, -350);
  await expect.poll(async () => (await desplazamiento(page)).y).toBeLessThan(max - 300);
});

test('las pantallas del dueño tampoco chocan con el CSP', async ({ page }) => {
  const bloqueado: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) bloqueado.push(`${page.url()}: ${m.text()}`);
  });
  await entrar(page, 'dueno');
  for (const ruta of [
    '/obras',
    '/obras/nueva',
    `/obras/${OBRAS.carlos}/presupuesto`,
    `/obras/${OBRAS.carlos}/seguimiento`,
    `/obras/${OBRAS.carlos}/compra`,
    '/equipo',
    '/cuadrilla',
    '/subcontratistas',
    '/indicadores',
    '/empresa',
    '/catalogo',
    '/gastos',
    '/avisos',
    `/obras/${OBRAS.carlos}/album`,
  ]) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { level: 1 }), ruta).toBeVisible();
  }
  expect(bloqueado).toEqual([]);
});

/** Los textos de un idioma, todos en una lista. */
function textos(m: object): string[] {
  return Object.values(m).flatMap((v) => (typeof v === 'string' ? [v] : textos(v as object)));
}

test('los textos de ejemplo de los campos cambian con el idioma', async ({ page }) => {
  await entrar(page, 'pm');
  const deEs = new Set(textos(es));
  const deEn = new Set(textos(en));
  for (const p of ['gasto', 'aviso', 'entrega']) {
    const ruta = `/obras/${OBRAS.carlos}/${p}`;
    await page.goto(ruta);
    const ejemplos = () =>
      page
        .locator('[placeholder]')
        .evaluateAll((campos) => campos.map((c) => c.getAttribute('placeholder')!))
        .then((ps) => ps.filter((x) => /\p{L}/u.test(x)));
    const enEspanol = await ejemplos();
    expect(enEspanol.length, `${ruta} tiene campos con ejemplo`).toBeGreaterThan(0);
    for (const x of enEspanol) expect(deEs.has(x), `${ruta}: "${x}" sale de mensajes/es.json`).toBe(true);

    await page.getByRole('button', { name: es.idioma.en }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const enIngles = await ejemplos();
    expect(enIngles).toHaveLength(enEspanol.length);
    for (const x of enIngles) expect(deEn.has(x), `${ruta}: "${x}" sale de mensajes/en.json`).toBe(true);
    await page.getByRole('button', { name: en.idioma.es }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  }
});
