// La invitación se canjea con un botón, no al abrir el enlace: WhatsApp y otros abren los enlaces para mostrar su
// vista previa, y eso gastaría la invitación de un solo uso.
import { getTranslations } from 'next-intl/server';
import { canjear } from '../../acciones/entrar';
import { Marco, estilos } from '../../componentes/marco';

export default async function Invitacion({ params }: PageProps<'/invitacion/[token]'>) {
  const { token } = await params;
  const t = await getTranslations('invitacion');
  return (
    <Marco titulo={t('titulo')}>
      <p className={estilos.tarjeta}>{t('texto')}</p>
      <form action={canjear.bind(null, token)}>
        <button type="submit" className={`${estilos.boton} w-full`}>
          {t('boton')}
        </button>
      </form>
    </Marco>
  );
}
