// El histórico de las obras cerradas (D-087): el dueño lo abre desde su inicio y ve sus promedios, lo que cuesta cada
// etapa por su unidad y cada obra cerrada (en el seed, OB-003). El PM no entra.
import { expect, test } from '@playwright/test';
import { entrar, es } from './apoyo';

test('el dueño ve el histórico de sus obras cerradas', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.historico }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.historico.titulo })).toBeVisible();
  await expect(page.getByText(es.historico.margen)).toBeVisible();
  // lo que costó la demolición del baño de OB-003, por pie²
  await expect(page.getByText(/^Baño · Demolición/).first()).toBeVisible();
  await expect(page.getByText('$36.00/ft²').first()).toBeVisible();
  // cada obra cerrada lleva a su cierre
  await page.getByRole('link', { name: /OB-003 · / }).click();
  await expect(page.getByText(/^Obra cerrada; se entregó el/)).toBeVisible();
});

test('el PM no entra al histórico', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto('/historico');
  await expect(page).not.toHaveURL(/historico/);
});
