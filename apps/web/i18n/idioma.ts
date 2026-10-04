// En qué idioma se muestra la app. Sin dependencias de Next, para probarlo solo.

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** El negocio piloto trabaja en español. */
export const IDIOMA_POR_OMISION: Idioma = 'es';

/** La cookie con el idioma que eligió el usuario. En el paso 2 se toma también del miembro (`miembros.idioma`). */
export const COOKIE_IDIOMA = 'idioma';

export function esIdioma(x: unknown): x is Idioma {
  return typeof x === 'string' && (IDIOMAS as readonly string[]).includes(x);
}

/**
 * El idioma de la petición: el que eligió el usuario; si no eligió, el primero del teléfono que la app tenga
 * (`Accept-Language`, por su preferencia `q`); si no, español.
 */
export function elegirIdioma(elegido: string | undefined, acceptLanguage: string | null): Idioma {
  if (esIdioma(elegido)) return elegido;
  const delTelefono = (acceptLanguage ?? '')
    .split(',')
    .map((parte, orden) => {
      const [etiqueta = '', ...params] = parte.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const peso = q ? Number(q.slice(2)) : 1;
      return { idioma: etiqueta.split('-')[0]!.toLowerCase(), peso: Number.isNaN(peso) ? 0 : peso, orden };
    })
    .filter((x) => x.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.orden - b.orden)
    .find((x) => esIdioma(x.idioma));
  return (delTelefono?.idioma as Idioma | undefined) ?? IDIOMA_POR_OMISION;
}
