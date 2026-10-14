// Los indicadores de la empresa (D-075): el dueño los abre desde su inicio; arriba los seis del lunes y abajo los 19
// por proceso. El PM no entra.
import { expect, test } from '@playwright/test';
import { entrar, es } from './apoyo';

test('el dueño ve los seis del lunes y los 19 indicadores por proceso', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.indicadores }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.indicadores.titulo })).toBeVisible();
  const principales = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: es.indicadores.principales }) });
  await expect(principales.locator('li')).toHaveCount(6);
  for (const p of ['P3', 'P4', 'P5', 'P6'] as const)
    await expect(page.getByRole('heading', { level: 2, name: es.indicadores.procesos[p] })).toBeVisible();
  await expect(page.getByText(es.indicadores.explicaciones.no_calidad_sobre_contratos)).toBeVisible();
  // el saldo con los subs, en dinero
  await expect(principales).toContainText(/\$[\d,]+\.\d{2}/);
});

test('el PM no entra a los indicadores', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto('/indicadores');
  await expect(page).not.toHaveURL(/indicadores/);
});
