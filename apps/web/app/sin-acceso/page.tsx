import { enNombreDe, miEmpresaSuspendida } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { servidor } from '@/lib/servidor';
import { usuarioDeLaSesion } from '@/lib/supabase';
import { Marco, estilos } from '../componentes/marco';
import { BorrarCopia } from './borrar-copia';
import { PegarInvitacion } from './pegar-invitacion';

export default async function SinAcceso() {
  // si su empresa está suspendida (D-080), se le dice eso, sin borrar la copia de su celular
  const sesion = await usuarioDeLaSesion();
  if (sesion && (await enNombreDe(servidor(), sesion, (tx) => miEmpresaSuspendida(tx))))
    redirect('/suspendida');
  const t = await getTranslations('sinAcceso');
  return (
    <Marco titulo={t('titulo')}>
      <BorrarCopia />
      <p className={estilos.tarjeta}>{t('texto')}</p>
      <PegarInvitacion />
      <p className="text-sm text-slate-600">{t('baja')}</p>
    </Marco>
  );
}
