// El seguimiento de una obra, para el dueño (D-062): cómo va (avance, etapa de cada espacio, plazo), el presupuesto
// contra lo gastado por etapa, las horas de la cuadrilla y el día a día de lo que capturó el PM (?pagina=, de 14 en
// 14 días). Lleva dinero: solo el dueño o el administrador.
import { enlaceClienteDeObra, type Semaforo, seguimientoDeObra } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../../componentes/marco';
import { EnlaceCliente } from './enlace-cliente';

const COLOR: Record<Semaforo, string> = {
  verde: 'bg-emerald-50 text-emerald-900',
  amarillo: 'bg-amber-50 text-amber-900',
  rojo: 'bg-red-50 text-red-900',
};

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold text-marca">{titulo}</h2>
      {children}
    </section>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{titulo}</dt>
      <dd className="min-w-0 break-words text-slate-800">{children}</dd>
    </>
  );
}

export default async function Seguimiento({ params, searchParams }: PageProps<'/obras/[id]/seguimiento'>) {
  const { id } = await params;
  const consulta = await searchParams;
  const pagina = Math.max(0, Math.min(1000, Number(consulta.pagina) || 0));
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => seguimientoDeObra(tx, { obraId: id, pagina }), acceso);
  if (!r.ok || !r.datos) notFound();
  const s = r.datos;
  // el enlace del portal del cliente (D-066)
  const e = await comoMiembro((tx) => enlaceClienteDeObra(tx, { obraId: id }), acceso);
  const enlace = e.ok && e.datos ? e.datos : null;
  const [t, to, formato, idioma] = await Promise.all([
    getTranslations('seguimiento'),
    getTranslations('obras'),
    getFormatter(),
    getLocale(),
  ]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string, largo = false) =>
    formato.dateTime(
      new Date(`${d}T12:00:00`),
      largo ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' },
    );
  const cantidad = (tipo: 'hora' | 'dia', n: number) => t(tipo === 'hora' ? 'horas' : 'dias', { n });
  const p = s.presupuesto;

  return (
    <Marco
      titulo={to('encabezado', { folio: s.obra.folio, cliente: s.obra.cliente })}
      volver={{ href: '/obras', texto: t('volver') }}
    >
      {/* los datos de la obra y del cliente, los del alta */}
      <section className={`${estilos.tarjeta} flex flex-col gap-2 text-sm`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-marca">{t('datos')}</h2>
          <Link href={`/obras/${s.obra.id}/datos`} className="font-medium text-marca underline">
            {t('corregir')}
          </Link>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <Dato titulo={t('cliente')}>{s.obra.cliente}</Dato>
          <Dato titulo={t('telefono')}>
            <a href={`tel:${s.obra.telefono}`} className="font-medium text-marca underline">
              {s.obra.telefono}
            </a>
          </Dato>
          <Dato titulo={t('direccion')}>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(s.obra.direccion)}`}
              target="_blank"
              rel="noreferrer"
              className="text-marca underline"
            >
              {s.obra.direccion}
            </a>
          </Dato>
          <Dato titulo={t('pmTitulo')}>{s.obra.pm ?? '—'}</Dato>
          <Dato titulo={t('estado')}>{to(`estado.${s.obra.estado}` as never)}</Dato>
          <Dato titulo={t('inicio')}>{dia(s.obra.inicio, true)}</Dato>
          <Dato titulo={t('entrega')}>
            {dia(s.obra.entregaComprometida, true)}
            {s.obra.entregaComprometida !== s.obra.entregaOriginal ? (
              <span className="block text-xs text-slate-500">
                {t('entregaOriginal', { dia: dia(s.obra.entregaOriginal, true) })}
              </span>
            ) : null}
          </Dato>
          {s.obra.contrato !== null ? <Dato titulo={t('contrato')}>{dinero(s.obra.contrato)}</Dato> : null}
        </dl>
        {s.obra.notas ? (
          <p className="whitespace-pre-line text-slate-700">
            <span className="font-medium">{t('notas')}</span> {s.obra.notas}
          </p>
        ) : null}
      </section>
      <Link
        href={`/obras/${s.obra.id}/compra`}
        className={`${estilos.boton} flex items-center justify-center`}
      >
        {t('registrarCompra')}
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/obras/${s.obra.id}/presupuesto`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {to('presupuesto')}
        </Link>
        <Link
          href={`/obras/${s.obra.id}/album`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {to('album')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/obras/${s.obra.id}/cambios`}
          className={`${estilos.botonSecundario} flex items-center justify-center px-2 text-center`}
        >
          {t('cambios')}
        </Link>
        <Link
          href={`/obras/${s.obra.id}/cobros`}
          className={`${estilos.botonSecundario} flex items-center justify-center px-2 text-center`}
        >
          {t('cobros')}
        </Link>
        <Link
          href={`/obras/${s.obra.id}/subcontratos`}
          className={`${estilos.botonSecundario} col-span-2 flex items-center justify-center px-2 text-center`}
        >
          {t('subcontratos')}
        </Link>
      </div>
      <EnlaceCliente
        obraId={s.obra.id}
        enlace={
          enlace
            ? {
                creado: enlace.creado.toISOString(),
                accesos: enlace.accesos,
                ultimoAcceso: enlace.ultimoAcceso?.toISOString() ?? null,
              }
            : null
        }
      />

      {/* cómo va, de un vistazo */}
      <div className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t('avance', { pct: pct(s.avance.pct) })}</p>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={t('avance', { pct: pct(s.avance.pct) })}
          >
            <div className="bg-marca" style={{ width: pct(s.avance.pct) }} />
            <div className="bg-marca/30" style={{ width: pct(s.avance.curso) }} />
          </div>
          <p className="text-sm text-slate-600">
            {t('partidas', { terminadas: s.avance.terminadas, total: s.avance.total })}
          </p>
        </div>
        <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
          <span>{t('comprometida', { dia: dia(s.obra.entregaComprometida) })}</span>
          {s.obra.entregaPrevista ? <span>{t('prevista', { dia: dia(s.obra.entregaPrevista) })}</span> : null}
          <span className={s.obra.atraso ? 'font-semibold text-red-700' : 'text-emerald-700'}>
            {s.obra.atraso ? t('tarde', { n: s.obra.atraso }) : t('aTiempo')}
          </span>
        </p>
        <div
          className={`rounded-xl p-3 text-sm ${p.semaforo ? COLOR[p.semaforo] : 'bg-slate-50 text-slate-700'}`}
        >
          <p className="font-semibold">
            {p.total
              ? t('gastado', { gastado: dinero(p.gastado), total: dinero(p.total), pct: pct(p.usado ?? 0) })
              : t('sinPresupuesto', { gastado: dinero(p.gastado) })}
          </p>
          {p.semaforo ? <p>{t(`semaforo.${p.semaforo}`)}</p> : null}
        </div>
      </div>

      <Seccion titulo={t('espacios')}>
        <ul className="flex flex-col gap-2">
          {s.espacios
            .filter((e) => !e.generales || e.estado !== 'sin_iniciar')
            .map((e) => (
              <li key={e.id} className={`${estilos.tarjeta} flex flex-col gap-1`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{e.nombre}</span>
                  <span className="text-sm text-slate-600">{pct(e.pct)}</span>
                </div>
                <p className="text-sm text-slate-700">
                  {e.estado === 'terminado'
                    ? t('terminado')
                    : e.enCurso.length
                      ? t('enCurso', { partidas: e.enCurso.map(nombre).join(', ') })
                      : e.etapa
                        ? t(e.estado === 'sin_iniciar' ? 'empieza' : 'sigue', { etapa: nombre(e.etapa) })
                        : t('sinIniciar')}
                </p>
                {e.enCurso.length && e.etapa ? (
                  <p className="text-xs text-slate-500">{t('etapa', { etapa: nombre(e.etapa) })}</p>
                ) : null}
              </li>
            ))}
        </ul>
      </Seccion>

      <Seccion titulo={t('porEtapa')}>
        <ul className="flex flex-col gap-2">
          {p.porEtapa.map((x, i) => (
            <li key={i} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {t('etapaDe', { espacio: x.espacio, etapa: x.etapa ? nombre(x.etapa) : t('otras') })}
                </span>
                <span
                  className={
                    x.desvio !== null && x.desvio > 0
                      ? 'font-semibold text-red-700'
                      : x.desvio !== null
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                  }
                >
                  {x.desvio === null
                    ? t('sinPresupuestoEtapa')
                    : x.desvio > 0
                      ? t('pasado', { monto: dinero(x.total - x.presupuesto) })
                      : t('queda', { monto: dinero(x.presupuesto - x.total) })}
                </span>
              </div>
              <p className="text-slate-700">
                {x.presupuesto
                  ? t('etapaGastado', { total: dinero(x.total), presupuesto: dinero(x.presupuesto) })
                  : t('etapaSoloGastado', { total: dinero(x.total) })}
              </p>
              <p className="text-xs text-slate-500">
                {t('desglose', {
                  material: dinero(x.material),
                  cuadrilla: dinero(x.cuadrilla),
                  sub: dinero(x.sub),
                })}
              </p>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo={t('cuadrilla')}>
        <div className={`${estilos.tarjeta} flex flex-col gap-2 text-sm`}>
          <p className="font-semibold">
            {t('cuadrillaTotal', {
              horas: s.cuadrilla.horas,
              dias: s.cuadrilla.dias,
              costo: dinero(s.cuadrilla.costo),
            })}
          </p>
          {s.cuadrilla.porTrabajador.length === 0 ? (
            <p className="text-slate-600">{t('sinCuadrilla')}</p>
          ) : (
            <p className="text-xs text-slate-600">{t('cuadrillaAyuda')}</p>
          )}
          <ul className="flex flex-col gap-1">
            {/* con un toque, sus horas por etapa: aproximadas, repartidas entre las partidas de cada día (D-077) */}
            {s.cuadrilla.porTrabajador.map((w) => (
              <li key={w.nombre}>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-slate-700">
                    <span className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="size-4 shrink-0 fill-none stroke-current stroke-[2.5] transition-transform group-open:rotate-90"
                      >
                        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t('trabajador', { nombre: w.nombre, cantidad: cantidad(w.tipoPago, w.cantidad) })}
                    </span>
                    <span>{dinero(w.costo)}</span>
                  </summary>
                  <ul className="mb-2 ml-6 flex flex-col gap-1 border-l-2 border-slate-200 pl-3 text-slate-700">
                    {w.porEtapa.map((x, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{x.etapa ? nombre(x.etapa) : t('otras')}</span>
                        <span>
                          {t('aproximado', {
                            cantidad: cantidad(w.tipoPago, Math.round(x.cantidad * 10) / 10),
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </Seccion>

      <Seccion titulo={t('diaADia')}>
        {s.dias.length === 0 ? <p className={estilos.tarjeta}>{t('sinDias')}</p> : null}
        <ul className="flex flex-col gap-2">
          {s.dias.map((d) => (
            <li
              key={d.dia}
              className={`${estilos.tarjeta} flex flex-col gap-1 text-sm ${d.folio ? '' : 'border-amber-200 bg-amber-50'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold first-letter:uppercase">{dia(d.dia, true)}</span>
                <span className="text-slate-500">
                  {d.folio ? t(d.tardio ? 'folioTardio' : 'folio', { folio: d.folio }) : t('sinCierre')}
                </span>
              </div>
              {d.sinTrabajo ? (
                <p className="text-slate-700">
                  {t('sinTrabajo', { motivo: d.motivo ? t(`motivos.${d.motivo}` as never) : '—' })}
                </p>
              ) : null}
              {d.partidas.map((x, i) => (
                <p key={i} className="text-slate-700">
                  {t(x.terminada ? 'partidaTerminada' : 'partida', {
                    espacio: x.espacio,
                    partida: nombre(x.partida),
                  })}
                </p>
              ))}
              {d.cuadrilla.length ? (
                <p className="text-slate-700">
                  {d.cuadrilla
                    .map((w) =>
                      t('trabajo', {
                        nombre: w.nombre,
                        cantidad: cantidad(w.tipoPago, w.cantidad),
                        costo: dinero(w.costo),
                      }),
                    )
                    .join(' · ')}
                </p>
              ) : null}
              {d.subs.map((x) => (
                <p key={x.sub} className={x.llego ? 'text-slate-700' : 'text-red-700'}>
                  {t(x.llego ? 'llego' : 'noLlego', { sub: x.sub })}
                </p>
              ))}
              {d.gastos.map((g, i) => (
                <p key={i} className="text-slate-700">
                  {t(g.origen === 'pm' ? 'gastoPm' : 'gastoOficina', {
                    proveedor: g.proveedor,
                    monto: dinero(g.monto),
                  })}
                </p>
              ))}
              {d.incidencia ? <p className="text-slate-600 italic">{d.incidencia}</p> : null}
              {d.fotos ? (
                <Link href={`/obras/${s.obra.id}/album`} className="text-marca underline">
                  {t('fotos', { n: d.fotos })}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          {pagina > 0 ? (
            <Link
              href={`/obras/${s.obra.id}/seguimiento${pagina > 1 ? `?pagina=${pagina - 1}` : ''}`}
              className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
            >
              {t('recientes')}
            </Link>
          ) : null}
          {s.hayMasDias ? (
            <Link
              href={`/obras/${s.obra.id}/seguimiento?pagina=${pagina + 1}`}
              className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
            >
              {t('anteriores')}
            </Link>
          ) : null}
        </div>
      </Seccion>
    </Marco>
  );
}
