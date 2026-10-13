// Las órdenes de cambio de una obra, para el dueño (D-067): emitirlas, con el margen mínimo, y ver cómo respondió el
// cliente (con su firma, si fue en su portal), o registrar la respuesta que dio en papel. Lleva dinero: costo,
// precio y margen. Solo el dueño o el administrador.
import { cambiosDeObra } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../../componentes/marco';
import { FormularioCambio } from './formulario-cambio';
import { RespuestaPapel } from './respuesta-papel';

const COLOR_ESTADO: Record<string, string> = {
  propuesta: 'bg-amber-100 text-amber-900',
  autorizada: 'bg-emerald-100 text-emerald-900',
  facturada: 'bg-slate-200 text-slate-800',
  rechazada: 'bg-red-100 text-red-900',
};

export default async function Cambios({ params }: PageProps<'/obras/[id]/cambios'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => cambiosDeObra(tx, { obraId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const c = r.datos;
  const [t, to, formato, idioma] = await Promise.all([
    getTranslations('cambios'),
    getTranslations('obras'),
    getFormatter(),
    getLocale(),
  ]);
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  const cuando = (d: Date) => formato.dateTime(d, { dateStyle: 'medium', timeStyle: 'short' });
  const condicion = (x: string | null) =>
    x && t.has(`condiciones.${x}` as never) ? t(`condiciones.${x}` as never) : (x ?? '—');

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={to('encabezado', { folio: c.obra.folio, cliente: c.obra.cliente })}
      volver={{ href: `/obras/${c.obra.id}/seguimiento`, texto: t('volver') }}
    >
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      {c.contrato !== null ? (
        <dl className={`${estilos.tarjeta} grid grid-cols-[1fr_auto] gap-x-3 gap-y-1`}>
          <dt className="text-slate-600">{t('contrato')}</dt>
          <dd>{dinero(c.contrato)}</dd>
          <dt className="text-slate-600">{t('autorizado')}</dt>
          <dd>{dinero(c.autorizado)}</dd>
          <dt className="font-semibold">{t('total')}</dt>
          <dd className="font-semibold">{dinero(c.contrato + c.autorizado)}</dd>
        </dl>
      ) : null}

      {c.obra.estado !== 'entregada' ? <FormularioCambio obraId={c.obra.id} hoy={c.hoy} /> : null}

      {c.ordenes.length === 0 ? <p className={estilos.tarjeta}>{t('ninguna')}</p> : null}
      <ul className="flex flex-col gap-3">
        {c.ordenes.map((o) => (
          <li key={o.id} className={`${estilos.tarjeta} flex flex-col gap-2`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">
                {t('folioMotivo', { folio: o.folio, motivo: t(`motivos.${o.motivo}`) })}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${COLOR_ESTADO[o.estado]}`}>
                {t(`estados.${o.estado}`)}
              </span>
            </div>
            <p className="text-slate-900">{o.descripcion}</p>
            <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
              <span>{t('costoValor', { costo: dinero(o.costo) })}</span>
              <span className="font-semibold">{t('precioValor', { precio: dinero(o.precio) })}</span>
              <span className={o.margen < c.margenMinimo ? 'font-semibold text-red-700' : ''}>
                {t('margenValor', { margen: pct(o.margen) })}
              </span>
            </p>
            <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
              <span>{o.dias ? t('diasValor', { n: o.dias }) : t('sinDias')}</span>
              <span>{condicion(o.condicion)}</span>
            </p>
            {o.respuesta ? (
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold">
                  {t(o.respuesta.decision === 'aprobada' ? 'aprobadaPor' : 'noAprobadaPor', {
                    nombre: o.respuesta.nombre,
                    cuando: cuando(o.respuesta.cuando),
                  })}
                </p>
                <p className="text-slate-600">{o.respuesta.desdePortal ? t('enPortal') : t('enPapel')}</p>
                {o.respuesta.comentario ? <p className="italic">{o.respuesta.comentario}</p> : null}
                {o.respuesta.firma ? (
                  // eslint-disable-next-line @next/next/no-img-element -- la firma es un PNG en data URL, no se optimiza
                  <img
                    src={o.respuesta.firma}
                    alt={t('firmaDe', { nombre: o.respuesta.nombre })}
                    className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain"
                  />
                ) : null}
              </div>
            ) : o.estado === 'propuesta' ? (
              <>
                <p className="text-sm text-amber-900">{t('esperando')}</p>
                <RespuestaPapel obraId={c.obra.id} ordenId={o.id} />
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </Marco>
  );
}
