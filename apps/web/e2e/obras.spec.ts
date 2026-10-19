// La lista de obras con sus filtros (D-100), con el seed: OB-001 (Familia García) y OB-002 (Familia Smith) en curso,
// OB-003 (Familia López) entregada. Otras pruebas agregan obras: lo que se revisa no depende de cuántas hay.
import { expect, test } from '@playwright/test';
import { entrar, es } from './apoyo';

test('las obras se filtran por estado, búsqueda y periodo; al regresar, la lista sigue igual', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.goto('/obras');
  const garcia = page.getByRole('link', { name: /^OB-001 · Familia García/ });
  const lopez = page.getByRole('link', { name: /^OB-003 · Familia López/ });
  // de entrada, las que van en curso
  await expect(page.getByRole('tab', { name: /^En curso \(\d+\)$/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(garcia).toBeVisible();
  await expect(lopez).toHaveCount(0);

  await page.getByRole('tab', { name: /^Entregadas \(\d+\)$/ }).click();
  await expect(page).toHaveURL(/estado=entregadas/);
  await expect(lopez).toBeVisible();
  await expect(lopez).toContainText(/entregada el/);
  await expect(garcia).toHaveCount(0);

  // en todas, el buscador encuentra por cliente, sin acentos
  await page.getByRole('tab', { name: /^Todas \(\d+\)$/ }).click();
  await page.getByRole('searchbox', { name: es.obras.buscar }).fill('garcia');
  await expect(garcia).toBeVisible();
  await expect(lopez).toHaveCount(0);
  await expect(page).toHaveURL(/q=garcia/);

  // al abrir una obra y regresar, los filtros siguen
  await garcia.click();
  await expect(page).toHaveURL(/\/seguimiento$/);
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: es.obras.buscar })).toHaveValue('garcia');
  await expect(page.getByRole('tab', { name: /^Todas/ })).toHaveAttribute('aria-selected', 'true');

  // un periodo sin obras lo dice
  await page.getByRole('searchbox', { name: es.obras.buscar }).fill('no existe esta obra');
  await expect(page.getByText(es.obras.ningunaConFiltros)).toBeVisible();
  await page.getByRole('searchbox', { name: es.obras.buscar }).fill('');
  await page.getByRole('button', { name: es.obras.periodos.anio }).click();
  await expect(page).toHaveURL(/periodo=anio/);
  await expect(garcia).toBeVisible();
});
