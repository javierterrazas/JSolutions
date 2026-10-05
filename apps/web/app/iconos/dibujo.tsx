// El ícono de la app: la "J" blanca sobre el color de la marca, de cualquier tamaño.
import { ImageResponse } from 'next/og';
import { COLOR_MARCA, NOMBRE_APP } from '../marca';

/**
 * `margen` es la parte del lado que queda libre alrededor de la letra. El ícono "maskable" de Android lleva más
 * margen, porque el teléfono lo recorta en círculo o en gota.
 */
export function dibujarIcono(lado: number, margen = 0.2): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLOR_MARCA,
        color: '#ffffff',
        fontSize: lado * (1 - 2 * margen),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {NOMBRE_APP.charAt(0)}
    </div>,
    { width: lado, height: lado },
  );
}
