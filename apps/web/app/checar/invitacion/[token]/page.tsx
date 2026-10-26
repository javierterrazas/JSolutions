// La invitación de checada de un trabajador (D-117): se activa con un botón, no al abrir el enlace (la vista previa de
// WhatsApp lo gastaría). Si ya no sirve, dice por qué; si ya es suya en este navegador, a checar (D-115). Avisa si se
// abrió dentro de Instagram o Facebook (D-116).
import { estadoDeAccesoTrabajador, sinUsuario } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { leerLlaveChecada } from '@/lib/checada';
import { enlaceDeLaApp } from '@/lib/enlace';
import { abrirEnChrome, esAndroid, navegadorInterno } from '@/lib/navegador';
import { servidor } from '@/lib/servidor';
import { activarChecada } from '../../../acciones/checada';
import { Marco, estilos } from '../../../componentes/marco';
import { AvisoNavegador } from '../../../invitacion/[token]/aviso-navegador';
import { BotonCanjear } from '../../../invitacion/[token]/boton-canjear';

export default async function InvitacionChecada({ params }: PageProps<'/checar/invitacion/[token]'>) {
  const { token } = await params;
  const estado = await sinUsuario(servidor(), async (tx) =>
    estadoDeAccesoTrabajador(tx, { token, llave: await leerLlaveChecada() }),
  ).catch(() => 'invalida' as const);
  if (estado === 'tuya') redirect('/checar');
  if (estado !== 'vigente') redirect(`/invitacion/invalida?motivo=${estado}`);
  const t = await getTranslations('checada');
  const ti = await getTranslations('invitacion');
  const ua = (await headers()).get('user-agent');
  const interno = navegadorInterno(ua);
  const enlace = interno ? await enlaceDeLaApp(`/checar/invitacion/${token}`) : '';
  return (
    <Marco titulo={t('invitacionTitulo')}>
      {interno ? (
        <AvisoNavegador app={interno} enlace={enlace} chrome={esAndroid(ua) ? abrirEnChrome(enlace) : null} />
      ) : null}
      <p className={estilos.tarjeta}>{t('invitacionTexto')}</p>
      <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{ti('dondeAbrir')}</p>
      <form action={activarChecada.bind(null, token)}>
        <BotonCanjear texto={t('activar')} enviando={ti('verificando')} />
      </form>
    </Marco>
  );
}
