// La invitación se canjea con un botón, no al abrir el enlace: WhatsApp y otros abren los enlaces para mostrar su
// vista previa, y eso gastaría la invitación de un solo uso.
import { enNombreDe, estadoDispositivo, quienSoy } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { leerLlave } from '@/lib/acceso';
import { servidor } from '@/lib/servidor';
import { usuarioDeLaSesion } from '@/lib/supabase';
import { canjear } from '../../acciones/entrar';
import { Marco, estilos } from '../../componentes/marco';

/**
 * Quién tiene ya este celular, si alguien: un celular es de una sola persona (D-038), y canjear aquí otra
 * invitación le quita el acceso a quien lo tenía.
 */
async function quienLoTiene(): Promise<string | null> {
  const sesion = await usuarioDeLaSesion();
  const llave = await leerLlave();
  if (!sesion || !llave) return null;
  return enNombreDe(servidor(), { userId: sesion.userId }, async (tx) =>
    (await estadoDispositivo(tx, llave)) === 'invalido' ? null : (await quienSoy(tx)).nombre,
  );
}

export default async function Invitacion({ params }: PageProps<'/invitacion/[token]'>) {
  const { token } = await params;
  const [t, actual] = await Promise.all([getTranslations('invitacion'), quienLoTiene()]);
  return (
    <Marco titulo={t('titulo')}>
      <p className={estilos.tarjeta}>{t('texto')}</p>
      {actual ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {t('yaTieneDueno', { nombre: actual })}
        </p>
      ) : null}
      <form action={canjear.bind(null, token)}>
        <button type="submit" className={`${estilos.boton} w-full`}>
          {actual ? t('botonReemplazar') : t('boton')}
        </button>
      </form>
    </Marco>
  );
}
