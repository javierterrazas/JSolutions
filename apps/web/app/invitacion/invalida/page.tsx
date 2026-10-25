// Una invitación que no se pudo canjear, con el porqué (D-115): ya se usó en otro lado (lo más común: en otro navegador
// del mismo celular), hay una más nueva, venció, o no existe.
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Marco, estilos } from '../../componentes/marco';

const MOTIVOS = ['usada', 'anulada', 'vencida'] as const;

export default async function InvitacionInvalida({ searchParams }: PageProps<'/invitacion/invalida'>) {
  const { motivo } = await searchParams;
  const m = MOTIVOS.find((x) => x === motivo);
  const t = await getTranslations('invitacion');
  return (
    <Marco titulo={t(m ? `motivos.${m}.titulo` : 'invalidaTitulo')}>
      <p className={`${estilos.tarjeta} whitespace-pre-line`}>
        {t(m ? `motivos.${m}.texto` : 'invalidaTexto')}
      </p>
      {/* si acaba de canjearla aquí mismo (dos toques muy seguidos), ya puede entrar */}
      {m === 'usada' ? (
        <Link href="/" className={`${estilos.botonSecundario} flex items-center justify-center`}>
          {t('probarEntrar')}
        </Link>
      ) : null}
    </Marco>
  );
}
