// La calidad en pantalla (legacy/pruebas/prueba_calidad_ui.js y prueba_noaplica_ui.py), con el seed:
// - en OB-001 de Carlos, el PC1 del baño ya aprobado: "No aplica", una inspección con defecto y volver a aprobarla
//   revisando solo lo que falló (D-092);
// - en OB-002 de Luis (en inglés), un baño que el dueño agrega con su presupuesto: su demolición sin inspeccionar
//   no se deja terminar en el cierre, que lleva a la inspección; aprobada, ya se puede marcar terminada (el caso que
//   dejaba al PM atorado).
import { expect, type Page, test } from '@playwright/test';
import { en, entrar, es, OBRAS, otroCelular, t, tomarFoto } from './apoyo';

const PREGUNTA = 'Estructura visible sin daño por agua ni termita';
const ESPACIO = 'Baño de visitas';

/** La tarjeta de un punto de control en la pantalla de calidad. */
const tarjeta = (page: Page, hito: string) => page.locator('li').filter({ hasText: hito });

test('la inspección: No aplica, un defecto y aprobarla otra vez', async ({ page }) => {
  await entrar(page, 'pm');
  await page.goto(`/obras/${OBRAS.carlos}/calidad`);
  await expect(page.getByRole('heading', { level: 2, name: 'Baño principal' })).toBeVisible();
  const pc1 = tarjeta(page, 'PC1 Post demolición');
  await expect(pc1).toContainText(es.calidad.aprobada);
  await expect(pc1).toContainText(/ · 1 de 1 puntos/);

  await pc1.getByRole('link', { name: es.calidad.inspeccionarOtraVez }).click();
  await expect(page.getByRole('heading', { name: 'PC1 Post demolición' })).toBeVisible();
  await expect(page.getByText('OB-001 · Familia García · Baño principal')).toBeVisible();

  const pregunta = page.getByRole('button', { name: new RegExp(PREGUNTA) });
  const noAplica = page.getByRole('button', { name: es.calidad.noAplica, exact: true });
  const guardar = page.getByRole('button', { name: es.calidad.guardar });

  // "No aplica": se ve tachada, con un guion, y una inspección necesita al menos una que aplique
  await noAplica.click();
  await expect(noAplica).toHaveAttribute('aria-pressed', 'true');
  await expect(pregunta).toHaveClass(/line-through/);
  await expect(pregunta).toContainText('—');
  await guardar.click();
  await expect(page.getByRole('alert').filter({ hasText: es.calidad.ningunoAplica })).toBeVisible();

  // tocar la pregunta le quita el "No aplica" y la marca como cumple
  await pregunta.click();
  await expect(noAplica).toHaveAttribute('aria-pressed', 'false');
  await expect(pregunta).toHaveAttribute('aria-pressed', 'true');
  await expect(pregunta).toContainText('✓');

  // marcada como cumple, la pregunta crítica pide su foto (D-058)
  await expect(page.getByText(t.es('calidad.fotosPiden', { n: 1 }))).toBeVisible();
  await guardar.click();
  await expect(
    page.getByRole('alert').filter({ hasText: t.es('calidad.fotosFaltan', { n: 1 }) }),
  ).toBeVisible();

  // sin marcar es un defecto: entonces ya no pide foto, y se guarda sin ella
  await pregunta.click();
  await expect(pregunta).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(es.calidad.fotosOpcionales)).toBeVisible();
  let pregunto = '';
  page.once('dialog', (d) => {
    pregunto = d.message();
    void d.accept();
  });
  await guardar.click();
  await expect(page.getByRole('status')).toHaveText(t.es('calidad.guardadaConDefectos', { n: 1 }));
  expect(pregunto, 'antes de guardar, pregunta por el defecto').toBe(
    t.es('calidad.confirmarDefectos', { n: 1 }),
  );

  // al volver, regresa a Calidad (no al inicio), con el defecto
  await page.getByRole('link', { name: es.calidad.volverCalidad }).last().click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.carlos}/calidad$`));
  await expect(pc1).toContainText(es.calidad.conDefectos);
  await expect(pc1).toContainText(/ · 0 de 1 puntos/);

  // se reinspecciona solo lo que falló (D-092), con "Todo cumple", y queda aprobada
  await pc1.getByRole('link', { name: es.calidad.inspeccionarOtraVez }).click();
  await expect(page.getByText(t.es('calidad.soloFallaron', { n: 1 }))).toBeVisible();
  await page.getByRole('button', { name: es.calidad.todoCumple }).click();
  await expect(pregunta).toHaveAttribute('aria-pressed', 'true');
  await tomarFoto(page);
  await guardar.click();
  await expect(page.getByRole('status')).toHaveText(es.calidad.guardadaAprobada);
  await page.getByRole('link', { name: es.calidad.volverCalidad }).last().click();
  await expect(pc1).toContainText(es.calidad.aprobada);

  // en inglés el botón dice "N/A" y la ayuda lo explica
  await pc1.getByRole('link', { name: es.calidad.inspeccionarOtraVez }).click();
  await page.getByRole('button', { name: es.idioma.en }).click();
  await expect(page.getByRole('button', { name: en.calidad.noAplica, exact: true })).toBeVisible();
  await expect(page.getByText(en.calidad.ayudaInspeccion)).toBeVisible();
  await page.getByRole('button', { name: en.idioma.es }).click();
  await expect(noAplica).toBeVisible();
});

test('una partida sin su inspección: el cierre lleva a hacerla y después deja terminarla', async ({
  page,
  browser,
}) => {
  // el dueño agrega un baño a OB-002 y le pone su presupuesto: su demolición queda sin inspeccionar
  const oficina = await otroCelular(browser);
  try {
    const dueno = await oficina.newPage();
    await entrar(dueno, 'dueno');
    await dueno.goto(`/obras/${OBRAS.luis}/presupuesto`);
    await dueno.getByRole('button', { name: es.presupuesto.agregarEspacio }).click();
    await dueno.getByRole('combobox', { name: es.obraNueva.tipo }).selectOption({ label: 'Baño' });
    await dueno.getByRole('textbox', { name: es.obraNueva.nombreEspacio }).fill(ESPACIO);
    await dueno.getByRole('textbox', { name: es.obraNueva.pies2 }).fill('40');
    await dueno.getByRole('button', { name: es.presupuesto.agregarEspacio }).click();
    // de cada etapa, su costo (D-084)
    const montos = dueno
      .locator('fieldset')
      .filter({ hasText: ESPACIO })
      .getByRole('textbox', { name: /^Costo de / });
    await expect(montos).toHaveCount(2);
    const total = dueno.locator('p').filter({ hasText: es.presupuesto.costoTotal });
    const totalAntes = await total.innerText();
    for (const monto of await montos.all()) await monto.fill('1500');
    // los montos no son type=number (legacy/pruebas/prueba_numeros_ui.py): sin flechitas, la rueda no los cambia,
    // y el total se actualiza al escribir
    await expect(montos.first()).not.toHaveAttribute('type', 'number');
    await montos.first().hover();
    await dueno.mouse.wheel(0, 300);
    await expect(montos.first()).toHaveValue('1500');
    await expect(total).not.toHaveText(totalAntes);
    await dueno.getByRole('button', { name: es.presupuesto.guardar }).click();
    await expect(dueno.getByRole('status')).toHaveText(es.presupuesto.completo);
  } finally {
    await oficina.close();
  }

  await entrar(page, 'pmIngles');
  await page.goto(`/obras/${OBRAS.luis}/cierre`);
  const partida = page.locator('fieldset > div').filter({ hasText: ESPACIO });
  const demolicion = partida.getByRole('checkbox', { name: 'Demolición y retiro de escombro' });
  const terminada = partida.getByRole('checkbox', { name: en.cierre.terminada });
  await demolicion.check();
  await expect(partida.getByText(t.en('cierre.faltaInspeccion', { hito: 'PC1' }))).toBeVisible();
  await expect(terminada).toHaveCount(0);

  // le dice dónde hacerla, y en Calidad el PC1 de ESE baño sí tiene cómo inspeccionarse, aunque la partida no haya
  // arrancado ("todavía no")
  await partida.getByRole('link', { name: en.cierre.hacerInspeccion }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${OBRAS.luis}/calidad$`));
  const pc1 = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: ESPACIO }) })
    .locator('li')
    .filter({ hasText: 'PC1 Post demolition' });
  await expect(pc1).toContainText(en.calidad.todaviaNo);
  await pc1.getByRole('link', { name: en.calidad.inspeccionar }).click();
  await expect(page.getByText(`OB-002 · Familia Smith · ${ESPACIO}`)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(PREGUNTA) }).click();
  await tomarFoto(page, 'en');
  await page.getByRole('button', { name: en.calidad.guardar }).click();
  await expect(page.getByRole('status')).toHaveText(en.calidad.guardadaAprobada);

  // de vuelta en el cierre, la demolición ya se puede marcar terminada
  await page.goto(`/obras/${OBRAS.luis}/cierre`);
  await demolicion.check();
  await terminada.check();
  await expect(terminada).toBeChecked();
});
