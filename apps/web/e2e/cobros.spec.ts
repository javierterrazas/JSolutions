// Los cobros al cliente (D-071), con OB-001 del seed: contrato de $24,000, $2,000 en cambios aprobados y un depósito
// de $7,200. El dueño registra un pago, lo corrige y lo anula; el cliente ve sus pagos en su portal.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

test('el dueño registra, corrige y anula un pago del cliente; el cliente ve sus pagos', async ({
  page,
  browser,
}) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.cobros }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.cobros.titulo })).toBeVisible();
  const porCobrar = page
    .locator('div')
    .filter({ has: page.getByText(es.cobros.porCobrar, { exact: true }) })
    .last();
  await expect(porCobrar).toContainText('$18,800.00');

  await page.getByRole('textbox', { name: es.cobros.monto }).fill('$6,500');
  await page
    .getByRole('combobox', { name: es.cobros.metodo })
    .selectOption({ label: es.cobros.metodos.cheque });
  await page.getByRole('textbox', { name: es.cobros.referencia }).fill('Cheque 1043');
  await page.getByRole('button', { name: es.cobros.registrar }).click();
  await expect(page.getByRole('status')).toContainText(/Pago registrado: COB-\d{4}/);
  await expect(porCobrar).toContainText('$12,300.00');

  const pago = page.locator('li').filter({ hasText: 'Cheque 1043' });
  await pago.getByRole('button', { name: es.gasto.corregir }).click();
  await pago.getByRole('textbox', { name: es.cobros.monto }).fill('6000');
  await pago.getByRole('textbox', { name: es.gasto.motivo }).fill('Era otro cheque');
  await pago.getByRole('button', { name: es.gasto.guardarCorreccion }).click();
  await expect(porCobrar).toContainText('$12,800.00');

  await pago.getByRole('button', { name: es.gasto.anular }).click();
  await pago.getByRole('textbox', { name: es.gasto.motivo }).fill('El cheque rebotó');
  await pago.getByRole('button', { name: es.gasto.anularConfirmar }).click();
  await expect(porCobrar).toContainText('$18,800.00');
  await expect(page.locator('li').filter({ hasText: 'Cheque 1043' })).toHaveCount(0);

  // el cliente ve lo que lleva pagado y su saldo, sin el método ni la referencia
  const cliente = await browser.newPage();
  await cliente.goto('/cliente/enlace-de-prueba-cliente-garcia-2026');
  const pagos = cliente
    .locator('section')
    .filter({ has: cliente.getByRole('heading', { name: es.portal.pagos }) });
  await expect(pagos).toContainText('$7,200.00');
  await expect(pagos).toContainText('$18,800.00');
  await expect(pagos).not.toContainText(/Zelle|Cheque/);
  await cliente.close();
});

test('el cobro de una orden de cambio dice cuál y trae lo que le falta (D-089)', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/cobros`);
  await page
    .getByRole('combobox', { name: es.cobros.concepto })
    .selectOption({ label: es.cobros.conceptos.orden_cambio });
  // elige la primera orden aprobada y pone lo que le falta por cobrar ($1,000 en el seed)
  await expect(page.getByRole('combobox', { name: es.cobros.ordenCambio })).toBeVisible();
  await expect(page.getByRole('textbox', { name: es.cobros.monto })).toHaveValue('1000');
  await page.getByRole('button', { name: es.cobros.registrar }).click();
  await expect(page.getByRole('status')).toContainText(/Pago registrado: COB-\d{4}/);
  await expect(page.getByText(/Orden de cambio OC-\d+/).first()).toBeVisible();
});
