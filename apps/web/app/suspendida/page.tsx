// Cuando la plataforma suspende una empresa (D-080), nadie de ella entra: se le dice por qué y qué hacer, en vez de
// "este celular no tiene acceso". Sus datos siguen ahí.
import { enNombreDe, miEmpresaSuspendida } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { servidor } from '@/lib/servidor';
import { usuarioDeLaSesion } from '@/lib/supabase';
import { Marco, estilos } from '../componentes/marco';

export default async function Suspendida() {
  const sesion = await usuarioDeLaSesion();
  const empresa = sesion ? await enNombreDe(servidor(), sesion, (tx) => miEmpresaSuspendida(tx)) : null;
  if (!empresa) redirect('/');
  const t = await getTranslations('suspendida');
  return (
    <Marco titulo={t('titulo')}>
      <p className={estilos.tarjeta}>{t('texto', { empresa })}</p>
      <p className="text-slate-700">{t('datos')}</p>
    </Marco>
  );
}
