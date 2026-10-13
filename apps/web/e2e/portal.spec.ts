// El portal del cliente (D-066), con OB-001 del seed (Familia García): su enlace de prueba y la foto de su cierre
// marcada para el cliente. El cliente entra sin cuenta ni PIN; el PM marca qué fotos ve; el dueño crea el enlace.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

const PORTAL = '/cliente/enlace-de-prueba-cliente-garcia-2026';

test('el cliente abre su enlace sin cuenta y ve cómo va su obra, sin dinero', async ({ page }) => {
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
  await expect(page.getByRole('img', { name: /^Foto del / }).first()).toBeVisible();
  // nada de dinero ni de lo interno
  await expect(page.locator('main')).not.toContainText(/\$|Pedro|Plomería Rápida|prevista/i);
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
