// El presupuesto con costo y margen (D-084): de cada etapa se captura el costo, el precio sale con el margen de la
// obra (o el de la etapa), y el contrato sigue a la suma de los precios o se redondea. El seguimiento compara lo
// gastado contra el costo y muestra el margen esperado.
import { expect, test } from '@playwright/test';
import { entrar, es, obraNueva } from './apoyo';

test('el dueño captura el costo y el margen; el precio y el contrato salen solos', async ({
  page,
  browser,
}) => {
  // una obra nueva con un baño: cada etapa con $1,000 de costo y el margen de la empresa (35%)
  const obraId = await obraNueva(browser, `Margen ${Date.now()}`);
  await entrar(page, 'dueno');
  await page.goto(`/obras/${obraId}/presupuesto`);
  const costos = page.locator('fieldset').getByRole('textbox', { name: /^Costo de / });
  const margenes = page.locator('fieldset').getByRole('textbox', { name: /^Margen de / });
  await expect(costos.first()).toHaveValue('1000');
  await expect(page.getByText('Precio: $1,538.46').first()).toBeVisible();

  // una etapa con su propio margen
  await costos.first().fill('1300');
  await margenes.first().fill('50');
  await expect(page.getByText('Precio: $2,600.00')).toBeVisible();

  // el contrato del alta ($20,000) no era la suma: se usa la suma y luego se redondea
  await page.getByRole('button', { name: es.presupuesto.usarSuma }).click();
  const contrato = page.getByRole('textbox', { name: es.presupuesto.contrato });
  const suma = Number((await contrato.inputValue()).replace(/[^\d.]/g, ''));
  expect(suma).toBeGreaterThan(2600);
  await contrato.fill(String(Math.ceil(suma / 100) * 100));
  await expect(page.getByText(/^Con este contrato, tu margen queda en/)).toBeVisible();
  await page.getByRole('button', { name: es.presupuesto.guardar }).click();
  await expect(page.getByRole('status')).toHaveText(es.presupuesto.completo);

  // el seguimiento: lo gastado contra el costo, y el margen esperado
  await page.goto(`/obras/${obraId}/seguimiento`);
  await expect(page.getByText(/^Margen esperado: \d+%/)).toBeVisible();
  await expect(page.getByText(/de costo \(/)).toBeVisible();
});
