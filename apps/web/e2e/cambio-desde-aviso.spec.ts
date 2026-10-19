// La orden de cambio que sale de un aviso del PM, y corregirla antes de que el cliente responda (D-103), con el aviso
// del seed en la obra de Luis ("Hay humedad detrás del muro de la regadera", condición oculta).
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS } from './apoyo';

test('el dueño hace la orden de cambio desde el aviso del PM y la corrige antes de que el cliente responda', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.goto('/avisos');
  const aviso = page.locator('li').filter({ has: page.locator(`a[href*="${OBRAS.luis}/cambios?aviso="]`) });
  await aviso.getByRole('link', { name: es.avisosAbiertos.hacerOrden }).click();

  // ya viene con lo que escribió el PM y el motivo que le toca
  await expect(page.getByRole('heading', { level: 1, name: es.cambios.titulo })).toBeVisible();
  await expect(page.getByText('Hay humedad detrás del muro de la regadera').first()).toBeVisible();
  await expect(page.locator('select[name="motivo"]')).toHaveValue('condicion_oculta');
  await expect(page.locator('textarea[name="descripcion"]')).toHaveValue(
    'Hay humedad detrás del muro de la regadera',
  );

  // se describe como se le va a explicar al cliente
  await page
    .locator('textarea[name="descripcion"]')
    .fill('Abrir el muro de la regadera, secar y cambiar la barrera de vapor');
  await page.locator('input[name="costo"]').fill('650');
  await page.locator('input[name="precio"]').fill('1000');
  await page.getByRole('button', { name: es.cambios.emitir }).click();
  await expect(page.getByRole('status')).toContainText(/^OC-\d{4} emitida y el aviso BLQ-\d+ contestado/);

  // en la lista, con el aviso del que salió; mientras el cliente no responde, se corrige
  const orden = page.locator('li').filter({ hasText: 'Abrir el muro de la regadera' });
  await expect(orden).toContainText(/Del aviso BLQ-\d+ · Condición oculta/);
  await orden.getByRole('button', { name: es.cambios.editar }).click();
  await orden
    .locator('textarea[name="descripcion"]')
    .fill('Abrir el muro de la regadera, secar, cambiar la barrera de vapor y volver a poner el tile');
  await orden.locator('input[name="precio"]').fill('1200');
  await orden.getByRole('button', { name: es.cambios.guardar }).click();
  await expect(orden.getByRole('status')).toContainText(/^OC-\d{4} actualizada/);
  await orden.getByRole('button', { name: es.cambios.cerrar }).click();
  await expect(orden).toContainText('volver a poner el tile');
  await expect(orden).toContainText('$1,200.00');

  // el aviso ya no está por contestar
  await page.goto('/avisos');
  await expect(page.locator(`a[href*="${OBRAS.luis}/cambios?aviso="]`)).toHaveCount(0);
});
