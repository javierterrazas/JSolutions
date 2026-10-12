// Lo que comparten las pruebas de pantalla: los textos de la app y entrar como un miembro del seed.
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';
import en from '../mensajes/en.json' with { type: 'json' };
import es from '../mensajes/es.json' with { type: 'json' };

/** Los textos se leen de los mensajes de la app: una prueba no se rompe porque cambió una palabra. */
export { en, es };

/** Los textos con datos ({n}, {nombre}…), formateados como en la app. */
export const t = {
  es: createTranslator({ locale: 'es', messages: es }),
  en: createTranslator({ locale: 'en', messages: en }),
};

/** Los miembros del seed (supabase/seed.sql) con los que entran las pruebas, con un PIN que la base acepta. */
export const MIEMBROS = {
  pm: { correo: 'pm1@empresa-a.test', nombre: 'Carlos Méndez', pin: '5170', idioma: 'es' },
  /** el PM que tiene guardado el inglés */
  pmIngles: { correo: 'pm2@empresa-a.test', nombre: 'Luis Ramírez', pin: '3859', idioma: 'en' },
  dueno: { correo: 'dueno@empresa-a.test', nombre: 'Javier', pin: '482915', idioma: 'es' },
} as const;

/** Una foto de verdad para la cámara del teléfono (de las pruebas del legacy): la app la comprime antes de subirla. */
export const FOTO = fileURLToPath(new URL('../../../legacy/pruebas/f_general.jpg', import.meta.url));

/** Las obras del seed de la empresa A, con el PM que la lleva. */
export const OBRAS = {
  carlos: 'a2000000-0000-4000-8000-000000000001',
  luis: 'a2000000-0000-4000-8000-000000000002',
  /** de Carlos, ya entregada: el seed le pone garantía hasta el 2027-10-30 */
  carlosEntregada: 'a2000000-0000-4000-8000-000000000003',
} as const;
export type Quien = keyof typeof MIEMBROS;

function variable(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta ${nombre}: las pruebas de pantalla la leen de apps/web/.env.local`);
  return v;
}

/**
 * La base local con la llave secreta, sin RLS: para preparar lo que la app no hace (una invitación) y para revisar
 * lo que quedó guardado. Nunca para hacer lo que la prueba debe hacer en la pantalla.
 */
export function admin() {
  return createClient(variable('NEXT_PUBLIC_SUPABASE_URL'), variable('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Hoy en la zona de la empresa, "AAAA-MM-DD", más `dias`. */
export function hoy(dias = 0): string {
  const d = new Date(Date.now() + dias * 24 * 3600 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(d);
}

/**
 * Una invitación nueva para el miembro, como la del script invitar-de-nuevo: la base guarda solo el hash del token.
 * Cada prueba que la canjea verifica un celular nuevo (su propio contexto del navegador).
 */
export async function invitacion(quien: Quien): Promise<string> {
  const supabase = admin();
  const { data: usuarios, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const userId = usuarios.users.find((u) => u.email === MIEMBROS[quien].correo)?.id;
  const { data: m, error: e2 } = await supabase
    .from('miembros')
    .select('id, empresa_id')
    .eq('user_id', userId ?? '')
    .single();
  if (e2) throw e2;
  const token = randomBytes(32).toString('base64url');
  const { error: e3 } = await supabase.from('invitaciones').insert({
    empresa_id: m.empresa_id,
    miembro_id: m.id,
    token_hash: createHash('sha256').update(token, 'utf8').digest('hex'),
    expira_en: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  if (e3) throw e3;
  return token;
}

/** Un texto de la app en cualquiera de los dos idiomas: antes de entrar, la pantalla sigue al navegador. */
function enAmbos(texto: (m: typeof es) => string): RegExp {
  const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^(${escapar(texto(es))}|${escapar(texto(en as typeof es))})$`);
}

/**
 * Canjea una invitación en este celular y deja la pantalla de elegir el PIN abierta. Si el celular ya era de otro
 * miembro, continúa de todos modos (D-038).
 */
export async function verificarCelular(page: Page, quien: Quien): Promise<void> {
  await page.goto(`/invitacion/${await invitacion(quien)}`);
  await page
    .getByRole('button', { name: enAmbos((m) => m.invitacion.boton) })
    .or(page.getByRole('button', { name: enAmbos((m) => m.invitacion.botonReemplazar) }))
    .click();
  await expect(page).toHaveURL(/\/pin\/nuevo$/);
}

/**
 * Entra como el miembro: verifica el celular, elige su PIN y llega al inicio, en el idioma que tiene guardado (el
 * del seed, si no se dice otro).
 */
export async function entrar(
  page: Page,
  quien: Quien,
  idioma: 'es' | 'en' = MIEMBROS[quien].idioma,
): Promise<void> {
  const { nombre, pin } = MIEMBROS[quien];
  await verificarCelular(page, quien);
  await page.locator('input[name="pin"]').fill(pin);
  await page.locator('input[name="repetir"]').fill(pin);
  await page.getByRole('button', { name: enAmbos((m) => m.pin.guardar) }).click();
  const hola = (idioma === 'en' ? en : es).inicio.hola.replace('{nombre}', nombre);
  await expect(page.getByRole('heading', { name: hola })).toBeVisible();
}

/** Otro teléfono, para otra persona en la misma prueba (el dueño y el PM), con lo mismo que playwright.config. */
export function otroCelular(browser: Browser, opciones: BrowserContextOptions = {}): Promise<BrowserContext> {
  const { locale, timezoneId, baseURL } = test.info().project.use;
  return browser.newContext({ ...devices['Pixel 7'], locale, timezoneId, baseURL, ...opciones });
}

/**
 * Toma una foto con la cámara del teléfono y espera a que la app la tenga lista (la comprime antes): `n` es cuántas
 * lleva con esta.
 */
export async function tomarFoto(page: Page, idioma: 'es' | 'en' = 'es', n = 1): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(FOTO);
  await expect(page.getByText(t[idioma]('fotos.n', { n }), { exact: true })).toBeVisible();
}

/**
 * Una obra nueva para el PM, con un baño y su presupuesto completo, dada de alta por el dueño en su pantalla desde
 * otro teléfono: así una prueba tiene un día de hoy sin cerrar, pase lo que pase en las demás. Devuelve su id.
 */
export async function obraNueva(browser: Browser, cliente: string, pm = MIEMBROS.pm.nombre): Promise<string> {
  const oficina = await otroCelular(browser);
  try {
    const page = await oficina.newPage();
    await entrar(page, 'dueno');
    await page.goto('/obras/nueva');
    const o = es.obraNueva;
    await page.getByRole('textbox', { name: o.cliente, exact: true }).fill(cliente);
    await page.getByRole('textbox', { name: o.telefono, exact: true }).fill('512-555-0190');
    await page.getByRole('textbox', { name: o.direccion, exact: true }).fill(`${cliente} 100, Austin, TX`);
    await page.getByRole('combobox', { name: o.pm, exact: true }).selectOption({ label: pm });
    await page.getByLabel(o.inicio, { exact: true }).fill(hoy());
    await page.getByLabel(o.entrega, { exact: true }).fill(hoy(30));
    await page.getByRole('textbox', { name: o.contrato, exact: true }).fill('20000');
    await page.getByRole('combobox', { name: o.tipo, exact: true }).selectOption({ label: 'Baño' });
    await page.getByRole('textbox', { name: o.pies2, exact: true }).fill('45');
    await page.getByRole('button', { name: o.crear, exact: true }).click();
    await expect(page).toHaveURL(/\/obras\/[0-9a-f-]{36}\/presupuesto$/);
    for (const monto of await page.locator('fieldset').getByRole('textbox').all()) await monto.fill('1000');
    await page.getByRole('button', { name: es.presupuesto.guardar }).click();
    await expect(page.getByRole('status')).toHaveText(es.presupuesto.completo);
    return page.url().split('/').at(-2)!;
  } finally {
    await oficina.close();
  }
}

/** Las claves que la app guardó en la bodega `datos` del teléfono (IndexedDB, lib/almacen.ts). */
export function datosDelTelefono(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((listo, falla) => {
        const pedido = indexedDB.open('ijm');
        pedido.onerror = () => falla(pedido.error);
        pedido.onsuccess = () => {
          const db = pedido.result;
          if (!db.objectStoreNames.contains('datos')) return listo([]);
          const claves = db.transaction('datos').objectStore('datos').getAllKeys();
          claves.onsuccess = () => listo(claves.result.map(String).sort());
          claves.onerror = () => falla(claves.error);
        };
      }),
  );
}
