// El seguimiento de una obra para el dueño (D-062), con OB-001 del seed: el baño con la demolición terminada, $1,500
// presupuestados y $5,100 gastados (ya se pasó), y el cierre del 5 de octubre con Pedro 8 horas. Otras pruebas pueden
// haber cerrado más días antes que esta: lo que se revisa no depende de eso.
import { expect, test } from '@playwright/test';
import { entrar, es, OBRAS, t } from './apoyo';

test('el dueño ve cómo va la obra: avance, etapa, presupuesto por etapa, cuadrilla y el día a día', async ({
  page,
}) => {
  await entrar(page, 'dueno');
  await page.getByRole('link', { name: es.inicio.obras, exact: true }).click();
  const tarjeta = page.getByRole('link', { name: /OB-001 · Familia García/ });
  await expect(tarjeta).toContainText(/\d+% terminado · presupuesto \d+%/);
  await expect(tarjeta).toContainText(/ · entrega \d+ oct 2026/);

  await tarjeta.click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.carlos}/seguimiento$`));
  await expect(page.getByRole('heading', { level: 1, name: 'OB-001 · Familia García' })).toBeVisible();
  await expect(page.getByText(/\d+% terminado/).first()).toBeVisible();
  await expect(page.getByText(es.seguimiento.semaforo.rojo)).toBeVisible();

  // los datos del cliente: el teléfono para llamarle, la dirección en el mapa, el contrato y la entrega
  await expect(page.getByRole('heading', { level: 2, name: es.seguimiento.datos })).toBeVisible();
  await expect(page.getByRole('link', { name: '512-555-0101' })).toHaveAttribute('href', 'tel:512-555-0101');
  await expect(page.getByRole('link', { name: '1200 Oak St, Austin, TX' })).toHaveAttribute(
    'href',
    /maps\.google\.com/,
  );
  await expect(page.getByText('$24,000')).toBeVisible();
  await expect(
    page.getByText(/^Originalmente .+30 de octubre; se movió por órdenes de cambio\.$/),
  ).toBeVisible();

  for (const seccion of ['espacios', 'porEtapa', 'cuadrilla', 'diaADia'] as const)
    await expect(page.getByRole('heading', { level: 2, name: es.seguimiento[seccion] })).toBeVisible();
  await expect(
    page.getByText(t.es('seguimiento.etapaDe', { espacio: 'Baño principal', etapa: 'Demolición' }), {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/^Pedro · \d+ horas$/)).toBeVisible();
  // con un toque, sus horas por etapa (D-077)
  await page.getByText(/^Pedro · \d+ horas$/).click();
  await expect(page.locator('details[open]').filter({ hasText: 'Pedro' })).toContainText(
    /Demolición\s*≈ \d+(\.\d)? horas?/,
  );

  // el día a día llega hasta el arranque: en la última página está el cierre del 5 de octubre
  while (await page.getByRole('link', { name: es.seguimiento.anteriores }).isVisible())
    await page.getByRole('link', { name: es.seguimiento.anteriores }).click();
  const primerDia = page.locator('li').filter({ hasText: 'BIT-0001' });
  await expect(primerDia).toContainText(
    t.es('seguimiento.partidaTerminada', {
      espacio: 'Baño principal',
      partida: 'Demolición y retiro de escombro',
    }),
  );
  await expect(primerDia).toContainText(
    t.es('seguimiento.gastoOficina', { proveedor: 'Ferguson', monto: '$2,500.00' }),
  );
  await expect(primerDia).toContainText(t.es('seguimiento.llego', { sub: 'Plomería Rápida' }));

  // y lleva a capturar el presupuesto y a las fotos
  await page.getByRole('link', { name: es.obras.presupuesto }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.carlos}/presupuesto$`));
});

test('el dueño corrige los datos del cliente y le cambia el PM a la obra', async ({ page }) => {
  await entrar(page, 'dueno');
  await page.goto(`/obras/${OBRAS.luis}/seguimiento`);
  await page.getByRole('link', { name: es.seguimiento.corregir }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.luis}/datos$`));
  const telefono = page.locator('input[name="telefono"]');
  const pm = page.locator('select[name="pmId"]');
  await expect(telefono).toHaveValue('512-555-0102');
  await expect(pm.locator('option:checked')).toHaveText('Luis Ramírez');

  // un teléfono incompleto se rechaza sin perder lo capturado
  await telefono.fill('555-01');
  await page.getByRole('button', { name: es.datosObra.guardar }).click();
  await expect(page.getByText(es.errores.telefono_incompleto)).toBeVisible();
  await expect(telefono).toHaveValue('555-01');

  await telefono.fill('512-555-0199');
  await pm.selectOption({ label: 'Carlos Méndez' });
  await expect(page.getByText(es.datosObra.cambioDePm)).toBeVisible();
  await page.getByRole('button', { name: es.datosObra.guardar }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.luis}/seguimiento$`));
  await expect(page.getByRole('link', { name: '512-555-0199' })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: 'Carlos Méndez' })).toBeVisible();

  // y se regresa como estaba: las pruebas que siguen usan OB-002 de Luis
  await page.getByRole('link', { name: es.seguimiento.corregir }).click();
  await telefono.fill('512-555-0102');
  await pm.selectOption({ label: 'Luis Ramírez' });
  await page.getByRole('button', { name: es.datosObra.guardar }).click();
  await expect(page.locator('dd').filter({ hasText: 'Luis Ramírez' })).toBeVisible();
});

test('el PM no entra al seguimiento', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto(`/obras/${OBRAS.carlos}/seguimiento`);
  await expect(page).not.toHaveURL(/seguimiento/);
});
