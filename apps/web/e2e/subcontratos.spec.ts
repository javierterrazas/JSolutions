// Los subcontratos de una obra (D-074), con OB-001 del seed: Plomería Rápida (en regla) tiene una orden de $2,000 con
// $500 de anticipo y otra de $300 pagada. El dueño emite dos órdenes de una vez (D-091), liquida una antes de recibir
// el trabajo (confirmando), cancela la otra, reprograma una, y al final liquida con un toque la ya recibida.
import { expect, type Page, test } from '@playwright/test';
import { admin, entrar, es, MIEMBROS, OBRAS } from './apoyo';

async function elegir(page: Page, partida: string, precio: string) {
  const grupo = page.getByRole('group', { name: partida, exact: true });
  await grupo.getByRole('checkbox').check();
  await grupo.getByRole('textbox', { name: es.subcontratos.precio }).fill(precio);
}

test('el dueño emite dos órdenes de una vez, le paga al sub contra una y cancela la otra', async ({
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

  await page.getByRole('button', { name: es.subcontratos.nueva }).click();
  await page.getByRole('combobox', { name: es.subcontratos.sub }).selectOption({ index: 1 });
  await elegir(page, 'Rough de plomería', '450');
  await elegir(page, 'Demolición y retiro de escombro', '200');
  await page.getByRole('textbox', { name: es.subcontratos.alcance }).fill('Instalar el WC y el lavabo');
  await page.getByRole('button', { name: 'Emitir 2 órdenes' }).click();
  await expect(page.getByRole('status')).toHaveText(/^2 órdenes emitidas: OT-\d{4}, OT-\d{4}\.$/);
  await expect(porPagar).toContainText('$2,150.00');

  // la de la plomería se liquida antes de recibir el trabajo: se confirma
  const ordenes = page.locator('li').filter({ hasText: 'Instalar el WC y el lavabo' });
  const plomeria = ordenes.filter({ hasText: 'Rough de plomería' });
  await plomeria.getByRole('button', { name: es.subcontratos.pagar }).click();
  await plomeria.getByRole('combobox', { name: es.subcontratos.concepto }).selectOption('liquidacion');
  await plomeria.getByRole('button', { name: es.subcontratos.registrarPago }).click();
  await expect(plomeria.getByRole('alert')).toContainText(es.subcontratos.avisos.sin_aprobar);
  await plomeria.getByRole('button', { name: es.subcontratos.pagarAsi }).click();
  await expect(plomeria).toContainText(es.subcontratos.estados.pagada);
  await expect(porPagar).toContainText('$1,700.00');

  // la otra, sin pagos, se cancela y deja de contar
  const demolicion = ordenes.filter({ hasText: 'Demolición' });
  await demolicion.getByRole('button', { name: es.subcontratos.cancelarOrden }).click();
  await expect(demolicion).toContainText(es.subcontratos.estados.cancelada);
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

test('recibido el trabajo (el PM terminó la partida), se liquida con un toque (D-091)', async ({ page }) => {
  // la orden del rough, como si el cierre del PM ya hubiera terminado su partida
  const { data: pm } = await admin().from('miembros').select('id').eq('nombre', MIEMBROS.pm.nombre).single();
  await admin()
    .from('ordenes_trabajo')
    .update({ estado: 'aprobada', aprobada_en: new Date().toISOString(), aprobada_por: pm!.id })
    .eq('obra_id', OBRAS.carlos)
    .eq('alcance', 'Rough de plomería del baño');
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/subcontratos`);
  const orden = page.locator('li').filter({ hasText: 'Rough de plomería del baño' });
  await expect(orden).toContainText(es.subcontratos.estados.aprobada);
  await expect(orden).toContainText('Trabajo recibido: falta pagarle $1,500.00.');
  await orden.getByRole('button', { name: 'Liquidar $1,500.00' }).click();
  await expect(orden).toContainText(es.subcontratos.estados.pagada);
  await expect(orden.getByRole('status')).toHaveText(/^Pago registrado: PAG-\d{4}$/);
});
