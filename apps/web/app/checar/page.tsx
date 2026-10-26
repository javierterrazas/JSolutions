// La checada del trabajador (D-117): su nombre, si está dentro de una obra y desde cuándo, y el botón de checar entrada
// o salida. Sin sesión: la llave de su celular dice quién es.
import { sinUsuario, trabajadorDeLlave } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { leerLlaveChecada } from '@/lib/checada';
import { servidor } from '@/lib/servidor';
import { Marco, estilos } from '../componentes/marco';
import { PantallaChecar } from './pantalla-checar';

export const dynamic = 'force-dynamic';

export default async function Checar() {
  const llave = await leerLlaveChecada();
  const t = await sinUsuario(servidor(), (tx) => trabajadorDeLlave(tx, llave));
  const textos = await getTranslations('checada');
  if (!t)
    return (
      <Marco titulo={textos('titulo')}>
        <p className={estilos.tarjeta}>{textos('sinAcceso')}</p>
      </Marco>
    );
  return (
    <Marco titulo={textos('hola', { nombre: t.nombre })} subtitulo={t.empresa}>
      <PantallaChecar
        dentro={t.dentro ? { obra: t.dentro.obra, desde: t.dentro.desde.toISOString() } : null}
      />
    </Marco>
  );
}
