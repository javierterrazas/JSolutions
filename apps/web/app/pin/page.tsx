import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Marco } from '../componentes/marco';
import { estadoParaPin } from './estado';
import { FormularioPin } from './formulario-pin';

export default async function EscribirPin() {
  const { estado, largo } = await estadoParaPin();
  if (estado === 'abierto') redirect('/');
  if (estado === 'sin_pin') redirect('/pin/nuevo');
  if (estado === 'invalido') redirect('/sin-acceso');
  const t = await getTranslations('pin');
  return (
    <Marco titulo={t('entrarTitulo')}>
      <FormularioPin modo="entrar" largo={largo} />
      <p className="text-sm text-slate-600">{t('olvide')}</p>
    </Marco>
  );
}
