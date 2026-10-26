// La checada con GPS y selfie (D-117): con el módulo prendido, el PM fija la ubicación de su obra, el dueño le manda la
// checada a Pedro, Pedro la activa en su celular y checa entrada (lejos no puede) y salida con la cámara; el dueño ve
// sus checadas con la selfie y el PM ve la cuadrilla del cierre ya llenada.
import { MODULOS } from '@ijm/core';
import { expect, test, type Browser } from '@playwright/test';
import { admin, entrar, es, OBRAS, otroCelular } from './apoyo';

const EMPRESA_A = 'e000000a-0000-4000-8000-000000000000';
const OBRA = { latitude: 30.2672, longitude: -97.7431, accuracy: 10 };
const LEJOS = { latitude: 30.2772, longitude: -97.7431, accuracy: 10 };

const celular = (browser: Browser, donde = OBRA) =>
  otroCelular(browser, { geolocation: donde, permissions: ['geolocation', 'camera'] });

test('el trabajador checa entrada y salida dentro de la obra, con selfie; el dueño y el PM lo ven', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  await admin()
    .from('empresas')
    .update({ modulos: [...MODULOS] })
    .eq('id', EMPRESA_A);
  try {
    // el PM, en la obra, fija su ubicación
    const pm = await (await celular(browser)).newPage();
    await entrar(pm, 'pm');
    await pm.goto(`/obras/${OBRAS.carlos}/ubicacion`);
    await expect(pm.getByText(es.ubicacion.sinFijar)).toBeVisible();
    await pm.getByRole('button', { name: es.ubicacion.fijarAqui }).click();
    await expect(pm.getByRole('status')).toHaveText(es.ubicacion.guardada);

    // el dueño le manda la checada a Pedro
    const dueno = await (await celular(browser)).newPage();
    await entrar(dueno, 'dueno');
    await dueno.goto('/cuadrilla');
    const pedro = dueno.getByRole('listitem').filter({ has: dueno.getByText('Pedro', { exact: true }) });
    await pedro.getByRole('button', { name: es.checada.invitar }).click();
    const enlace = await pedro.getByRole('textbox', { name: es.checada.copiar }).inputValue();
    expect(enlace).toMatch(/\/checar\/invitacion\/[\w-]{43}$/);

    // Pedro la activa; lejos de la obra no puede checar
    const lejos = await celular(browser, LEJOS);
    const p = await lejos.newPage();
    await p.goto(enlace);
    await p.getByRole('button', { name: es.checada.activar }).click();
    await expect(
      p.getByRole('heading', { name: es.checada.hola.replace('{nombre}', 'Pedro') }),
    ).toBeVisible();
    await p.getByRole('button', { name: es.checada.checarEntrada }).click();
    await p.getByRole('button', { name: es.checada.tomarFoto }).click();
    await expect(p.getByText(/^Estás a \d+ m de OB-001/)).toBeVisible();

    // en la obra, sí: entrada y salida con su selfie
    await lejos.setGeolocation(OBRA);
    await p.getByRole('button', { name: es.checada.checarEntrada }).click();
    await p.getByRole('button', { name: es.checada.tomarFoto }).click();
    await expect(p.getByRole('status')).toContainText('Entrada registrada en OB-001');
    await expect(p.getByText(es.checada.dentro.replace('{obra}', 'OB-001'))).toBeVisible();
    await p.getByRole('button', { name: es.checada.checarSalida }).click();
    await p.getByRole('button', { name: es.checada.tomarFoto }).click();
    await expect(p.getByRole('status')).toContainText('Salida registrada en OB-001');
    await expect(p.getByText(es.checada.fueraDeTurno)).toBeVisible();

    // el dueño ve la checada con sus dos selfies
    await dueno.goto('/checadas');
    const checada = dueno.getByRole('listitem').filter({ hasText: 'Pedro' });
    await expect(checada).toContainText('OB-001');
    await expect(checada.getByRole('img', { name: es.checadas.selfie })).toHaveCount(2);
    const foto = await dueno.request.get(
      (await checada.getByRole('img', { name: es.checadas.selfie }).first().getAttribute('src'))!,
      { maxRedirects: 0 },
    );
    expect(foto.status()).toBe(307);

    // el PM ya no captura la cuadrilla: la ve de la checada
    await pm.goto(`/obras/${OBRAS.carlos}/cierre`);
    const cuadrilla = pm.locator('fieldset').filter({ hasText: es.cierre.cuadrillaChecada });
    await expect(cuadrilla).toContainText('Pedro');
  } finally {
    await admin()
      .from('empresas')
      .update({ modulos: MODULOS.filter((m) => m !== 'checada') })
      .eq('id', EMPRESA_A);
  }
});
