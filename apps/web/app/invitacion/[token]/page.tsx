// La invitación se canjea con un botón, no al abrir el enlace: WhatsApp y otros abren los enlaces para mostrar su
// vista previa, y eso gastaría la invitación de un solo uso.
import { enNombreDe, estadoDeInvitacion, estadoDispositivo, quienSoy, sinUsuario } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { leerLlave } from '@/lib/acceso';
import { enlaceDeInvitacion } from '@/lib/enlace';
import { abrirEnChrome, esAndroid, navegadorInterno } from '@/lib/navegador';
import { servidor } from '@/lib/servidor';
import { usuarioDeLaSesion } from '@/lib/supabase';
import { canjear } from '../../acciones/entrar';
import { Marco, estilos } from '../../componentes/marco';
import { AvisoNavegador } from './aviso-navegador';
import { BotonCanjear } from './boton-canjear';

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
  // si ya no se puede canjear, se dice por qué desde que se abre; si ya se canjeó en este navegador, a la app (D-115)
  const estado = await sinUsuario(servidor(), async (tx) =>
    estadoDeInvitacion(tx, { token, llave: await leerLlave() }),
  ).catch(() => 'invalida' as const);
  if (estado === 'tuya') redirect('/');
  if (estado !== 'vigente') redirect(`/invitacion/invalida?motivo=${estado}`);
  const [t, actual] = await Promise.all([getTranslations('invitacion'), quienLoTiene()]);
  // abierta dentro de Instagram, Facebook…: el acceso se quedaría dentro de esa app (D-116)
  const ua = (await headers()).get('user-agent');
  const interno = navegadorInterno(ua);
  const enlace = interno ? await enlaceDeInvitacion(token) : '';
  return (
    <Marco titulo={t('titulo')}>
      {interno ? (
        <AvisoNavegador app={interno} enlace={enlace} chrome={esAndroid(ua) ? abrirEnChrome(enlace) : null} />
      ) : null}
      <p className={estilos.tarjeta}>{t('texto')}</p>
      {/* cada navegador guarda su acceso aparte: la invitación sirve en el primero donde se toca el botón (D-115) */}
      <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{t('dondeAbrir')}</p>
      {actual ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {t('yaTieneDueno', { nombre: actual })}
        </p>
      ) : null}
      <form action={canjear.bind(null, token)}>
        <BotonCanjear texto={actual ? t('botonReemplazar') : t('boton')} enviando={t('verificando')} />
      </form>
    </Marco>
  );
}
