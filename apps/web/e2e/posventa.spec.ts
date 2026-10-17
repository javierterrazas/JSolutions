// Los retrabajos, las garantías y lo de después de la entrega (D-090): el dueño registra un retrabajo en obra; ya
// cerrada, marca la reseña, registra un reclamo de garantía (sale en sus pendientes) y lo atiende.
import { expect, test } from '@playwright/test';
import { admin, entrar, es, obraNueva } from './apoyo';

test('retrabajo en obra; cerrada, la reseña y un reclamo de garantía que se atiende', async ({
  page,
  browser,
}) => {
  const cliente = `Posventa ${Date.now()}`;
  const obraId = await obraNueva(browser, cliente);
  await admin().from('obras').update({ estado: 'en_obra' }).eq('id', obraId);

  await entrar(page, 'dueno');
  await page.goto(`/obras/${obraId}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.retrabajos }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.retrabajos.titulo })).toBeVisible();
  // en obra no hay garantías todavía
  await expect(page.getByRole('radio', { name: es.retrabajos.tipos.garantia })).toBeDisabled();
  await page.getByLabel(es.retrabajos.descripcion).fill('Repetir una hilada de tile chueca');
  await page.getByLabel(es.retrabajos.causa).selectOption('error_instalacion');
  await page.getByLabel(es.retrabajos.costo).fill('320');
  await page.getByLabel(es.retrabajos.dias).fill('1');
  await page.getByRole('button', { name: es.retrabajos.registrarRetrabajo }).click();
  await expect(page.getByRole('status')).toHaveText(/^Registrado: NC-\d{4}\.$/);
  await expect(page.getByText('Repetir una hilada de tile chueca')).toBeVisible();
  await expect(page.getByText(/Error de instalación · 1 día perdido/)).toBeVisible();

  // se cierra la obra
  await page.goto(`/obras/${obraId}/cerrar`);
  await page.getByRole('button', { name: es.cerrarObra.cerrar }).click();
  await page.getByRole('button', { name: es.cerrarObra.cerrarDeTodosModos }).click();
  await expect(page.getByRole('status')).toHaveText(/^Obra cerrada/);

  // después de la entrega: la reseña se marca y se queda marcada
  await page.reload();
  await expect(page.getByRole('heading', { name: es.cerrarObra.despues })).toBeVisible();
  const resena = page.getByRole('checkbox', { name: es.posventa.pasos.resena_pedida });
  await resena.check();
  await expect(resena).toBeChecked();
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: es.posventa.pasos.resena_pedida })).toBeChecked();

  // un reclamo de garantía: nace abierto y sale en los pendientes
  await page.getByRole('link', { name: es.cerrarObra.reclamo }).click();
  await expect(page.getByRole('radio', { name: es.retrabajos.tipos.garantia })).toBeChecked();
  await page.getByLabel(es.retrabajos.descripcion).fill('Gotea la llave de la regadera');
  await page.getByRole('button', { name: es.retrabajos.registrarGarantia }).click();
  await expect(page.getByRole('status')).toHaveText(/^Registrado: NC-\d{4}\.$/);
  await page.goto('/');
  await page.getByRole('link', { name: /después de la entrega$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.posventa.titulo })).toBeVisible();
  await page
    .getByRole('link', { name: new RegExp(cliente) })
    .first()
    .click();

  // se atiende con lo que costó
  await expect(page.getByText(es.retrabajos.abierta)).toBeVisible();
  await page.getByLabel(es.retrabajos.costoAtender).fill('150');
  await page.getByRole('button', { name: es.retrabajos.cerrarGarantia }).click();
  await expect(page.getByText(/^Atendida el /)).toBeVisible();
  await expect(page.getByText(es.retrabajos.abierta)).toHaveCount(0);
});
