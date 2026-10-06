import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Marco } from '../../componentes/marco';
import { estadoParaPin } from '../estado';
import { FormularioPin } from '../formulario-pin';

export default async function ElegirPin() {
  const { estado, largo } = await estadoParaPin();
  if (estado === 'invalido') redirect('/sin-acceso');
  if (estado !== 'sin_pin') redirect('/pin');
  const t = await getTranslations('pin');
  return (
    <Marco titulo={t('nuevoTitulo')}>
      <p className="text-slate-700">{t('nuevoTexto', { largo })}</p>
      <FormularioPin modo="elegir" largo={largo} />
    </Marco>
  );
}
