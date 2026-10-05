import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { elegirIdioma, IDIOMAS } from './idioma';

describe('elegir el idioma', () => {
  it('manda el que eligió el usuario', () => {
    expect(elegirIdioma('en', 'es-MX,es;q=0.9')).toBe('en');
    expect(elegirIdioma('es', 'en-US')).toBe('es');
  });

  it('sin elección, el primero del teléfono que la app tenga, por su preferencia', () => {
    expect(elegirIdioma(undefined, 'en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(elegirIdioma(undefined, 'fr-FR,fr;q=0.9,en;q=0.5,es;q=0.7')).toBe('es');
    expect(elegirIdioma(undefined, 'es;q=0.2, EN-GB;q=0.4')).toBe('en');
    expect(elegirIdioma(undefined, 'en;q=0, es')).toBe('es');
  });

  it('una elección que no existe o un teléfono sin idiomas de la app: español', () => {
    expect(elegirIdioma('fr', 'de-DE')).toBe('es');
    expect(elegirIdioma(undefined, null)).toBe('es');
    expect(elegirIdioma(undefined, '')).toBe('es');
  });
});

/** Las llaves de un archivo de mensajes, aplanadas: "inicio.pronto". */
function llaves(obj: unknown, prefijo = ''): string[] {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? llaves(v, `${prefijo}${k}.`) : [`${prefijo}${k}`],
  );
}

describe('los mensajes', () => {
  const dir = join(import.meta.dirname, '..', 'mensajes');
  const leer = (idioma: string) => JSON.parse(readFileSync(join(dir, `${idioma}.json`), 'utf8')) as unknown;

  it('hay un archivo por idioma, y nada más', () => {
    expect(readdirSync(dir).sort()).toEqual(IDIOMAS.map((i) => `${i}.json`).sort());
  });

  it('cada idioma tiene exactamente las mismas llaves, y ningún texto vacío', () => {
    const base = llaves(leer('es')).sort();
    for (const idioma of IDIOMAS) {
      const m = leer(idioma);
      expect(llaves(m).sort(), idioma).toEqual(base);
      for (const llave of base) {
        const texto = llave.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m);
        expect(typeof texto === 'string' && texto.trim() !== '', `${idioma}: ${llave}`).toBe(true);
      }
    }
  });
});
