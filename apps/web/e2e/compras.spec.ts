// Las compras de la oficina (D-063): desde el seguimiento de la obra, el dueño registra lo que compró, con su recibo, y
// aparece en el día a día de la obra.
import { expect, test } from '@playwright/test';
import { entrar, es, FOTO, OBRAS, t } from './apoyo';

test('el dueño registra una compra con su recibo, y aparece en el día a día de la obra', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.luis}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.registrarCompra }).click();
  await expect(page.getByRole('heading', { name: es.compra.titulo })).toBeVisible();

  // lo que falta se dice
  await page.getByRole('textbox', { name: es.gasto.monto }).fill('0');
  await page.getByRole('textbox', { name: es.gasto.proveedor }).fill('Floor & Decor');
  await page.getByRole('textbox', { name: es.gasto.descripcion }).fill('Tile 12x24');
  await page.getByRole('button', { name: es.compra.registrar }).click();
  await expect(page.getByText(es.errores.monto_invalido)).toBeVisible();

  await page.getByRole('textbox', { name: es.gasto.monto }).fill('$1,340.25');
  await page
    .getByRole('combobox', { name: es.compra.metodo })
    .selectOption({ label: es.compra.metodos.zelle });
  // el recibo: una sola foto, que se ve con su "Quitar"
  await page.locator('input[type="file"]').setInputFiles(FOTO);
  await expect(page.getByRole('button', { name: es.fotos.quitar })).toBeVisible();
  await page.getByRole('button', { name: es.compra.registrar }).click();
  await expect(page.getByRole('status')).toContainText(/Compra registrada: GTO-/);

  // otra, con el formulario vacío
  await page.getByRole('button', { name: es.compra.otra }).click();
  await expect(page.getByRole('textbox', { name: es.gasto.proveedor })).toHaveValue('');

  await page.getByRole('link', { name: es.compra.volver }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.luis}/seguimiento$`));
  await page.locator('summary').filter({ hasText: es.seguimiento.diaADia }).click();
  await expect(
    page.getByText(t.es('seguimiento.gastoOficina', { proveedor: 'Floor & Decor', monto: '$1,340.25' })),
  ).toBeVisible();
});

test('el dueño corrige y anula una compra de la obra, con su motivo (D-068)', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.luis}/compra`);
  await expect(page.getByRole('heading', { level: 2, name: es.compra.compras })).toBeVisible();
  const compra = page.locator('li').filter({ hasText: 'Floor & Decor' });
  await expect(compra).toContainText(es.gasto.deLaOficina);

  await compra.getByRole('button', { name: es.gasto.corregir }).click();
  await compra.getByRole('textbox', { name: es.gasto.monto }).fill('1300');
  await compra.getByRole('textbox', { name: es.gasto.motivo }).fill('Descuento de la factura');
  await compra.getByRole('button', { name: es.gasto.guardarCorreccion }).click();
  await expect(compra).toContainText('$1,300.00');

  await compra.getByRole('button', { name: es.gasto.anular }).click();
  await compra.getByRole('textbox', { name: es.gasto.motivo }).fill('Se devolvió el material');
  await compra.getByRole('button', { name: es.gasto.anularConfirmar }).click();
  await expect(page.locator('li').filter({ hasText: 'Floor & Decor' })).toHaveCount(0);
});

test('el PM no registra compras de la oficina', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto(`/obras/${OBRAS.carlos}/compra`);
  await expect(page).not.toHaveURL(/compra/);
});
