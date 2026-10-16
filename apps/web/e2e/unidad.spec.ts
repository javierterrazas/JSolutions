// La unidad de cada etapa (D-086): el dueño dice en el catálogo que una etapa se cotiza por pie lineal, y en el
// presupuesto escribe los pies lineales del espacio y ve el costo por pie lineal.
import { expect, test } from '@playwright/test';
import { entrar, es, obraNueva } from './apoyo';

test('una etapa por pie lineal: en el presupuesto sale su costo por pie lineal', async ({
  page,
  browser,
}) => {
  const obraId = await obraNueva(browser, `Unidad ${Date.now()}`);
  await entrar(page, 'dueno');
  await page.goto('/catalogo');
  await page.getByRole('combobox', { name: 'Cómo se cotiza Plomería' }).selectOption('pie_lineal');
  await page.waitForLoadState('networkidle');

  await page.goto(`/obras/${obraId}/presupuesto`);
  // la demolición sigue por pie²; la plomería pide los pies lineales del espacio
  await expect(page.getByText(/^Costo \$[\d,.]+\/ft² · Precio/).first()).toBeVisible();
  await expect(page.getByText(es.presupuesto.faltanLineales)).toBeVisible();
  await page.getByRole('textbox', { name: /^Pies lineales de / }).fill('20');
  await expect(page.getByText('Costo $50.00/ft lineal · Precio $76.92/ft lineal')).toBeVisible();
  await page.getByRole('button', { name: es.presupuesto.guardar }).click();
  await expect(page.getByRole('status')).toHaveText(es.presupuesto.completo);
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Pies lineales de / })).toHaveValue('20');
});
