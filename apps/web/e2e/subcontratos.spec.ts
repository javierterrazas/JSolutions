// Los subcontratos de una obra (D-074), con OB-001 del seed: Plomería Rápida (en regla) tiene una orden de $2,000 con
// $500 de anticipo y otra de $300 pagada. El dueño emite una orden, la liquida (confirmando que el PM todavía no la
// aprueba) y cancela otra que no tiene pagos.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

test('el dueño emite una orden de trabajo, le paga al sub contra ella y cancela otra sin pagos', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.subcontratos }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.subcontratos.titulo })).toBeVisible();
  const porPagar = page
    .locator('div')
    .filter({ has: page.getByText(es.subcontratos.porPagar, { exact: true }) })
    .last();
  await expect(porPagar).toContainText('$1,500.00');

  // la primera vez se abre el formulario; después de "Emitir otra" ya queda abierto
  const emitir = async (alcance: string, precio: string, abrir: boolean) => {
    if (abrir) await page.getByRole('button', { name: es.subcontratos.nueva }).click();
    await page.getByRole('combobox', { name: es.subcontratos.sub }).selectOption({ index: 1 });
    await page
      .getByRole('combobox', { name: es.subcontratos.partida })
      .selectOption({ label: 'Rough de plomería' });
    await page.getByRole('textbox', { name: es.subcontratos.alcance }).fill(alcance);
    await page.getByRole('textbox', { name: es.subcontratos.precio }).fill(precio);
    await page.getByRole('button', { name: es.subcontratos.emitir }).click();
    await expect(page.getByRole('status').filter({ hasText: /Orden OT-\d{4} emitida/ })).toBeVisible();
    await page.getByRole('button', { name: es.subcontratos.otra }).click();
  };
  await emitir('Instalar el WC y el lavabo', '450', true);
  await expect(porPagar).toContainText('$1,950.00');

  // la liquida: el PM todavía no aprueba el trabajo, se confirma
  const orden = page.locator('li').filter({ hasText: 'Instalar el WC y el lavabo' });
  await orden.getByRole('button', { name: es.subcontratos.pagar }).click();
  await orden.getByRole('combobox', { name: es.subcontratos.concepto }).selectOption('liquidacion');
  await orden.getByRole('button', { name: es.subcontratos.registrarPago }).click();
  await expect(orden.getByRole('alert')).toContainText(es.subcontratos.avisos.sin_aprobar);
  await orden.getByRole('button', { name: es.subcontratos.pagarAsi }).click();
  await expect(orden).toContainText(es.subcontratos.estados.pagada);
  await expect(porPagar).toContainText('$1,500.00');

  // otra, sin pagos, se cancela y deja de contar
  await emitir('Revisar la presión', '200', false);
  await expect(porPagar).toContainText('$1,700.00');
  const otra = page.locator('li').filter({ hasText: 'Revisar la presión' });
  await otra.getByRole('button', { name: es.subcontratos.cancelarOrden }).click();
  await expect(otra).toContainText(es.subcontratos.estados.cancelada);
  await expect(porPagar).toContainText('$1,500.00');
});

test('el dueño reprograma una orden con su motivo, en vez de cancelarla', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/subcontratos`);
  const orden = page.locator('li').filter({ hasText: 'Rough de plomería del baño' });
  await orden.getByRole('button', { name: es.subcontratos.reprogramar }).click();
  await orden.getByRole('textbox', { name: es.subcontratos.motivo }).fill('El sub pidió otro día');
  await orden.getByRole('button', { name: es.subcontratos.reprogramar }).click();
  await expect(orden.getByRole('status')).toHaveText(es.subcontratos.reprogramada);
  await expect(orden).toContainText(es.subcontratos.estados.emitida);
});
