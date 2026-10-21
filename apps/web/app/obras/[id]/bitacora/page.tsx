// La bitácora de la obra (D-105): los días cerrados, del más nuevo al más viejo, con lo que se capturó (partidas,
// cuadrilla y sus horas, subs, notas y fotos), sin dinero. El PM la abre desde su inicio; lo que todavía puede
// corregir (48 horas) trae el botón para hacerlo.
import { bitacoraDeObra } from '@ijm/servidor';
import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { Marco, estilos } from '../../../componentes/marco';

export default async function Bitacora({ params, searchParams }: PageProps<'/obras/[id]/bitacora'>) {
  const { id } = await params;
  const consulta = await searchParams;
  const pagina = Math.max(0, Math.min(1000, Number(consulta.pagina) || 0));
  const acceso = await exigirAcceso();
  const r = await comoMiembro((tx) => bitacoraDeObra(tx, { obraId: id, pagina }), acceso);
  if (!r.ok || !r.datos) notFound();
  const b = r.datos;
  const [t, tc, to, formato, idioma] = await Promise.all([
    getTranslations('bitacora'),
    getTranslations('cierre'),
    getTranslations('obras'),
    getFormatter(),
    getLocale(),
  ]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' });
  const cantidad = (tipo: 'hora' | 'dia', n: number) =>
    tipo === 'hora' ? t('horas', { n }) : n >= 1 ? tc('diaCompleto') : tc('medioDia');
  const volver = acceso.yo.rol === 'pm' ? '/' : `/obras/${b.obra.id}/seguimiento`;

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={to('encabezado', { folio: b.obra.folio, cliente: b.obra.cliente })}
      volver={{ href: volver, texto: t('volver') }}
    >
      {b.dias.length === 0 ? <p className={estilos.tarjeta}>{t('ninguno')}</p> : null}
      <ul className="flex flex-col gap-3">
        {b.dias.map((d) => (
          <li key={d.folio} className={`${estilos.tarjeta} flex flex-col gap-2 text-sm`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold first-letter:uppercase">{dia(d.dia)}</span>
              <span className="shrink-0 text-slate-500">
                {d.tardio ? t('folioTardio', { folio: d.folio }) : d.folio}
              </span>
            </div>
            {d.sinTrabajo ? (
              <p className="text-slate-700">
                {t('sinTrabajo', { motivo: d.motivo ? tc(`motivos.${d.motivo}` as never) : '—' })}
              </p>
            ) : null}
            {d.partidas.length ? (
              <ul className="flex flex-col gap-0.5">
                {d.partidas.map((x, i) => (
                  <li key={i} className={x.terminada ? 'font-medium text-emerald-800' : 'text-slate-800'}>
                    {t(x.terminada ? 'partidaTerminada' : 'partida', {
                      espacio: x.espacio,
                      partida: nombre(x.partida),
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
            {d.cuadrilla.length ? (
              <p className="text-slate-700">
                <span className="font-medium">{t('cuadrilla')} </span>
                {d.cuadrilla.map((w) => `${w.nombre} ${cantidad(w.tipoPago, w.cantidad)}`).join(' · ')}
              </p>
            ) : null}
            {d.subs.map((x, i) => (
              <p key={i} className={x.llego ? 'text-slate-700' : 'text-red-700'}>
                {t(x.llego ? 'llego' : 'noLlego', { sub: x.sub })}
              </p>
            ))}
            {d.incidencia ? (
              <p className="whitespace-pre-line text-slate-600 italic">{d.incidencia}</p>
            ) : null}
            {d.fotos.length ? (
              <ul className="grid grid-cols-4 gap-2">
                {d.fotos.map((f) => (
                  <li key={f}>
                    <a href={`/fotos/${f}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- un enlace firmado de pocos minutos, no se optimiza */}
                      <img
                        src={`/fotos/${f}`}
                        alt={t('fotoDel', { dia: dia(d.dia) })}
                        loading="lazy"
                        className="aspect-square w-full rounded-lg bg-slate-100 object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {d.corregible ? (
              <Link
                href={`/obras/${b.obra.id}/cierre?${new URLSearchParams({ dia: d.dia, corregir: '1' })}`}
                className="self-start font-semibold text-marca underline"
              >
                {t('corregir')}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      {pagina > 0 || b.hayMas ? (
        <div className="flex gap-2">
          {pagina > 0 ? (
            <Link
              href={`/obras/${b.obra.id}/bitacora${pagina > 1 ? `?pagina=${pagina - 1}` : ''}`}
              className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
            >
              {t('recientes')}
            </Link>
          ) : null}
          {b.hayMas ? (
            <Link
              href={`/obras/${b.obra.id}/bitacora?pagina=${pagina + 1}`}
              className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
            >
              {t('anteriores')}
            </Link>
          ) : null}
        </div>
      ) : null}
    </Marco>
  );
}
