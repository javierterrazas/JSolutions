'use client';
// El expediente de una obra (D-102): se palomean las secciones y "Descargar PDF" abre la opción de imprimir (Guardar
// como PDF). En papel salen solo el encabezado con la empresa y las secciones elegidas; los controles no.
import type {
  CalidadDeLaObra,
  CambiosDeObra,
  CobrosDeObra,
  Nombre,
  PosventaDeObra,
  RegistroDelAlbum,
  RetrabajosDeObra,
  RevisionDeCierre,
  SeguimientoObra,
  SubcontratosDeObra,
} from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { estilos } from '../../../componentes/marco';

export interface DatosExpediente {
  readonly seguimiento: SeguimientoObra;
  readonly cierre: RevisionDeCierre | null;
  readonly cambios: CambiosDeObra | null;
  readonly cobros: CobrosDeObra | null;
  readonly subcontratos: SubcontratosDeObra | null;
  readonly calidad: CalidadDeLaObra | null;
  readonly retrabajos: RetrabajosDeObra | null;
  readonly posventa: PosventaDeObra | null;
  readonly fotos: readonly RegistroDelAlbum[];
}

const SECCIONES = [
  'resumen',
  'presupuesto',
  'cambios',
  'cobros',
  'subcontratos',
  'diario',
  'cuadrilla',
  'calidad',
  'retrabajos',
  'entrega',
  'fotos',
] as const;
type Seccion = (typeof SECCIONES)[number];

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid-page print:mt-4">
      <h2 className="border-b border-slate-300 pb-1 text-lg font-bold text-marca">{titulo}</h2>
      {children}
    </section>
  );
}

function Fila({ izquierda, derecha }: { izquierda: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1 text-sm break-inside-avoid">
      <span>{izquierda}</span>
      {derecha !== undefined ? <span className="shrink-0 text-right font-medium">{derecha}</span> : null}
    </div>
  );
}

export function Expediente({
  empresa,
  datos: d,
}: {
  empresa: { nombre: string; logo: string | null };
  datos: DatosExpediente;
}) {
  const t = useTranslations('expediente');
  const tc = useTranslations('cambios');
  const tb = useTranslations('cobros');
  const ts = useTranslations('subcontratos');
  const tr = useTranslations('retrabajos');
  const tp = useTranslations('posventa');
  const to = useTranslations('obras');
  const tm = useTranslations('cierre');
  const idioma = useLocale();
  const formato = useFormatter();
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 1000) / 10}%`);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (x: string) => formato.dateTime(new Date(`${x}T12:00:00`), { dateStyle: 'medium' });
  const fecha = (x: Date) => formato.dateTime(new Date(x), { dateStyle: 'medium' });
  const nombre = (n: Nombre | null) => (n ? ((idioma === 'en' ? n.en : null) ?? n.es) : t('otras'));
  const [elegidas, setElegidas] = useState<ReadonlySet<Seccion>>(
    () => new Set(SECCIONES.filter((s) => s !== 'fotos')),
  );
  const ver = (s: Seccion) => elegidas.has(s);
  const o = d.seguimiento.obra;
  const n = d.cierre?.numeros;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 bg-white p-4 text-slate-900 print:max-w-none print:p-0">
      <div className="flex flex-col gap-3 print:hidden">
        <Link
          href={`/obras/${o.id}/seguimiento`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('volver')}
        </Link>
        <h1 className="text-2xl font-bold text-marca">{t('titulo')}</h1>
        <p className="text-sm text-slate-600">{t('ayuda')}</p>
        <fieldset className={`${estilos.tarjeta} grid grid-cols-2 gap-1`}>
          <legend className="px-1 font-semibold text-marca">{t('secciones')}</legend>
          {SECCIONES.map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-marca"
                checked={ver(s)}
                onChange={(e) =>
                  setElegidas((x) => {
                    const nuevo = new Set(x);
                    if (e.target.checked) nuevo.add(s);
                    else nuevo.delete(s);
                    return nuevo;
                  })
                }
              />
              {t(`nombres.${s}`)}
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={() => window.print()} className={estilos.boton}>
          {t('descargar')}
        </button>
        <p className="text-xs text-slate-600">{t('comoGuardar')}</p>
      </div>

      {/* el documento */}
      <header className="flex items-center gap-3 border-b-2 border-marca pb-3">
        {empresa.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- el logo de la empresa, para el papel
          <img src={empresa.logo} alt="" className="size-14 rounded-lg object-cover" />
        ) : null}
        <div className="flex flex-col">
          <span className="text-sm font-semibold uppercase text-slate-600">{empresa.nombre}</span>
          <span className="text-xl font-bold">{t('documento', { folio: o.folio, cliente: o.cliente })}</span>
          <span className="text-xs text-slate-600">{t('generado', { dia: dia(d.seguimiento.hoy) })}</span>
        </div>
      </header>

      {ver('resumen') ? (
        <Bloque titulo={t('nombres.resumen')}>
          <Fila izquierda={t('cliente')} derecha={`${o.cliente} · ${o.telefono}`} />
          <Fila izquierda={t('direccion')} derecha={o.direccion} />
          <Fila izquierda={t('pm')} derecha={o.pm ?? '—'} />
          <Fila izquierda={t('estado')} derecha={to(`estado.${o.estado}` as never)} />
          <Fila izquierda={t('inicio')} derecha={dia(o.inicio)} />
          <Fila izquierda={t('entregaComprometida')} derecha={dia(o.entregaComprometida)} />
          {d.posventa ? <Fila izquierda={t('entregada')} derecha={dia(d.posventa.fechaEntrega)} /> : null}
          <Fila izquierda={t('avance')} derecha={pct(d.seguimiento.avance.pct)} />
          {n ? (
            <>
              <Fila izquierda={t('contratoOriginal')} derecha={dinero(n.contratoOriginal)} />
              <Fila izquierda={t('ordenesCambio')} derecha={dinero(n.montoOC)} />
              <Fila izquierda={t('contratoFinal')} derecha={dinero(n.contratoFinal)} />
              <Fila izquierda={t('cobrado')} derecha={dinero(n.cobrado)} />
              <Fila izquierda={t('costo')} derecha={dinero(n.costo)} />
              <Fila izquierda={t('margen')} derecha={pct(n.margen)} />
            </>
          ) : null}
        </Bloque>
      ) : null}

      {ver('presupuesto') ? (
        <Bloque titulo={t('nombres.presupuesto')}>
          <Fila izquierda={<span className="text-xs text-slate-600">{t('etapaColumnas')}</span>} />
          {d.seguimiento.presupuesto.porEtapa.map((e, i) => (
            <Fila
              key={i}
              izquierda={t('espacioEtapa', { espacio: e.espacio, etapa: nombre(e.etapa) })}
              derecha={t('presupuestoLinea', {
                costo: dinero(e.presupuesto),
                precio: dinero(e.precio),
                gastado: dinero(e.total),
              })}
            />
          ))}
          <Fila
            izquierda={<strong>{t('total')}</strong>}
            derecha={t('totalPresupuesto', {
              costo: dinero(d.seguimiento.presupuesto.total),
              gastado: dinero(d.seguimiento.presupuesto.gastado),
            })}
          />
        </Bloque>
      ) : null}

      {ver('cambios') && d.cambios ? (
        <Bloque titulo={t('nombres.cambios')}>
          {d.cambios.ordenes.length ? null : <p className="text-sm text-slate-600">{t('ninguno')}</p>}
          {d.cambios.ordenes.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-1 border-b border-slate-100 py-2 text-sm break-inside-avoid"
            >
              <span className="flex justify-between gap-2 font-semibold">
                <span>
                  {t('ocEncabezado', { folio: c.folio, estado: tc(`estados.${c.estado}` as never) })}
                </span>
                <span>{dinero(c.precio)}</span>
              </span>
              <span>{c.descripcion}</span>
              <span className="text-slate-600">
                {t('ocDetalle', {
                  dia: dia(c.hallazgo),
                  dias: c.dias,
                  motivo: tc(`motivos.${c.motivo}` as never),
                })}
              </span>
              {c.respuesta ? (
                <span className="text-slate-700">
                  {t('ocRespuesta', {
                    decision: tc(
                      `estados.${c.respuesta.decision === 'aprobada' ? 'autorizada' : 'rechazada'}` as never,
                    ),
                    nombre: c.respuesta.nombre,
                    dia: fecha(c.respuesta.cuando),
                  })}
                </span>
              ) : null}
              {c.respuesta?.firma ? (
                // eslint-disable-next-line @next/next/no-img-element -- la firma es un PNG en data URL
                <img
                  src={c.respuesta.firma}
                  alt={t('firmaDe', { nombre: c.respuesta.nombre })}
                  className="h-16 w-auto self-start"
                />
              ) : null}
              {c.hecho ? (
                <span className="text-emerald-800">{t('ocHecha', { dia: fecha(c.hecho.cuando) })}</span>
              ) : null}
            </div>
          ))}
        </Bloque>
      ) : null}

      {ver('cobros') && d.cobros ? (
        <Bloque titulo={t('nombres.cobros')}>
          {d.cobros.cobros.map((c) => (
            <Fila
              key={c.id}
              izquierda={t('cobroLinea', {
                dia: dia(c.fecha),
                folio: c.folio,
                concepto: c.ordenCambio
                  ? t('ocFolio', { folio: c.ordenCambio })
                  : tb(`conceptos.${c.concepto}` as never),
                metodo: tb(`metodos.${c.metodo}` as never),
              })}
              derecha={dinero(c.monto)}
            />
          ))}
          <Fila izquierda={<strong>{t('cobrado')}</strong>} derecha={dinero(d.cobros.cobrado)} />
          <Fila izquierda={t('porCobrar')} derecha={dinero(d.cobros.porCobrar)} />
        </Bloque>
      ) : null}

      {ver('subcontratos') && d.subcontratos ? (
        <Bloque titulo={t('nombres.subcontratos')}>
          {d.subcontratos.ordenes.length ? null : <p className="text-sm text-slate-600">{t('ninguno')}</p>}
          {d.subcontratos.ordenes.map((x) => (
            <div
              key={x.id}
              className="flex flex-col gap-0.5 border-b border-slate-100 py-2 text-sm break-inside-avoid"
            >
              <span className="flex justify-between gap-2 font-semibold">
                <span>
                  {t('otEncabezado', {
                    folio: x.folio,
                    sub: x.sub.nombre,
                    estado: ts(`estados.${x.estado}` as never),
                  })}
                </span>
                <span>{dinero(x.precio)}</span>
              </span>
              <span className="text-slate-700">
                {t('otDetalle', { espacio: x.espacio, partida: nombre(x.partida), alcance: x.alcance })}
              </span>
              <span className="text-slate-600">
                {t('otPagos', { pagado: dinero(x.pagado), saldo: dinero(x.saldo) })}
              </span>
            </div>
          ))}
        </Bloque>
      ) : null}

      {ver('diario') ? (
        <Bloque titulo={t('nombres.diario')}>
          {d.seguimiento.dias.map((x) => (
            <div
              key={x.dia}
              className="flex flex-col gap-0.5 border-b border-slate-100 py-2 text-sm break-inside-avoid"
            >
              <span className="font-semibold">
                {x.folio
                  ? t('diaCerrado', { dia: dia(x.dia), folio: x.folio })
                  : t('diaSinCerrar', { dia: dia(x.dia) })}
                {x.tardio ? ` ${t('tardio')}` : ''}
              </span>
              {x.sinTrabajo ? (
                <span className="text-slate-600">
                  {t('sinTrabajo', { motivo: x.motivo ? tm(`motivos.${x.motivo}` as never) : '' })}
                </span>
              ) : null}
              {x.partidas.length ? (
                <span>
                  {x.partidas
                    .map((p) =>
                      t(p.terminada ? 'partidaTerminada' : 'partida', {
                        espacio: p.espacio,
                        partida: nombre(p.partida),
                      }),
                    )
                    .join(t('separador'))}
                </span>
              ) : null}
              {x.cuadrilla.length ? (
                <span className="text-slate-700">
                  {x.cuadrilla
                    .map((c) =>
                      t(c.tipoPago === 'hora' ? 'cuadrillaHoras' : 'cuadrillaDias', {
                        nombre: c.nombre,
                        n: c.cantidad,
                      }),
                    )
                    .join(t('separador'))}
                </span>
              ) : null}
              {x.subs.length ? (
                <span className="text-slate-700">
                  {x.subs
                    .map((s) => t(s.llego ? 'subLlego' : 'subNoLlego', { sub: s.sub }))
                    .join(t('separador'))}
                </span>
              ) : null}
              {x.gastos.length ? (
                <span className="text-slate-700">
                  {x.gastos
                    .map((g) => t('gasto', { proveedor: g.proveedor, monto: dinero(g.monto) }))
                    .join(t('separador'))}
                </span>
              ) : null}
              {x.incidencia ? <span className="italic text-slate-700">{x.incidencia}</span> : null}
            </div>
          ))}
        </Bloque>
      ) : null}

      {ver('cuadrilla') ? (
        <Bloque titulo={t('nombres.cuadrilla')}>
          {d.seguimiento.cuadrilla.porTrabajador.map((c) => (
            <Fila
              key={c.nombre}
              izquierda={t(c.tipoPago === 'hora' ? 'cuadrillaHoras' : 'cuadrillaDias', {
                nombre: c.nombre,
                n: c.cantidad,
              })}
              derecha={dinero(c.costo)}
            />
          ))}
          <Fila izquierda={<strong>{t('total')}</strong>} derecha={dinero(d.seguimiento.cuadrilla.costo)} />
        </Bloque>
      ) : null}

      {ver('calidad') && d.calidad ? (
        <Bloque titulo={t('nombres.calidad')}>
          {d.calidad.inspecciones.map((i, k) => (
            <div
              key={k}
              className="flex flex-col gap-0.5 border-b border-slate-100 py-1 text-sm break-inside-avoid"
            >
              <span className="flex justify-between gap-2">
                <span className="font-semibold">
                  {t('inspeccion', { clave: i.clave, hito: nombre(i.hito), espacio: i.espacio })}
                </span>
                <span>
                  {t(i.resultado === 'aprobado' ? 'aprobada' : 'conDefectos', {
                    ok: i.puntosOk,
                    total: i.puntosTotal,
                  })}
                </span>
              </span>
              <span className="text-slate-600">{fecha(i.realizada)}</span>
              {i.defectos.length ? (
                <span className="text-red-800">{i.defectos.join(t('separador'))}</span>
              ) : null}
            </div>
          ))}
          {d.calidad.pruebas.map((p, k) => (
            <Fila
              key={`p${k}`}
              izquierda={t('pruebaAgua', { espacio: p.espacio, dia: fecha(p.inicio) })}
              derecha={t(`pruebas.${p.resultado}`)}
            />
          ))}
          {d.calidad.punch.map((p) => (
            <Fila
              key={p.folio}
              izquierda={t('punch', { folio: p.folio, item: p.item })}
              derecha={
                p.abierto
                  ? t('punchAbierto', { dia: dia(p.compromiso) })
                  : t('punchCerrado', { dia: p.cerrado ? fecha(p.cerrado) : '' })
              }
            />
          ))}
          {!d.calidad.inspecciones.length && !d.calidad.pruebas.length && !d.calidad.punch.length ? (
            <p className="text-sm text-slate-600">{t('ninguno')}</p>
          ) : null}
        </Bloque>
      ) : null}

      {ver('retrabajos') && d.retrabajos ? (
        <Bloque titulo={t('nombres.retrabajos')}>
          {d.retrabajos.registros.length ? null : <p className="text-sm text-slate-600">{t('ninguno')}</p>}
          {d.retrabajos.registros.map((x) => (
            <Fila
              key={x.id}
              izquierda={t('retrabajo', {
                folio: x.folio,
                tipo: tr(`tipos.${x.tipo}` as never),
                descripcion: x.descripcion,
                dia: fecha(x.creado),
              })}
              derecha={dinero(x.costo)}
            />
          ))}
        </Bloque>
      ) : null}

      {ver('entrega') && d.posventa ? (
        <Bloque titulo={t('nombres.entrega')}>
          <Fila izquierda={t('entregada')} derecha={dia(d.posventa.fechaEntrega)} />
          <Fila izquierda={t('garantiaHasta')} derecha={dia(d.posventa.garantiaVence)} />
          {Object.entries(d.posventa.pasos).map(([p, v]) => (
            <Fila
              key={p}
              izquierda={tp(`pasos.${p}` as never)}
              derecha={v === 'si' ? tp('si') : v === 'no' ? tp('no') : t('pendiente')}
            />
          ))}
        </Bloque>
      ) : null}

      {ver('fotos') ? (
        <Bloque titulo={t('nombres.fotos')}>
          {d.fotos.length ? null : <p className="text-sm text-slate-600">{t('ninguno')}</p>}
          {d.fotos.map((r) => (
            <div key={`${r.tipo}-${r.id}`} className="flex flex-col gap-1 break-inside-avoid">
              <span className="text-sm font-semibold">
                {t('fotosDe', {
                  dia: dia(r.dia),
                  registro: [r.folio, r.titulo ? nombre(r.titulo) : null].filter(Boolean).join(' · '),
                })}
              </span>
              <div className="grid grid-cols-3 gap-1">
                {r.fotos.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element -- las fotos de la obra, para el papel
                  <img
                    key={f}
                    src={`/fotos/${f}`}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded object-cover"
                  />
                ))}
              </div>
            </div>
          ))}
        </Bloque>
      ) : null}
    </main>
  );
}
