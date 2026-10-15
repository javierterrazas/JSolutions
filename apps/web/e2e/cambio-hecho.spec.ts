// Una orden de cambio ya hecha (D-081): el PM la marca en su inicio con una nota y una foto; el dueño lo ve en las
// órdenes de cambio de la obra y el cliente en su portal, con la foto. En el seed, OB-001 tiene aprobada "Nicho
// adicional en la regadera", por hacer, y "Tile de otra colección", ya hecha.
import { expect, test } from '@playwright/test';
import { entrar, es, FOTO, OBRAS, otroCelular } from './apoyo';

const PORTAL = '/cliente/enlace-de-prueba-cliente-garcia-2026';

test('el PM marca hecha una orden de cambio con su foto; el dueño y el cliente la ven', async ({
  page,
  browser,
}) => {
  await entrar(page, 'pm');
  const orden = page.locator('li').filter({ hasText: 'Nicho adicional en la regadera' });
  await orden.getByRole('button', { name: es.inicioPm.yaLaHice }).click();
  await orden.getByLabel(es.inicioPm.notaCambio).fill('Nicho terminado y sellado');
  await orden.locator('input[type="file"]').setInputFiles(FOTO);
  await expect(orden.locator('img')).toHaveCount(1);
  await orden.getByRole('button', { name: es.inicioPm.marcarHecha }).click();
  await expect(orden.getByText(/^✓ Hecha el/)).toBeVisible();
  await expect(orden.getByRole('button', { name: es.inicioPm.yaLaHice })).toHaveCount(0);

  // el dueño: quién la marcó, su nota y la foto
  const oficina = await otroCelular(browser);
  const dueno = await oficina.newPage();
  await entrar(dueno, 'dueno');
  await dueno.goto(`/obras/${OBRAS.carlos}/cambios`);
  const suya = dueno.locator('li').filter({ hasText: 'Nicho adicional en la regadera' });
  await expect(suya.getByText(/la marcó Carlos Méndez/)).toBeVisible();
  await expect(suya.getByText('Nicho terminado y sellado')).toBeVisible();
  await expect(suya.locator('img[src^="/fotos/"]')).toHaveCount(1);
  await oficina.close();

  // el cliente, en su portal: el cambio realizado, con la foto
  const casa = await otroCelular(browser);
  const cliente = await casa.newPage();
  await cliente.goto(PORTAL);
  await expect(cliente.getByText(/^Cambio realizado el/).first()).toBeVisible();
  const foto = cliente.getByRole('img', { name: es.portal.fotoDelCambio });
  await expect(foto).toHaveCount(1);
  expect((await cliente.request.get((await foto.getAttribute('src'))!)).status()).toBe(200);
  await casa.close();
});
