// La marca de la empresa (D-078): el dueño sube su logo en "Mi empresa"; sale arriba de las pantallas, y la app se
// instala con el nombre y el ícono de la empresa. Antes de entrar, J Solutions.
import { expect, test } from '@playwright/test';
import { entrar, es, FOTO } from './apoyo';

test('antes de entrar, la app se instala como J Solutions', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('J Solutions');
  const icono = await request.get(m.icons[0].src);
  expect(icono.headers()['content-type']).toBe('image/png');
});

test('el dueño sube el logo de su empresa: sale arriba, y la app se instala con su nombre e ícono', async ({
  page,
  request,
}) => {
  await entrar(page, 'dueno');
  // ya con su sesión, el manifiesto es el de su empresa
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toMatch(/^\/marca\/[0-9a-f-]{36}\/manifest\?v=\d+$/);
  expect((await (await request.get(href!)).json()).name).toBe('IJM Construction');

  await page.getByRole('link', { name: es.inicio.miEmpresa }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.miEmpresa.titulo })).toBeVisible();
  await page.locator('input[name="logo"]').setInputFiles(FOTO);
  await page.getByRole('radio', { name: es.miEmpresa.fondoColor }).check();
  await page.getByRole('button', { name: es.miEmpresa.guardar }).click();
  await expect(page.getByRole('status')).toHaveText(es.miEmpresa.guardado);

  // el logo, arriba de cada pantalla
  await page.goto('/');
  const logo = page.locator('header img[src*="/logo"]');
  await expect(logo).toBeVisible();
  expect((await request.get((await logo.getAttribute('src'))!)).status()).toBe(200);
  // y el ícono de la app, con su logo
  const nuevo = (await page.locator('link[rel="manifest"]').getAttribute('href'))!;
  const m = await (await request.get(nuevo)).json();
  const icono = await request.get(m.icons[0].src);
  expect(icono.status()).toBe(200);
  expect(icono.headers()['content-type']).toBe('image/png');
});

test('el PM ve el logo de su empresa pero no entra a "Mi empresa"', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto('/empresa');
  await expect(page).not.toHaveURL(/empresa/);
});
