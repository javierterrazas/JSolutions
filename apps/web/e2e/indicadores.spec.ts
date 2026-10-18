// Los indicadores de la empresa (D-075): el dueño los abre desde su inicio; arriba los seis del lunes y abajo los 19
// por proceso; el que no está en verde se abre con las obras que lo mueven (D-099). El PM no entra.
import { expect, test } from '@playwright/test';
import { admin, entrar, es, hoy } from './apoyo';

test('el dueño ve los seis del lunes y los 19 indicadores por proceso', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.indicadores }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.indicadores.titulo })).toBeVisible();
  const principales = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: es.indicadores.principales }) });
  await expect(principales.locator(':scope > ul > li')).toHaveCount(6);
  for (const p of ['P3', 'P4', 'P5', 'P6'] as const)
    await expect(page.getByRole('heading', { level: 2, name: es.indicadores.procesos[p] })).toBeVisible();
  await expect(page.getByText(es.indicadores.explicaciones.no_calidad_sobre_contratos)).toBeVisible();
  // el saldo con los subs, en dinero
  await expect(principales).toContainText(/\$[\d,]+\.\d{2}/);
});

test('al tocar uno de los seis que no está en verde, se ven las obras que lo mueven (D-099)', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.goto('/indicadores');
  const saldo = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: es.indicadores.principales }) })
    .locator(':scope > ul > li')
    .filter({ hasText: es.indicadores.nombres.saldo_subcontratistas });
  const obra = saldo.getByRole('link', { name: /^OB-001 · / });
  await expect(obra).toBeHidden();
  await saldo.getByText(/^Ver (la obra|las \d+ obras)$/).click();
  await expect(obra).toBeVisible();
  await expect(obra).toContainText(/\$[\d,]+\.\d{2} por pagar a los subs/);
  await obra.click();
  await expect(page).toHaveURL(/\/obras\/[^/]+\/subcontratos$/);
});

test('el cumplimiento del plan: al abrir se congela el de esta semana, y se ve lo prometido la semana pasada', async ({
  page,
}) => {
  // la semana pasada depende de hoy: se le pone el plan que el seed trae del 5 de octubre (la demolición del baño
  // de OB-001, terminada ese día)
  const dow = new Date(`${hoy()}T12:00:00Z`).getUTCDay();
  const lunesPasado = hoy(-((dow + 6) % 7) - 7);
  const db = admin();
  const { data: semilla } = await db
    .from('plan_semanal')
    .select('*')
    .eq('semana', '2026-10-05')
    .limit(1)
    .single();
  if (lunesPasado !== '2026-10-05') {
    const { id: _, creado_en: __, ...fila } = semilla!;
    await db
      .from('plan_semanal')
      .upsert(
        { ...fila, semana: lunesPasado },
        { onConflict: 'semana,partida_obra_id', ignoreDuplicates: true },
      );
  }

  await entrar(page, 'dueno');
  await page.goto('/indicadores');
  const tarjeta = page
    .locator('li')
    .filter({ has: page.getByText(es.indicadores.nombres.cumplimiento_semanal, { exact: true }) });
  await expect(tarjeta.getByText(/El plan de esta semana/)).toBeVisible();
  await tarjeta.getByText(/Ver lo prometido la semana pasada/).click();
  await expect(tarjeta.getByRole('heading', { level: 3, name: 'OB-001' })).toBeVisible();
  await expect(tarjeta.getByText(/terminada el/).first()).toBeVisible();
});

test('el PM no entra a los indicadores', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto('/indicadores');
  await expect(page).not.toHaveURL(/indicadores/);
});
