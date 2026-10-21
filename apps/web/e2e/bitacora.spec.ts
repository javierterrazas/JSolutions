// La bitácora de la obra para el PM (D-105), con OB-001 del seed: el lunes 5 de octubre se cerró con la demolición
// del baño terminada, Pedro 8 horas y el sub de plomería, que llegó.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

test('el PM abre la bitácora de su obra y ve lo que cerró, sin dinero', async ({ page }) => {
  await entrar(page, 'pm');
  await page.locator(`a[href="/obras/${OBRAS.carlos}/bitacora"]`).first().click();
  await expect(page.getByRole('heading', { level: 1, name: es.bitacora.titulo })).toBeVisible();
  const lunes = page.getByRole('listitem').filter({ hasText: /lunes, 5 de octubre/i });
  await expect(lunes).toContainText('Baño principal: Demolición y retiro de escombro ✓ terminada');
  await expect(lunes).toContainText('Pedro 8 h');
  await expect(lunes).toContainText('Plomería Rápida llegó');
  await expect(page.getByText('$')).toHaveCount(0);
});
