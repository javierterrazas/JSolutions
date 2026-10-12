// Las obras terminadas del PM, mientras dura su garantía (D-060), con el seed: OB-003 de Carlos se entregó el
// 2026-10-30, 63 días después de lo comprometido, con garantía hasta el 2027-10-30.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS, t } from './apoyo';

test('el PM ve sus obras terminadas en garantía y sus fotos, de solo lectura', async ({ page }) => {
  await entrar(page, 'pm');
  await page.getByRole('link', { name: t.es('inicio.terminadas', { n: 1 }) }).click();
  await expect(page.getByRole('heading', { name: es.terminadas.titulo })).toBeVisible();
  const obra = page.locator('article').filter({ hasText: 'OB-003 · Familia López' });
  await expect(obra).toContainText(t.es('terminadas.tarde', { n: 63 }));
  await expect(obra).toContainText(/2027/);

  await obra.getByRole('link', { name: es.terminadas.verFotos }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.carlosEntregada}/album$`));
  await expect(page.getByRole('heading', { name: es.album.titulo })).toBeVisible();
  await expect(page.getByText(es.album.tipos.bitacora).first()).toBeVisible();
  await expect(page.getByText(es.album.tipos.orden_cambio)).toHaveCount(0);
  await expect(page.locator('img[src^="/fotos/"]').first()).toBeAttached();

  // regresa a sus obras terminadas, y lo demás de la obra sigue cerrado para él
  await page.getByRole('link', { name: es.album.volver }).click();
  await expect(page).toHaveURL(/\/obras\/terminadas$/);
  const respuesta = await page.goto(`/obras/${OBRAS.carlosEntregada}/cierre`);
  expect(respuesta?.status()).toBe(404);
});
