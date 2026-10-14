// Los subcontratistas de la empresa (D-073): el dueño entra desde su inicio, da de alta uno (con los avisos de lo que
// le falta en papeles), lo edita, lo da de baja y lo reactiva.
import { expect, test } from '@playwright/test';
import { entrar, es } from './apoyo';

test('el dueño da de alta un subcontratista, ve lo que le falta, lo edita, lo da de baja y lo reactiva', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.subcontratistas }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.subcontratistas.titulo })).toBeVisible();
  await expect(page.locator('li').filter({ hasText: 'Plomería Rápida' })).toContainText(
    es.subcontratistas.conW9,
  );

  await page.getByRole('button', { name: es.subcontratistas.agregar }).click();
  await page.getByRole('textbox', { name: es.subcontratistas.nombre }).fill('Drenajes del Sur');
  await page.getByRole('combobox', { name: es.subcontratistas.oficio }).selectOption({ index: 1 });
  await page.locator('input[name="telefono"]').fill('512-555-0300');
  await page.getByRole('button', { name: es.subcontratistas.guardar }).click();
  await expect(page.getByText(es.subcontratistas.guardado)).toBeVisible();
  await expect(page.getByText(es.subcontratistas.avisos.sin_seguro).first()).toBeVisible();

  const sub = page.locator('li').filter({ hasText: 'Drenajes del Sur' });
  await sub.getByRole('button', { name: es.subcontratistas.editar }).click();
  await sub.locator('input[name="seguro"]').fill('2027-12-31');
  await sub.locator('input[name="licencia"]').fill('M-777');
  await sub.getByRole('checkbox', { name: es.subcontratistas.w9 }).check();
  await sub.getByRole('button', { name: es.subcontratistas.guardar }).click();
  await expect(sub).toContainText(es.subcontratistas.conW9);
  await expect(sub).not.toContainText(es.subcontratistas.avisos.sin_seguro);

  await sub.getByRole('button', { name: es.subcontratistas.darDeBaja }).click();
  const deBaja = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: es.subcontratistas.dadosDeBaja }) });
  await expect(deBaja).toContainText('Drenajes del Sur');
  await deBaja.getByRole('button', { name: es.subcontratistas.reactivar }).click();
  await expect(page.getByRole('heading', { name: es.subcontratistas.dadosDeBaja })).toHaveCount(0);
});
