// Los feriados de la empresa (D-108): el dueño los abre desde Mi empresa, agrega los de Estados Unidos del año y marca
// uno como día de trabajo.
import { expect, test } from '@playwright/test';
import { entrar, es, t } from './apoyo';

test('el dueño agrega los feriados de EE. UU. y marca uno como día de trabajo', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.miEmpresa }).click();
  await page.getByRole('link', { name: es.miEmpresa.feriados }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.feriados.titulo })).toBeVisible();

  const anio = new Date().getFullYear() + 1;
  await page.getByRole('button', { name: t.es('feriados.deEstadosUnidos', { anio }) }).click();
  await expect(page.getByRole('status')).toContainText(/Se agregaron \d+\./);
  const navidad = page
    .getByRole('listitem')
    .filter({ hasText: /^.*Navidad/ })
    .last();
  await expect(navidad.getByRole('button', { name: /se descansa/ })).toHaveText(es.feriados.seDescansa);

  await navidad.getByRole('button').click();
  await expect(navidad.getByRole('button')).toHaveText(es.feriados.seTrabaja);
});
