// Cerrar una obra al entregarla (D-085): el dueño ve sus números finales y lo que falta; con algo grave, confirma, y
// la obra queda entregada, con su resumen guardado.
import { expect, test } from '@playwright/test';
import { admin, entrar, es, obraNueva } from './apoyo';

test('el dueño revisa lo que falta y cierra la obra; ya cerrada, ve su resumen', async ({
  page,
  browser,
}) => {
  const obraId = await obraNueva(browser, `Cierre ${Date.now()}`);
  // la obra ya arrancó (lo hace el primer cierre del día del PM; aquí se prepara directo)
  await admin().from('obras').update({ estado: 'en_obra' }).eq('id', obraId);

  await entrar(page, 'dueno');
  await page.goto(`/obras/${obraId}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.cerrarObra }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.cerrarObra.titulo })).toBeVisible();
  // nada cobrado y nada terminado: lo grave arriba
  await expect(page.getByText(/^Grave: Faltan \$[\d,.]+ por cobrarle al cliente\.$/)).toBeVisible();
  await expect(page.getByText(/partidas sin terminar/)).toBeVisible();

  await page.getByRole('button', { name: es.cerrarObra.cerrar }).click();
  await expect(page.getByText(es.cerrarObra.confirmar)).toBeVisible();
  await page.getByRole('button', { name: es.cerrarObra.cerrarDeTodosModos }).click();
  // cerrada, la pantalla muestra su resumen
  await expect(page.getByRole('status')).toHaveText(/^Obra cerrada; se entregó el/);

  // cerrada: el seguimiento lleva a su cierre, que ya no se puede repetir
  await page.goto(`/obras/${obraId}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.verCierre }).click();
  await expect(page.getByText(/^Obra cerrada; se entregó el/)).toBeVisible();
  await expect(page.getByRole('button', { name: es.cerrarObra.cerrar })).toHaveCount(0);
});
