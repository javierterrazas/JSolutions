import { describe, expect, it } from 'vitest';
import { nombreDelDispositivo, sesionDelToken } from './dispositivo';

describe('el nombre del celular', () => {
  it('sale del navegador', () => {
    expect(nombreDelDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone');
    expect(nombreDelDispositivo('Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari')).toBe('Android');
    expect(nombreDelDispositivo('Mozilla/5.0 (Linux; Android 15; SM-X710) Safari')).toBe('Tablet Android');
    expect(nombreDelDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(nombreDelDispositivo(null)).toBe('Celular');
  });
});

describe('la sesión del token', () => {
  const token = (carga: object) => `x.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.y`;
  it('lee session_id; sin él o con un token roto, null', () => {
    expect(sesionDelToken(token({ sub: 'u', session_id: 'abc' }))).toBe('abc');
    expect(sesionDelToken(token({ sub: 'u' }))).toBeNull();
    expect(sesionDelToken('roto')).toBeNull();
  });
});
