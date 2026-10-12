// El cierre del día en pantalla, con OB-001 de Carlos:
// - la cuadrilla por día y por hora (legacy/pruebas/prueba_pordia_ui.py);
// - cambiar de idioma a medio llenar no borra nada (prueba_formularios_ui.py, lo del PM);
// - los números no se mueven con la rueda ni muestran flechitas (prueba_numeros_ui.py; los del dueño, en calidad);
// - el cierre tardío desde el aviso del inicio, y el día sin trabajo (prueba_tardio_ui.py).
// El seed arranca OB-001 en una fecha fija: los días que le faltan cerrar dependen de hoy, y se leen de la pantalla.
import { expect, type Page, test } from '@playwright/test';
import { en, entrar, es, OBRAS, tomarFoto } from './apoyo';

/** El renglón de un trabajador en "¿Quién de la cuadrilla estuvo?". */
const trabajador = (page: Page, titulo: string, nombre: string) =>
  page.locator('fieldset').filter({ hasText: titulo }).locator(':scope > div').filter({ hasText: nombre });

test('la cuadrilla por día y por hora, y cambiar de idioma no borra lo capturado', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto(`/obras/${OBRAS.carlos}/cierre`);
  await expect(page.getByRole('heading', { name: es.cierre.titulo })).toBeVisible();

  // Juan cobra por día: elige entre no vino, día o medio día, sin casilla de horas
  const juan = trabajador(page, es.cierre.cuadrilla, 'Juan');
  await expect(juan.getByRole('combobox').locator('option')).toHaveText([
    es.cierre.noVino,
    es.cierre.diaCompleto,
    es.cierre.medioDia,
  ]);
  await expect(juan.getByRole('textbox')).toHaveCount(0);
  await juan.getByRole('combobox').selectOption({ label: es.cierre.medioDia });
  await expect(juan.getByRole('combobox')).toHaveValue('0.5');

  // Pedro cobra por hora: su casilla de horas
  const pedro = trabajador(page, es.cierre.cuadrilla, 'Pedro');
  await expect(pedro.getByRole('combobox')).toHaveCount(0);
  const horas = pedro.getByRole('textbox', { name: es.cierre.horas });
  await horas.fill('4.5');

  // un número no es type=number: sin flechitas, el teclado decimal, y la rueda no lo cambia
  await expect(horas).not.toHaveAttribute('type', 'number');
  await expect(horas).toHaveAttribute('inputmode', 'decimal');
  await horas.hover();
  await page.mouse.wheel(0, 300);
  await expect(horas).toHaveValue('4.5');

  const notas = page.getByRole('textbox', { name: es.cierre.notas });
  await notas.fill('Se atrasó el tile por lluvia');
  const partida = page.getByRole('checkbox', { name: 'Rough de plomería' });
  await partida.check();

  // a inglés y de regreso: los textos cambian, lo capturado sigue ahí
  for (const [boton, m] of [
    [es.idioma.en, en],
    [en.idioma.es, es],
  ] as const) {
    await page.getByRole('button', { name: boton }).click();
    await expect(page.getByRole('heading', { name: m.cierre.titulo })).toBeVisible();
    const juanAhora = trabajador(page, m.cierre.cuadrilla, 'Juan').getByRole('combobox');
    await expect(juanAhora).toHaveValue('0.5');
    await expect(juanAhora.locator('option:checked')).toHaveText(m.cierre.medioDia);
    await expect(
      trabajador(page, m.cierre.cuadrilla, 'Pedro').getByRole('textbox', { name: m.cierre.horas }),
    ).toHaveValue('4.5');
    await expect(page.getByRole('textbox', { name: m.cierre.notas })).toHaveValue(
      'Se atrasó el tile por lluvia',
    );
    await expect(partida).toBeChecked();
  }
});

test('el cierre tardío desde el inicio, el día sin trabajo y el de hoy', async ({ page }) => {
  await entrar(page, 'pm');
  const pendientes = page.getByRole('alert').filter({ hasText: 'OB-001' });
  const faltan = await pendientes.count();
  expect(faltan, 'el seed deja días sin cerrar en OB-001').toBeGreaterThan(0);

  // el primero: entra al cierre de ESE día, con el formulario de siempre
  await pendientes.first().getByRole('link', { name: es.inicioPm.cerrarEseDia }).click();
  await expect(page).toHaveURL(/\/cierre\?dia=\d{4}-\d{2}-\d{2}$/);
  const titulo = page.getByRole('heading', { level: 1 });
  await expect(titulo).toHaveText(/^Cerrar el /);
  await expect(titulo).not.toHaveText(es.cierre.titulo);
  await page.getByRole('checkbox', { name: 'Rough de plomería' }).check();
  await tomarFoto(page);
  await page.getByRole('button', { name: es.cierre.cerrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.cierre.listo);
  await expect(page.getByText(es.cierre.fotosListas)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('link', { name: es.cierre.volver }).last().click();
  await expect(pendientes).toHaveCount(faltan - 1);

  // otro día pendiente, sin trabajo: solo el motivo
  if (faltan > 1) {
    await pendientes.first().getByRole('link', { name: es.inicioPm.cerrarEseDia }).click();
    await page.getByRole('checkbox', { name: es.cierre.sinTrabajo }).check();
    await expect(page.getByRole('checkbox', { name: 'Rough de plomería' })).toHaveCount(0);
    await page
      .getByRole('combobox', { name: es.cierre.motivo })
      .selectOption({ label: es.cierre.motivos.clima });
    await page.getByRole('button', { name: es.cierre.cerrar }).click();
    await expect(page.getByRole('status')).toHaveText(es.cierre.listo);
    await page.getByRole('link', { name: es.cierre.volver }).last().click();
    await expect(pendientes).toHaveCount(0);
  }

  // y el de hoy, sin foto: es opcional (D-059)
  await page.getByRole('link', { name: es.inicioPm.cerrarDia }).click();
  await expect(page.getByRole('heading', { name: es.cierre.titulo })).toBeVisible();
  await trabajador(page, es.cierre.cuadrilla, 'Juan')
    .getByRole('combobox')
    .selectOption({ label: es.cierre.diaCompleto });
  await page.getByRole('button', { name: es.cierre.cerrar }).click();
  await expect(page.getByRole('status')).toHaveText(es.cierre.listo);
  await page.getByRole('link', { name: es.cierre.volver }).last().click();
  await expect(page.getByText(es.inicioPm.cerradoHoy)).toBeVisible();
  await expect(page.getByRole('link', { name: es.inicioPm.cerrarDia })).toHaveCount(0);
});
