// El idioma (legacy/pruebas/prueba_idioma.py): el PM que tiene guardado el inglés ve en inglés todas sus pantallas,
// sin textos de la app que se queden en español; y el idioma que elige con el botón se guarda en él.
import { expect, test } from '@playwright/test';
import { en, entrar, es, MIEMBROS, OBRAS, otroCelular } from './apoyo';

type Mensajes = { readonly [llave: string]: string | Mensajes };

/** Los textos de la app que cambian de un idioma a otro, sin los que llevan datos ({nombre}) ni los muy cortos. */
function soloEnEspanol(es: Mensajes, en: Mensajes): string[] {
  return Object.entries(es).flatMap(([llave, v]) => {
    const otro = en[llave];
    if (typeof v !== 'string') return typeof otro === 'object' ? soloEnEspanol(v, otro) : [];
    return v !== otro && !v.includes('{') && v.length >= 8 ? [v] : [];
  });
}
const ESPANOL = soloEnEspanol(es, en);

const PANTALLAS_DEL_PM = ['', 'cierre', 'calidad', 'gasto', 'aviso', 'ordenes', 'entrega', 'album'];

test('el PM con el inglés guardado ve todo en inglés', async ({ page }) => {
  await entrar(page, 'pmIngles');
  for (const p of PANTALLAS_DEL_PM) {
    const ruta = p ? `/obras/${OBRAS.luis}/${p}` : '/';
    await page.goto(ruta);
    await expect(page.locator('html'), ruta).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 }), ruta).toBeVisible();
    const texto = await page.locator('body').innerText();
    expect(
      ESPANOL.filter((t) => texto.includes(t)),
      `textos en español en ${ruta}`,
    ).toEqual([]);
  }
});

test('el idioma que elige se guarda en él, para cualquier celular', async ({ page, browser }) => {
  const { nombre } = MIEMBROS.pmIngles;
  await entrar(page, 'pmIngles');
  await page.getByRole('button', { name: en.idioma.es }).click();
  await expect(page.getByRole('heading', { name: es.inicio.hola.replace('{nombre}', nombre) })).toBeVisible();

  // en otro celular, con el navegador en inglés, entra en español
  const otro = await otroCelular(browser, { locale: 'en-US' });
  try {
    const pagina = await otro.newPage();
    await entrar(pagina, 'pmIngles', 'es');
    // y le regresa el inglés, como lo tiene el seed
    await pagina.getByRole('button', { name: es.idioma.en }).click();
    await expect(
      pagina.getByRole('heading', { name: en.inicio.hola.replace('{nombre}', nombre) }),
    ).toBeVisible();
  } finally {
    await otro.close();
  }
});
