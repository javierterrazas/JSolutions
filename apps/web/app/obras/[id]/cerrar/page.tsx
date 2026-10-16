// Cerrar una obra al entregarla (D-085; legacy: el precierre y el cierre del dueño): sus números finales, lo que falta
// (lo grave primero) y el cierre, que guarda su resumen y su histórico para aprender a cotizar. Ya cerrada, su
// resumen. Solo el dueño o el administrador.
import { revisionDeCierre } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../../componentes/marco';
import { FormularioCierreObra } from './formulario-cierre-obra';

const COLOR = {
  alto: 'bg-red-50 text-red-900',
  medio: 'bg-amber-50 text-amber-900',
  bajo: 'bg-slate-100 text-slate-800',
} as const;

export default async function CerrarObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => revisionDeCierre(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const c = r.datos;
  const [t, to, idioma, formato] = await Promise.all([
    getTranslations('cerrarObra'),
    getTranslations('obras'),
    getLocale(),
    getFormatter(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 1000) / 10}%`);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'long' });
  const n = c.numeros;
  const filas: [string, string][] = [
    [t('contratoOriginal'), dinero(n.contratoOriginal)],
    [t('ordenesCambio'), dinero(n.montoOC)],
    [t('contratoFinal'), dinero(n.contratoFinal)],
    [t('cobrado'), dinero(n.cobrado)],
    [t('presupuestado'), dinero(n.presupuestado)],
    [t('costo'), dinero(n.costo)],
    [
      t('desglose'),
      t('desgloseValor', {
        material: dinero(n.materiales),
        cuadrilla: dinero(n.cuadrilla),
        sub: dinero(n.subcontratos),
      }),
    ],
    [t('noCalidad'), dinero(n.noCalidad)],
    [t('margen'), pct(n.margen)],
    [t('desviacion'), pct(n.desviacion)],
    [t('diasReportados'), String(n.diasReportados)],
  ];

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={to('encabezado', { folio: c.obra.folio, cliente: c.obra.cliente })}
      volver={{ href: `/obras/${c.obra.id}/seguimiento`, texto: t('volver') }}
    >
      {c.cerrada ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
          {t('yaCerrada', { dia: dia(c.cerrada.fechaEntrega) })}
        </p>
      ) : (
        <p className="text-slate-700">{t('intro')}</p>
      )}

      <dl className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-600">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {!c.cerrada ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-marca">{t('pendientes')}</h2>
            {c.avisos.length ? (
              <ul className="flex flex-col gap-2">
                {c.avisos.map((a) => (
                  <li key={a.codigo} className={`rounded-xl p-3 text-sm ${COLOR[a.gravedad]}`}>
                    {t('aviso', {
                      gravedad: t(`gravedad.${a.gravedad}`),
                      texto: t(
                        `avisos.${a.codigo}` as never,
                        {
                          ...a.datos,
                          ...(typeof a.datos?.monto === 'number' ? { monto: dinero(a.datos.monto) } : {}),
                        } as never,
                      ),
                    })}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{t('sinPendientes')}</p>
            )}
          </section>
          {['en_obra', 'en_cierre'].includes(c.obra.estado) ? (
            <FormularioCierreObra obraId={c.obra.id} hoy={c.hoy} inicio={c.obra.inicio} />
          ) : (
            <p className="text-sm text-slate-600">{t('sinArrancar')}</p>
          )}
        </>
      ) : null}
    </Marco>
  );
}
