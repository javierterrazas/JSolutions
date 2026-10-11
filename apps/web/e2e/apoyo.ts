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
  pm: { correo: 'pm1@empresa-a.test', nombre: 'Carlos Méndez', pin: '2468', idioma: 'es' },
  /** el PM que tiene guardado el inglés */
  pmIngles: { correo: 'pm2@empresa-a.test', nombre: 'Luis Ramírez', pin: '1357', idioma: 'en' },
  dueno: { correo: 'dueno@empresa-a.test', nombre: 'Javier', pin: '482915', idioma: 'es' },
} as const;

/** Una foto de verdad para la cámara del teléfono (de las pruebas del legacy): la app la comprime antes de subirla. */
export const FOTO = fileURLToPath(new URL('../../../legacy/pruebas/f_general.jpg', import.meta.url));

/** Las obras del seed de la empresa A, con el PM que la lleva. */
export const OBRAS = {
  carlos: 'a2000000-0000-4000-8000-000000000001',
  luis: 'a2000000-0000-4000-8000-000000000002',
} as const;
export type Quien = keyof typeof MIEMBROS;

function variable(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta ${nombre}: las pruebas de pantalla la leen de apps/web/.env.local`);
  return v;
}

/**
 * Una invitación nueva para el miembro, como la del script invitar-de-nuevo: la base guarda solo el hash del token.
 * Cada prueba que la canjea verifica un celular nuevo (su propio contexto del navegador).
 */
export async function invitacion(quien: Quien): Promise<string> {
  const supabase = createClient(variable('NEXT_PUBLIC_SUPABASE_URL'), variable('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

/** Canjea una invitación en este celular y deja la pantalla de elegir el PIN abierta. */
export async function verificarCelular(page: Page, quien: Quien): Promise<void> {
  await page.goto(`/invitacion/${await invitacion(quien)}`);
  await page.getByRole('button', { name: enAmbos((m) => m.invitacion.boton) }).click();
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

/** Toma una foto con la cámara del teléfono y espera a que la app la tenga lista (la comprime antes). */
export async function tomarFoto(page: Page, idioma: 'es' | 'en' = 'es'): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(FOTO);
  await expect(page.getByText(t[idioma]('fotos.n', { n: 1 }), { exact: true })).toBeVisible();
}
