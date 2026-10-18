// La plataforma (D-080): quien la administra (en el seed, el dueño de IJM) ve las empresas, anota un pago, da de alta
// una empresa con el enlace para su dueño y la suspende; cuando la suscripción vence y pasa la gracia, la app queda
// en solo lectura y el PM lo ve en su inicio. También edita los datos de una empresa y de su dueño (D-097).
import { expect, test } from '@playwright/test';
import { admin, entrar, es, hoy, otroCelular } from './apoyo';

const IJM = 'e000000a-0000-4000-8000-000000000000';

test('quien administra la plataforma ve las empresas y anota el pago de una', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.plataforma }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.plataforma.titulo })).toBeVisible();
  await expect(page.getByRole('link', { name: /IJM Construction/ })).toBeVisible();
  await page.getByRole('link', { name: /Remodelaciones del Valle/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Remodelaciones del Valle' })).toBeVisible();

  // el pago ya trae el monto y hasta cuándo cubre; solo se anota la referencia
  await page.getByLabel(es.plataforma.referencia).fill('Pago de prueba');
  await page.getByRole('button', { name: es.plataforma.registrarPago }).click();
  await expect(page.getByRole('status')).toHaveText(es.plataforma.pagoRegistrado);
  await expect(page.getByText(/Pago de prueba/)).toBeVisible();
  // pagó: ya no está a prueba
  await expect(page.getByText(es.plataforma.estados.activa, { exact: true })).toBeVisible();
});

test('da de alta una empresa con su dueño, que entra con su enlace; luego la suspende', async ({
  page,
  browser,
}) => {
  await entrar(page, 'dueno');
  await page.goto('/plataforma/nueva');
  await page.getByLabel(es.plataforma.empresa).fill('Pisos del Norte');
  await page.getByLabel(es.plataforma.dueno).fill('Ana Torres');
  await page.getByLabel(es.plataforma.celular).fill(`555${String(Date.now()).slice(-7)}`);
  await page.getByLabel(es.plataforma.precio).fill('59');
  await page.getByRole('button', { name: es.plataforma.darDeAlta }).click();
  await expect(page.getByRole('status')).toHaveText(es.plataforma.altaLista);
  const enlace = await page.getByRole('textbox', { name: es.equipo.copiar }).inputValue();
  expect(enlace).toMatch(/\/invitacion\/[\w-]{20,}$/);

  // el dueño nuevo abre su enlace en su celular
  const suyo = await otroCelular(browser);
  const telefono = await suyo.newPage();
  await telefono.goto(enlace);
  await expect(telefono.getByRole('button', { name: es.invitacion.boton })).toBeVisible();
  await suyo.close();

  await page.getByRole('link', { name: es.plataforma.verCuenta }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pisos del Norte' })).toBeVisible();
  await expect(page.getByText(es.plataforma.estados.prueba, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: es.plataforma.suspender }).click();
  await page.getByRole('button', { name: es.plataforma.suspenderSi }).click();
  await expect(page.getByText(es.plataforma.estados.suspendida, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: es.plataforma.reactivar }).click();
  await expect(page.getByText(es.plataforma.estados.prueba, { exact: true })).toBeVisible();
});

test('vencida la gracia, la app queda en solo lectura y el PM lo ve; el PM no entra a la plataforma', async ({
  page,
}) => {
  const db = admin();
  // venció hace 10 días: ya pasó la gracia
  const vencio = hoy(-10);
  await db.from('suscripciones').update({ vence_el: vencio }).eq('empresa_id', IJM);
  try {
    await entrar(page, 'pm');
    await expect(page.getByText(es.suscripcion.soloLecturaPm)).toBeVisible();
    await expect(page.getByRole('link', { name: es.inicio.plataforma })).toHaveCount(0);
    await page.goto('/plataforma');
    await expect(page).not.toHaveURL(/plataforma/);
  } finally {
    await db.from('suscripciones').update({ vence_el: null }).eq('empresa_id', IJM);
  }
});

test('quien administra edita los datos de una empresa y de su dueño (D-097)', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto('/plataforma');
  await page.getByRole('link', { name: /Remodelaciones del Valle/ }).click();
  const datos = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: es.plataforma.editarDatos }) });
  await page.getByRole('button', { name: es.plataforma.editarDatos }).click();
  const ciudad = page.getByRole('textbox', { name: es.plataforma.ciudad });
  const antes = await ciudad.inputValue();
  await page.getByRole('textbox', { name: es.plataforma.empresa }).fill('Remodelaciones del Valle Sur');
  await ciudad.fill('San Antonio, TX');
  await page.getByRole('textbox', { name: es.plataforma.correoOpcional }).fill('valle@remodela.test');
  await datos.getByRole('button', { name: es.plataforma.guardar }).click();
  await expect(page.getByRole('status')).toHaveText(es.plataforma.guardado);
  await expect(page.getByRole('heading', { level: 1, name: 'Remodelaciones del Valle Sur' })).toBeVisible();
  await expect(page.getByText('San Antonio, TX')).toBeVisible();
  await expect(page.getByText(/valle@remodela\.test/)).toBeVisible();

  // se deja como estaba, para las demás pruebas
  await page.getByRole('button', { name: es.plataforma.editarDatos }).click();
  await page.getByRole('textbox', { name: es.plataforma.empresa }).fill('Remodelaciones del Valle');
  await page.getByRole('textbox', { name: es.plataforma.ciudad }).fill(antes);
  await page.getByRole('textbox', { name: es.plataforma.correoOpcional }).fill('');
  await datos.getByRole('button', { name: es.plataforma.guardar }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Remodelaciones del Valle' })).toBeVisible();
});
