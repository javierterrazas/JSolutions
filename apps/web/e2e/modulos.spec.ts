// Los módulos de una empresa (D-110): quien administra la plataforma (en el seed, el dueño de IJM) apaga Indicadores a
// su empresa, el botón desaparece y la pantalla ya no abre; lo vuelve a prender con el plan de un toque.
import { MODULOS } from '@ijm/core';
import { expect, test } from '@playwright/test';
import { admin, entrar, es } from './apoyo';

const EMPRESA_A = 'e000000a-0000-4000-8000-000000000000';

test('apagar un módulo esconde su botón y cierra su pantalla; el plan lo vuelve a prender', async ({
  page,
}) => {
  test.setTimeout(90_000);
  try {
    await entrar(page, 'dueno');
    await expect(page.getByRole('link', { name: es.inicio.indicadores })).toBeVisible();
    await page.goto(`/plataforma/${EMPRESA_A}`);
    const modulos = page.locator('form').filter({ hasText: es.modulos.titulo });
    const indicadores = modulos.getByRole('checkbox', {
      name: new RegExp(`^${es.modulos.nombres.indicadores}`),
    });
    await expect(indicadores).toBeChecked();

    // apagar el dinero apaga lo que depende de él
    await modulos.getByRole('checkbox', { name: new RegExp(`^${es.modulos.nombres.dinero}`) }).uncheck();
    await expect(
      modulos.getByRole('checkbox', { name: new RegExp(`^${es.modulos.nombres.cambios}`) }),
    ).not.toBeChecked();
    await modulos.getByRole('button', { name: es.modulos.planes.empresa }).click();
    await indicadores.uncheck();
    await modulos.getByRole('button', { name: es.modulos.guardar }).click();
    await expect(modulos.getByRole('status')).toHaveText(es.modulos.guardados);

    await page.goto('/');
    await expect(page.getByRole('link', { name: es.inicio.historico })).toBeVisible();
    await expect(page.getByRole('link', { name: es.inicio.indicadores })).toHaveCount(0);
    // sin el módulo, la pantalla manda al inicio (el navegador cuenta esa redirección como navegación cortada)
    await page.goto('/indicadores').catch(() => undefined);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /^Hola, / })).toBeVisible();

    // con el plan de un toque, todo otra vez
    await page.goto(`/plataforma/${EMPRESA_A}`);
    await modulos.getByRole('button', { name: es.modulos.planes.empresa }).click();
    await modulos.getByRole('button', { name: es.modulos.guardar }).click();
    await expect(modulos.getByRole('status')).toHaveText(es.modulos.guardados);
    await page.goto('/');
    await expect(page.getByRole('link', { name: es.inicio.indicadores })).toBeVisible();
  } finally {
    // las pruebas que siguen necesitan a la empresa con todo, menos la checada, que cambia el cierre del PM (D-117)
    await admin()
      .from('empresas')
      .update({ modulos: MODULOS.filter((m) => m !== 'checada') })
      .eq('id', EMPRESA_A);
  }
});
