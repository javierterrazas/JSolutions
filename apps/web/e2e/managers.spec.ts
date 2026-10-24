// Dar de alta a un manager con su celular (D-083): el dueño lo invita en "Managers", le manda el enlace, y el manager
// lo abre en su celular, elige su PIN y entra. Su celular sale en la lista.
import { expect, test } from '@playwright/test';
import { entrar, es, otroCelular } from './apoyo';

test('el dueño da de alta a un manager con su celular y el manager entra con su enlace', async ({
  page,
  browser,
}) => {
  const digitos = `555${String(Date.now()).slice(-7)}`;
  const celular = `(${digitos.slice(0, 3)}) ${digitos.slice(3, 6)}-${digitos.slice(6)}`;
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.equipo }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.equipo.titulo })).toBeVisible();
  await page.getByLabel(es.equipo.nombre).fill('Mario Pérez');
  await page.getByLabel(es.equipo.celular).fill(celular);
  await page.getByRole('button', { name: es.equipo.invitar }).click();
  const enlace = await page.getByRole('textbox', { name: es.equipo.copiar }).inputValue();
  expect(enlace).toMatch(/\/invitacion\/[\w-]{43}$/);

  // el mismo celular, escrito de otra forma, ya no se puede dar de alta
  await page.reload();
  await page.getByLabel(es.equipo.nombre).fill('Otro');
  await page.getByLabel(es.equipo.celular).fill(`+1 ${digitos}`);
  await page.getByRole('button', { name: es.equipo.invitar }).click();
  await expect(page.getByText(es.errores.celular_ya_registrado)).toBeVisible();
  // y sale en la lista con su celular
  await expect(page.getByRole('link', { name: celular })).toBeVisible();

  // el manager abre su enlace en su celular, elige su PIN y entra
  const suyo = await otroCelular(browser);
  const telefono = await suyo.newPage();
  await telefono.goto(enlace);
  await telefono.getByRole('button', { name: es.invitacion.boton }).click();
  await expect(telefono).toHaveURL(/\/pin\/nuevo$/);
  await telefono.locator('input[name="pin"]').fill('5173');
  await telefono.locator('input[name="repetir"]').fill('5173');
  await telefono.getByRole('button', { name: es.pin.guardar }).click();
  await expect(
    telefono.getByRole('heading', { name: es.inicio.hola.replace('{nombre}', 'Mario Pérez') }),
  ).toBeVisible();
  await suyo.close();
});

test('el dueño invita a un administrador y cambia a un PM a administrador y de regreso (D-112)', async ({
  page,
}) => {
  const digitos = `556${String(Date.now()).slice(-7)}`;
  await entrar(page, 'dueno');
  await page.goto('/equipo');
  await expect(page.getByRole('heading', { level: 2, name: es.equipo.invitarAlguien })).toBeVisible();
  await page.getByLabel(es.equipo.nombre).fill('Ana Oficina');
  await page.getByLabel(es.equipo.celular).fill(digitos);
  await page.getByRole('combobox', { name: es.equipo.rolInvitar }).selectOption('admin');
  await page.getByRole('button', { name: es.equipo.invitar }).click();
  await expect(page.getByRole('textbox', { name: es.equipo.copiar })).toBeVisible();

  await page.reload();
  const ana = page.getByRole('listitem').filter({ hasText: 'Ana Oficina' });
  await expect(ana).toContainText(es.equipo.rol.admin);

  // Luis, de PM a administrador y de regreso
  // la tarjeta de Luis, no la de su celular (su nombre también sale ahí)
  const luis = page.getByRole('listitem').filter({ has: page.getByText('Luis Ramírez', { exact: true }) });
  await luis.getByRole('button', { name: es.equipo.hacerAdministrador }).click();
  await expect(luis).toContainText(es.equipo.rol.admin);
  await luis.getByRole('button', { name: es.equipo.hacerPm }).click();
  await expect(luis).toContainText(es.equipo.rol.pm);
});
