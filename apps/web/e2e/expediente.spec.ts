// El expediente de una obra (D-102), con OB-001 del seed: el dueño lo abre desde el seguimiento, elige las secciones
// y "Descargar PDF" abre la opción de imprimir.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

test('el dueño arma el expediente de la obra y lo manda a imprimir como PDF', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.expediente }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.expediente.titulo })).toBeVisible();
  await expect(page.getByText('Expediente OB-001 · Familia García')).toBeVisible();

  // de entrada, todo menos las fotos
  const seccion = (n: string) => page.getByRole('heading', { level: 2, name: n, exact: true });
  for (const n of [
    'resumen',
    'presupuesto',
    'cambios',
    'cobros',
    'subcontratos',
    'diario',
    'calidad',
  ] as const)
    await expect(seccion(es.expediente.nombres[n])).toBeVisible();
  await expect(seccion(es.expediente.nombres.fotos)).toHaveCount(0);
  await expect(page.getByText('Silicón disparejo en el vanity')).toBeVisible();

  // se quita una y se agregan las fotos
  await page.getByRole('checkbox', { name: es.expediente.nombres.cobros }).uncheck();
  await expect(seccion(es.expediente.nombres.cobros)).toHaveCount(0);
  await page.getByRole('checkbox', { name: es.expediente.nombres.fotos }).check();
  await expect(seccion(es.expediente.nombres.fotos)).toBeVisible();

  // "Descargar PDF" abre la opción de imprimir del navegador
  await page.evaluate(() => {
    (window as unknown as { impreso: boolean }).impreso = false;
    window.print = () => {
      (window as unknown as { impreso: boolean }).impreso = true;
    };
  });
  await page.getByRole('button', { name: es.expediente.descargar }).click();
  expect(await page.evaluate(() => (window as unknown as { impreso: boolean }).impreso)).toBe(true);

  // en papel no salen los controles
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: es.expediente.descargar })).toBeHidden();
  await expect(page.getByText('Expediente OB-001 · Familia García')).toBeVisible();
});
