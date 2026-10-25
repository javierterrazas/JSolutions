// El PIN en pantalla (legacy/pruebas/prueba_pin.py): se escribe oculto con el teclado numérico, el ojo lo muestra
// y lo vuelve a ocultar sin borrarlo, en los dos idiomas; y con él se entra y se vuelve a entrar después de salir.
import { expect, test } from '@playwright/test';
import { datosDelTelefono, en, es, invitacion, MIEMBROS, verificarCelular, type Quien } from './apoyo';

for (const quien of ['pm', 'dueno'] as const satisfies readonly Quien[]) {
  test(`el PIN del ${quien}`, async ({ page }) => {
    const { nombre, pin } = MIEMBROS[quien];
    await verificarCelular(page, quien);

    const campo = page.locator('input[name="pin"]');
    await campo.fill(pin);
    await expect(campo, 'el PIN se escribe oculto').toHaveAttribute('type', 'password');
    await expect(campo, 'con el teclado numérico').toHaveAttribute('inputmode', 'numeric');
    await expect(campo).toHaveAttribute('maxlength', String(pin.length));

    const ojo = page.getByRole('button', { name: es.pin.mostrar }).first();
    await ojo.click();
    await expect(campo, 'el ojo lo muestra para revisarlo').toHaveAttribute('type', 'text');
    await expect(campo).toHaveValue(pin);
    await page.getByRole('button', { name: es.pin.ocultar }).click();
    await expect(campo, 'y lo vuelve a ocultar sin borrar lo tecleado').toHaveAttribute('type', 'password');
    await expect(campo).toHaveValue(pin);

    // en inglés el ojo dice lo suyo, y cambia al tocarlo
    await page.getByRole('button', { name: es.idioma.en }).click();
    await expect(page.getByRole('heading', { name: en.pin.nuevoTitulo })).toBeVisible();
    await page.getByRole('button', { name: en.pin.mostrar }).first().click();
    await expect(page.getByRole('button', { name: en.pin.ocultar })).toBeVisible();
    await page.getByRole('button', { name: en.idioma.es }).click();
    await expect(page.getByRole('button', { name: es.pin.mostrar }).first()).toBeVisible();

    // los dos PIN tienen que ser iguales
    await campo.fill(pin);
    await page.locator('input[name="repetir"]').fill(pin.split('').reverse().join(''));
    await page.getByRole('button', { name: es.pin.guardar }).click();
    await expect(page.getByText(es.errores.pin_no_coincide)).toBeVisible();

    await campo.fill(pin);
    await page.locator('input[name="repetir"]').fill(pin);
    await page.getByRole('button', { name: es.pin.guardar }).click();
    const hola = page.getByRole('heading', { name: es.inicio.hola.replace('{nombre}', nombre) });
    await expect(hola).toBeVisible();

    // al salir pide el PIN; uno equivocado no entra
    await page.getByRole('button', { name: es.inicio.salir }).click();
    await expect(page.getByRole('heading', { name: es.pin.entrarTitulo })).toBeVisible();
    await campo.fill(pin.slice(1) + pin[0]);
    await expect(campo, 'al volver a la pantalla de entrada, el PIN está oculto').toHaveAttribute(
      'type',
      'password',
    );
    await page.getByRole('button', { name: es.pin.entrar }).click();
    await expect(page.getByText(es.errores.pin_incorrecto)).toBeVisible();
    await campo.fill(pin);
    await page.getByRole('button', { name: es.pin.entrar }).click();
    await expect(hola).toBeVisible();

    // solo el PM trabaja sin señal: en el teléfono de nadie más queda la huella del PIN, que lo revelaría (D-054)
    const datos = await datosDelTelefono(page);
    if (quien === 'pm') await expect.poll(() => datosDelTelefono(page)).toContain('pin');
    else expect(datos.filter((c) => c.startsWith('pin'))).toEqual([]);
  });
}

test('en la app instalada del iPhone, que no comparte las cookies de Safari, la invitación se pega (D-057)', async ({
  page,
}) => {
  // un teléfono sin acceso cae en "sin acceso", y ahí pega el mensaje de WhatsApp tal cual
  await page.goto('/');
  await expect(page.getByRole('heading', { name: es.sinAcceso.titulo })).toBeVisible();
  const campo = page.getByRole('textbox', { name: es.sinAcceso.pegar });
  await campo.fill('hola, no es una invitación');
  await page.getByRole('button', { name: es.sinAcceso.abrirInvitacion }).click();
  await expect(page.getByRole('alert').filter({ hasText: es.sinAcceso.noEsInvitacion })).toBeVisible();

  const token = await invitacion('pm');
  await campo.fill(`Hola Carlos, tu invitación: http://localhost/invitacion/${token} (vale 7 días)`);
  await page.getByRole('button', { name: es.sinAcceso.abrirInvitacion }).click();
  await page.getByRole('button', { name: es.invitacion.boton }).click();
  await expect(page).toHaveURL(/\/pin\/nuevo$/);
});

test('abierta dentro de Instagram, la invitación avisa que el acceso se quedaría ahí; en Android la abre en Chrome (D-116)', async ({
  browser,
}) => {
  const token = await invitacion('pm');
  const iphone = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.3.12.235',
  });
  const p1 = await iphone.newPage();
  await p1.goto(`/invitacion/${token}`);
  const aviso = p1
    .getByRole('alert')
    .filter({ hasText: es.invitacion.interno.titulo.replace('{app}', 'Instagram') });
  await expect(aviso).toContainText(es.invitacion.interno.pasos);
  await expect(aviso.getByRole('link', { name: es.invitacion.interno.abrirChrome })).toHaveCount(0);
  await iphone.close();

  const android = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36 Instagram 330.0.0.40.92 Android',
  });
  const p2 = await android.newPage();
  await p2.goto(`/invitacion/${token}`);
  await expect(p2.getByRole('link', { name: es.invitacion.interno.abrirChrome })).toHaveAttribute(
    'href',
    new RegExp(`^intent://[^/]+/invitacion/${token}#Intent;scheme=http;package=com\.android\.chrome;end$`),
  );
  await android.close();
});
