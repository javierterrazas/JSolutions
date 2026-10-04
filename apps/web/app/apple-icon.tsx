// El ícono del iPhone en la pantalla de inicio; iOS redondea las esquinas.
import { dibujarIcono } from './iconos/dibujo';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function IconoApple() {
  return dibujarIcono(180);
}
