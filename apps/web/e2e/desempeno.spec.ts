// El desempeño de un manager (D-106): el dueño lo abre desde Managers, cambia el periodo y ve sus obras.
import { expect, test } from '@playwright/test';
import { entrar, es, MIEMBROS, OBRAS } from './apoyo';

test('el dueño ve el desempeño de un PM: sus números por grupo, el periodo y sus obras', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto('/equipo');
  await page
    .getByRole('listitem')
    .filter({ hasText: MIEMBROS.pm.nombre })
    .getByRole('link', { name: es.equipo.verDesempeno })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: MIEMBROS.pm.nombre })).toBeVisible();
  for (const g of ['disciplina', 'plazos', 'dinero', 'calidad'] as const)
    await expect(page.getByRole('heading', { level: 2, name: es.desempeno.grupos[g] })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: es.desempeno.nombres.cierre_a_tiempo }),
  ).toBeVisible();
  await expect(page.getByText(/^Meta 95% · Empresa \d+%$/).first()).toBeVisible();

  // otro periodo
  await page.getByRole('link', { name: es.desempeno.periodos['365'] }).click();
  await expect(page).toHaveURL(/\?dias=365$/);
  await expect(page.getByRole('link', { name: es.desempeno.periodos['365'] })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // sus obras llevan a su seguimiento
  await page.locator(`a[href="/obras/${OBRAS.carlos}/seguimiento"]`).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.carlos}/seguimiento$`));
});
