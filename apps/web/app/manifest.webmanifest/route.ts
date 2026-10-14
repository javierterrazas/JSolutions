// El manifiesto general, el de J Solutions (antes de entrar). Sigue en /manifest.webmanifest porque el service worker
// lo guarda para abrir sin señal; quien entra recibe el de su empresa (/marca/{empresa}/manifest, D-078).
import { GENERAL } from '../marca/datos';
import { manifiestoDe } from '../marca/manifiesto';

export async function GET() {
  return manifiestoDe(GENERAL);
}
