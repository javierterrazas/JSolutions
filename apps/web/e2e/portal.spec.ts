// El portal del cliente (D-066), con OB-001 del seed (Familia García): su enlace de prueba y la foto de su cierre
// marcada para el cliente. El cliente entra sin cuenta ni PIN; el PM marca qué fotos ve; el dueño crea el enlace.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

const PORTAL = '/cliente/enlace-de-prueba-cliente-garcia-2026';

test('el cliente abre su enlace sin cuenta y ve cómo va su obra, sin el costo ni lo interno', async ({
  page,
}) => {
  const bloqueado: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) bloqueado.push(m.text());
  });
  await page.goto(PORTAL);
  await expect(page.getByRole('heading', { level: 1, name: 'Familia García' })).toBeVisible();
  await expect(page.getByText('IJM Construction', { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+% terminado$/).first()).toBeVisible();
  await expect(page.getByText(/^Entrega comprometida: /)).toBeVisible();
  for (const seccion of ['espacios', 'trabajado', 'fotos'] as const)
    await expect(page.getByRole('heading', { level: 2, name: es.portal[seccion] })).toBeVisible();
  // en qué se trabaja, sin los espacios de la obra
  const enProceso = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: es.portal.espacios }) });
  await expect(enProceso).toContainText(es.portal.enProceso);
  await expect(enProceso).not.toContainText(/Generales de obra|Baño principal/);
  // ni en los días trabajados: solo el trabajo
  await expect(page.locator('main')).not.toContainText(/Generales de obra|Baño principal/);
  await expect(page.getByRole('img', { name: /^Foto del / }).first()).toBeVisible();
  // del dinero, solo lo que se le cobra en sus órdenes de cambio; nada del costo, del margen ni de lo interno
  await expect(page.locator('main')).not.toContainText(/costo|margen|\$650|Pedro|Plomería Rápida|prevista/i);
  expect(bloqueado).toEqual([]);

  await page.goto('/cliente/un-enlace-que-no-existe-0000000');
  await expect(page.getByRole('heading', { level: 1, name: es.portal.noDisponible })).toBeVisible();
});

test('el PM decide qué fotos ve el cliente desde el álbum', async ({ page, browser }) => {
  await entrar(page, 'pm');
  await page.goto(`/obras/${OBRAS.carlos}/album`);
  const marcada = page.getByRole('button', { name: es.album.paraCliente, pressed: true }).first();
  await expect(marcada).toBeVisible();

  // la quita: el cliente ya no ve fotos
  const marcadas = await page.getByRole('button', { name: es.album.paraCliente, pressed: true }).count();
  await marcada.click();
  await expect(page.getByRole('button', { name: es.album.paraCliente, pressed: true })).toHaveCount(
    marcadas - 1,
  );
  const cliente = await browser.newPage();
  await cliente.goto(PORTAL);
  if (marcadas === 1) await expect(cliente.getByText(es.portal.sinFotos)).toBeVisible();

  // y la vuelve a poner
  await page.getByRole('button', { name: es.album.paraCliente, pressed: false }).first().click();
  await expect(page.getByRole('button', { name: es.album.paraCliente, pressed: true })).toHaveCount(marcadas);
  await cliente.reload();
  await expect(cliente.getByRole('img', { name: /^Foto del / }).first()).toBeVisible();
  await cliente.close();
});

test('el dueño emite una orden de cambio y el cliente la aprueba con su firma en su portal (D-067)', async ({
  page,
  browser,
}) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.cambios }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.cambios.titulo })).toBeVisible();

  // sin días: no mueve la entrega de las pruebas que siguen
  await page.locator('select[name="motivo"]').selectOption('solicitud_cliente');
  await page.locator('textarea[name="descripcion"]').fill('Repisa de cuarzo en el nicho');
  await page.locator('input[name="costo"]').fill('260');
  await page.locator('input[name="precio"]').fill('350');
  await page.getByRole('button', { name: es.cambios.emitir }).click();
  // con margen bajo, sugiere el precio que cumple el mínimo
  await expect(page.getByRole('alert').filter({ hasText: /Precio sugerido: \$400/ })).toBeVisible();
  await page.getByRole('button', { name: es.cambios.usarSugerido }).click();
  await expect(page.locator('input[name="precio"]')).toHaveValue('400');
  await page.getByRole('button', { name: es.cambios.emitir }).click();
  await expect(page.getByRole('status')).toContainText(/^OC-\d{4} emitida/);

  // el cliente la ve en su portal, con su precio y sin el costo
  const cliente = await browser.newPage();
  await cliente.goto(PORTAL);
  const orden = cliente.locator('article').filter({ hasText: 'Repisa de cuarzo en el nicho' });
  await expect(orden).toContainText('$400.00 (impuesto incluido)');
  await expect(orden).not.toContainText('260');
  const aprobar = orden.getByRole('button', { name: es.portal.aprobar });
  await orden.getByRole('textbox', { name: es.portal.nombreCompleto }).fill('Ana García');
  // sin firma no deja aprobar
  await expect(aprobar).toBeDisabled();
  // el recuadro tiene que estar en pantalla: el mouse se mueve en lo que se ve
  await orden.locator('canvas').scrollIntoViewIfNeeded();
  const caja = (await orden.locator('canvas').boundingBox())!;
  await cliente.mouse.move(caja.x + 20, caja.y + caja.height / 2);
  await cliente.mouse.down();
  await cliente.mouse.move(caja.x + caja.width / 2, caja.y + 20, { steps: 8 });
  await cliente.mouse.move(caja.x + caja.width - 20, caja.y + caja.height - 20, { steps: 8 });
  await cliente.mouse.up();
  await aprobar.click();
  await expect(cliente.locator('article').filter({ hasText: 'Repisa de cuarzo en el nicho' })).toContainText(
    /Aprobada por Ana García el /,
  );
  await cliente.close();

  // y el dueño ve quién la aprobó, cuándo y su firma
  await page.reload();
  const enLista = page.locator('li').filter({ hasText: 'Repisa de cuarzo en el nicho' });
  await expect(enLista).toContainText(es.cambios.estados.autorizada);
  await expect(enLista).toContainText(/Aprobada por Ana García el /);
  await expect(enLista).toContainText(es.cambios.enPortal);
  await expect(enLista.getByRole('img', { name: 'Firma de Ana García' })).toBeVisible();
});

test('el dueño crea un enlace nuevo para el cliente y el anterior deja de servir', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.carlos}/seguimiento`);
  await expect(page.getByRole('heading', { level: 2, name: es.enlaceCliente.titulo })).toBeVisible();
  await expect(page.getByText(/^Enlace activo desde el /)).toBeVisible();
  await page.getByRole('button', { name: es.enlaceCliente.crearOtro }).click();
  await expect(page.getByText(es.enlaceCliente.listo)).toBeVisible();
  const url = await page.getByRole('textbox', { name: es.enlaceCliente.enlace }).inputValue();
  expect(url).toMatch(/\/cliente\/[\w-]{40,}$/);

  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: 'Familia García' })).toBeVisible();
  await page.goto(PORTAL);
  await expect(page.getByRole('heading', { level: 1, name: es.portal.noDisponible })).toBeVisible();
});
