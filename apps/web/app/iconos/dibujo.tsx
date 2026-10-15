// El ícono de la app, de cualquier tamaño (D-078): el logo de la empresa llenando todo el ícono (D-082) o, sin logo,
// sus iniciales en blanco sobre su color. Sin empresa (antes de entrar), la "J" de J Solutions.
import { ImageResponse } from 'next/og';
import { COLOR_MARCA, NOMBRE_APP } from '../marca';

export interface MarcaDelIcono {
  readonly nombre: string;
  readonly color: string;
  readonly logo: Buffer | null;
  readonly logoTipo: string | null;
}

export const MARCA_GENERAL: MarcaDelIcono = {
  nombre: NOMBRE_APP,
  color: COLOR_MARCA,
  logo: null,
  logoTipo: null,
};

/**
 * Las iniciales de una empresa: su primera palabra si ya es una sigla ("IJM Construction" → IJM); si no, la primera
 * letra de sus dos primeras palabras largas ("Remodelaciones del Valle" → RV). J Solutions conserva su "J".
 */
export function iniciales(nombre: string): string {
  if (nombre === NOMBRE_APP) return nombre.charAt(0);
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = palabras[0] ?? '';
  if (/^[A-ZÁÉÍÓÚÑ0-9&]{2,4}$/.test(primera)) return primera;
  const largas = palabras.filter((p) => p.length > 3);
  return (largas.length ? largas : palabras)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/**
 * `margen` es la parte del lado que queda libre alrededor de las iniciales. El ícono "maskable" de Android lleva más
 * margen, porque el teléfono lo recorta en círculo o en gota. El logo no lleva margen: llena todo el ícono (D-082);
 * si no es cuadrado, se recorta al centro. Lo transparente de un PNG queda en blanco.
 */
export function dibujarIcono(
  lado: number,
  margen = 0.2,
  marca: MarcaDelIcono = MARCA_GENERAL,
): ImageResponse {
  if (marca.logo && marca.logoTipo) {
    const src = `data:${marca.logoTipo};base64,${marca.logo.toString('base64')}`;
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dentro de ImageResponse no hay next/image */}
        <img src={src} alt="" width={lado} height={lado} style={{ objectFit: 'cover' }} />
      </div>,
      { width: lado, height: lado },
    );
  }
  const util = Math.round(lado * (1 - 2 * margen));
  const texto = iniciales(marca.nombre);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: marca.color,
        color: '#ffffff',
        fontSize: Math.round(util / Math.max(1, texto.length * 0.62)),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {texto}
    </div>,
    { width: lado, height: lado },
  );
}
