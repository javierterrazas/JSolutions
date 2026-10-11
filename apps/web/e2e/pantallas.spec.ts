// Lo de cualquier pantalla del PM en el teléfono:
// - se desliza hasta abajo y de regreso, sin nada que se salga a los lados (legacy/pruebas/prueba_scroll.py: allá el
//   problema era el marco de Apps Script; aquí, que una pantalla larga se pueda recorrer completa con el dedo);
// - los textos de ejemplo de los campos cambian con el idioma (prueba_placeholder.py).
import { expect, type Page, test } from '@playwright/test';
import { en, entrar, es, OBRAS } from './apoyo';

const PANTALLAS = ['', 'cierre', 'calidad', 'gasto', 'aviso', 'ordenes', 'entrega', 'album'].map((p) =>
  p ? `/obras/${OBRAS.carlos}/${p}` : '/',
);

const desplazamiento = (page: Page) =>
  page.evaluate(() => ({
    y: window.scrollY,
    max: document.documentElement.scrollHeight - window.innerHeight,
    ancho: document.documentElement.scrollWidth - window.innerWidth,
  }));

test('cada pantalla del PM se recorre completa, sin salirse a los lados', async ({ page }) => {
  await entrar(page, 'pm');
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { level: 1 }), ruta).toBeVisible();
    expect((await desplazamiento(page)).ancho, `${ruta}: nada se sale a los lados`).toBeLessThanOrEqual(0);
  }

  // el inicio es largo: hasta abajo llega al idioma, y un gesto hacia arriba regresa
  await page.goto('/');
  const { max } = await desplazamiento(page);
  expect(max, 'el inicio del seed es más largo que la pantalla').toBeGreaterThan(300);
  await page.mouse.move(200, 400);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await desplazamiento(page)).y).toBeGreaterThanOrEqual(max - 1);
  await expect(page.getByRole('navigation', { name: es.idioma.etiqueta })).toBeInViewport();
  await page.mouse.wheel(0, -350);
  await expect.poll(async () => (await desplazamiento(page)).y).toBeLessThan(max - 300);
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
