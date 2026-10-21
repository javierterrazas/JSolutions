// La cuadrilla del dueño (D-061), con el seed: Pedro (Ayudante, $22.50 la hora, con horas anotadas) y Juan (Oficial,
// $220 el día). Agregar, editar, programar un salario nuevo, y dar de baja: el PM ya no lo ve en el cierre.
import { expect, type Page, test } from '@playwright/test';
import { en, entrar, es, hoy, OBRAS, otroCelular, t } from './apoyo';

const tarjeta = (page: Page, nombre: string) =>
  page.locator('li').filter({ has: page.getByRole('heading', { level: 3, name: nombre, exact: true }) });

/**
 * A quién le ofrece el cierre del PM anotar en la cuadrilla: el de Luis en OB-002, que ninguna prueba cierra (la de
 * cierre ya cerró hoy OB-001).
 */
async function enElCierre(browser: import('@playwright/test').Browser): Promise<string> {
  const pm = await otroCelular(browser);
  try {
    const p = await pm.newPage();
    await entrar(p, 'pmIngles');
    await p.goto(`/obras/${OBRAS.luis}/cierre`);
    // a toda la cuadrilla, no solo a los que ya trabajaron en la obra (D-104)
    const ver = p.getByRole('button', { name: /^See the whole crew/ });
    if (await ver.count()) await ver.click();
    return await p.locator('fieldset').filter({ hasText: en.cierre.cuadrilla }).innerText();
  } finally {
    await pm.close();
  }
}

test('el dueño da de alta, edita, cambia el salario y da de baja; el PM lo ve en el cierre sin salario', async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.cuadrilla }).click();
  await expect(page.getByRole('heading', { name: es.cuadrilla.titulo })).toBeVisible();
  await expect(tarjeta(page, 'Pedro')).toContainText(t.es('cuadrilla.porHoraMonto', { monto: '$22.50' }));
  await expect(tarjeta(page, 'Juan')).toContainText(t.es('cuadrilla.porDiaMonto', { monto: '$220.00' }));

  // agregar: un nombre repetido no pasa
  await page.getByRole('button', { name: es.cuadrilla.agregar }).click();
  await page.getByRole('textbox', { name: es.cuadrilla.nombre, exact: true }).fill('juan');
  await page.getByLabel(es.cuadrilla.puesto).fill('Plomera');
  await page.getByRole('textbox', { name: es.cuadrilla.salario }).fill('28');
  await page.getByRole('button', { name: es.cuadrilla.guardar }).click();
  await expect(page.getByText(es.errores.trabajador_repetido)).toBeVisible();
  await page.getByRole('textbox', { name: es.cuadrilla.nombre, exact: true }).fill('Rosa');
  await page.getByRole('button', { name: es.cuadrilla.guardar }).click();
  const rosa = tarjeta(page, 'Rosa');
  await expect(rosa).toContainText('Plomera');
  await expect(rosa).toContainText(t.es('cuadrilla.porHoraMonto', { monto: '$28.00' }));
  await expect(rosa).toContainText(t.es('cuadrilla.dias', { n: 0 }));

  // editar: el puesto cambia; cómo cobra solo si no tiene días (Pedro sí tiene)
  await rosa.getByRole('button', { name: es.cuadrilla.editar }).click();
  await rosa.getByLabel(es.cuadrilla.puesto).fill('Plomera oficial');
  await rosa.getByRole('button', { name: es.cuadrilla.guardar }).click();
  await expect(rosa).toContainText('Plomera oficial');
  await tarjeta(page, 'Pedro').getByRole('button', { name: es.cuadrilla.editar }).click();
  await expect(tarjeta(page, 'Pedro').getByRole('combobox', { name: es.cuadrilla.tipoPago })).toBeDisabled();
  await tarjeta(page, 'Pedro').getByRole('button', { name: es.cuadrilla.cancelar }).click();

  // un salario nuevo desde dentro de una semana: hoy sigue el de antes, y se ve el que viene
  await rosa.getByRole('button', { name: es.cuadrilla.cambiarSalario }).click();
  await rosa.getByRole('textbox', { name: es.cuadrilla.nuevoPorHora }).fill('30');
  await rosa.getByLabel(es.cuadrilla.desde).fill(hoy(7));
  await rosa.getByRole('button', { name: es.cuadrilla.guardar }).click();
  await expect(rosa).toContainText(t.es('cuadrilla.porHoraMonto', { monto: '$28.00' }));
  await expect(rosa).toContainText('$30.00');

  // dar de baja a Juan: pasa a "Dados de baja", y el PM ya no lo ve en el cierre; a Rosa sí, sin salario
  await tarjeta(page, 'Juan').getByRole('button', { name: es.cuadrilla.darDeBaja }).click();
  await expect(page.getByRole('heading', { name: es.cuadrilla.dadosDeBaja })).toBeVisible();
  await expect(tarjeta(page, 'Juan').getByRole('button', { name: es.cuadrilla.reactivar })).toBeVisible();
  const cierre = await enElCierre(browser);
  expect(cierre).toContain('Rosa');
  expect(cierre).not.toContain('Juan');
  expect(cierre).not.toContain('$');

  // y se reactiva
  await tarjeta(page, 'Juan').getByRole('button', { name: es.cuadrilla.reactivar }).click();
  await expect(tarjeta(page, 'Juan').getByRole('button', { name: es.cuadrilla.darDeBaja })).toBeVisible();
});

test('las horas de la semana: cada uno con su total y su costo; al tocarlo, sus obras y sus días (D-094)', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.goto('/cuadrilla');
  await page.getByRole('link', { name: es.cuadrilla.semana }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.semanaCuadrilla.titulo })).toBeVisible();
  // la semana del seed: Pedro tiene horas el lunes 5 de octubre en OB-001
  await page.goto('/cuadrilla/semana?semana=2026-10-07');
  await expect(page.getByText('Del 5 oct al 11 oct 2026')).toBeVisible();
  const pedro = page.locator('details').filter({ hasText: 'Pedro' });
  await expect(pedro).toContainText(/\d+ h/);
  await expect(pedro).toContainText(/\$[\d,.]+/);
  await expect(pedro.getByText(/^OB-001 · /)).toBeHidden();
  await pedro.getByText('Pedro', { exact: true }).click();
  await expect(pedro.getByText(/^OB-001 · /)).toBeVisible();
  await expect(pedro).toContainText(/lun 5: \d+ h/);
  await page.getByRole('link', { name: es.semanaCuadrilla.siguiente }).click();
  await expect(page).toHaveURL(/semana=2026-10-12/);
});
