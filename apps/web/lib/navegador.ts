// El navegador interno de una red social (D-116): Instagram, Facebook y otras abren los enlaces dentro de su propia app,
// con su propio acceso guardado. Una invitación canjeada ahí deja el acceso dentro de esa app, no en Safari, Chrome ni
// en la app instalada. Se reconocen por el user-agent. El de WhatsApp en el iPhone no se distingue de Safari.

const INTERNOS: readonly (readonly [RegExp, string])[] = [
  // Messenger antes que Facebook: su user-agent también dice FBAN
  [/MessengerForiOS|MessengerLite|Orca-Android/i, 'Messenger'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, 'Facebook'],
  [/musical_ly|TikTok|BytedanceWebview/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/\bLine\//i, 'LINE'],
];

/** La app dentro de la que se abrió el enlace, o null si es un navegador de verdad (o no se sabe). */
export function navegadorInterno(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return INTERNOS.find(([re]) => re.test(userAgent))?.[1] ?? null;
}

export const esAndroid = (userAgent: string | null | undefined): boolean => /Android/i.test(userAgent ?? '');

/** En Android, un enlace que abre la misma dirección en Chrome desde el navegador interno. */
export function abrirEnChrome(enlace: string): string {
  const u = new URL(enlace);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
}
