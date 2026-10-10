// La entrega de una obra, para su PM (fase 2, paso 6e; legacy: vEntrega y la medida de vResumen en PM.html): el
// recorrido con el cliente (el punch list, con 7 días hábiles para corregir cada detalle) y la medida verificada de
// cada espacio (D-014).
import { datosParaEntrega } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';
import { BotonCorregido, FormularioMedida } from './botones';
import { FormularioPunch } from './formulario-punch';

export default async function Entrega({ params }: PageProps<'/obras/[id]/entrega'>) {
  const { id } = await params;
  const acceso = await exigirAcceso();
  if (acceso.yo.rol !== 'pm') redirect('/');
  const r = await comoMiembro((tx) => datosParaEntrega(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, formato] = await Promise.all([getTranslations('entrega'), getFormatter()]);
  const dia = (x: string) =>
    formato.dateTime(new Date(`${x}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'short' });
  const vencidos = d.abiertos.filter((p) => p.vencido).length;

  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      {vencidos ? <p className={estilos.error}>{t('vencidos', { n: vencidos })}</p> : null}
      <FormularioPunch obraId={d.obra.id} />

      {d.abiertos.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('pendientes', { n: d.abiertos.length })}</h2>
          <ul className="flex flex-col gap-3">
            {d.abiertos.map((p) => (
              <li
                key={p.id}
                className={`${estilos.tarjeta} flex flex-col gap-2 ${p.vencido ? 'border-red-300' : ''}`}
              >
                <p className="font-semibold">{p.item}</p>
                <p className="text-sm text-slate-600">
                  {t(p.responsable ? 'detalleCon' : 'detalleSin', {
                    origen: t(`origenes.${p.origen}`),
                    responsable: p.responsable ?? '',
                    dia: dia(p.compromiso),
                  })}
                  {p.vencido ? <span className="ml-1 font-semibold text-red-700">{t('vencido')}</span> : null}
                </p>
                <BotonCorregido obraId={d.obra.id} punchId={p.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.cerrados.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-marca">{t('corregidos', { n: d.cerrados.length })}</h2>
          <ul className={`${estilos.tarjeta} flex flex-col divide-y divide-slate-100 p-0`}>
            {d.cerrados.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span>{p.item}</span>
                <span className="shrink-0 text-emerald-700">{t('listo')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-2 flex flex-col gap-3">
        <h2 className="text-lg font-bold text-marca">{t('medidas')}</h2>
        <p className="text-sm text-slate-600">{t('medidasAyuda')}</p>
        {d.medidas.map((m) => (
          <div
            key={m.id}
            className={`${estilos.tarjeta} flex flex-col gap-2 ${m.pies2Verificados === null ? 'border-amber-300' : ''}`}
          >
            <p className="font-semibold">{m.nombre}</p>
            <p className="text-sm text-slate-600">
              {m.pies2Verificados === null
                ? t('cotizada', { pies2: m.pies2Cotizados })
                : t('verificada', {
                    pies2: m.pies2Verificados,
                    cotizada: m.pies2Cotizados,
                    dia: formato.dateTime(new Date(m.verificadoEn!), { dateStyle: 'medium' }),
                  })}
            </p>
            <FormularioMedida
              obraId={d.obra.id}
              espacioId={m.id}
              pies2={m.pies2Verificados}
              lineales={m.piesLinealesVerificados}
            />
          </div>
        ))}
      </section>
    </Marco>
  );
}
