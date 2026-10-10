// Los avisos de una obra, para su PM (fase 2, paso 6c; legacy: vAviso de PM.html): levantar uno, y ver los que
// esperan respuesta y las respuestas del dueño.
import { datosParaAviso } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { FormularioAviso } from './formulario-aviso';

export default async function Aviso({ params }: PageProps<'/obras/[id]/aviso'>) {
  const { id } = await params;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro((tx) => datosParaAviso(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, formato] = await Promise.all([getTranslations('aviso'), getFormatter()]);
  const cuando = (iso: string) =>
    formato.dateTime(new Date(iso), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      <FormularioAviso datos={{ obraId: d.obra.id, folio: d.obra.folio, slaHoras: d.slaHoras }} />
      {d.avisos.length ? (
        <section className="mt-4 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('tusAvisos')}</h2>
          <ul className="flex flex-col gap-3">
            {d.avisos.map((a) => (
              <li
                key={a.id}
                className={`${estilos.tarjeta} flex flex-col gap-1 ${a.respuesta ? '' : 'border-amber-300'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{t(`tipos.${a.tipo}`)}</p>
                  <p className="shrink-0 text-xs text-slate-500">{a.folio}</p>
                </div>
                <p className="text-sm text-slate-600">
                  {t(a.detiene ? 'levantadoDetiene' : 'levantado', { cuando: cuando(a.creadoEn) })}
                </p>
                <p className="text-sm text-slate-800">{a.descripcion}</p>
                {a.respuesta ? (
                  <div className="mt-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p className="font-medium">{t('respuesta', { cuando: cuando(a.respondidoEn!) })}</p>
                    <p>{a.respuesta}</p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-amber-800">{t('esperando')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Marco>
  );
}
