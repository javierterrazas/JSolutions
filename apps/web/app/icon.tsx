import { dibujarIcono } from './iconos/dibujo';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icono() {
  return dibujarIcono(32, 0.12);
}
