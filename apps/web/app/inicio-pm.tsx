// El inicio del PM (fase 2, paso 3): lo primero que ve al abrir la app en la obra. Arriba lo urgente (los días que
// le faltó cerrar), luego sus obras, su semana y lo pendiente. Solo muestra; no hay nada que calcular aquí: todo
// viene de inicioDelPm (packages/servidor), con las reglas de @ijm/core.
import type { InicioPm } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { estilos } from './componentes/marco';

type Nombre = { es: string; en: string | null };

const FORMATOS = {
  corto: { weekday: 'short', day: 'numeric', month: 'short' },
  largo: { weekday: 'long', day: 'numeric', month: 'long' },
  semana: { weekday: 'long', day: 'numeric', month: 'short' },
} as const;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-marca/80 uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

export async function InicioDelPm({ datos }: { datos: InicioPm }) {
  const [t, formato, idioma] = await Promise.all([getTranslations('inicioPm'), getFormatter(), getLocale()]);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string, como: keyof typeof FORMATOS = 'corto') =>
    formato.dateTime(new Date(`${d}T12:00:00`), FORMATOS[como]);
  const nombre = (n: Nombre) => (idioma === 'en' ? n.en : null) ?? n.es;
  const pct = (x: number) => Math.round(x * 100);
  const dinero = formatoDinero(idioma);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-medium text-slate-600">{t('racha', { n: datos.racha })}</p>

      {datos.obras.flatMap((o) =>
        o.diasSinCierre.map((d) => (
          <p key={`${o.id}-${d}`} role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {t('faltoCerrar', {
              dia: dia(d, 'largo'),
              obra: o.folio,
            })}
          </p>
        )),
      )}

      <Seccion titulo={t('obras')}>
        {datos.obras.length === 0 ? <p className="text-slate-600">{t('sinObras')}</p> : null}
        {datos.obras.map((o) => (
          <article key={o.id} className={`${estilos.tarjeta} flex flex-col gap-2`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{t('encabezado', { folio: o.folio, cliente: o.cliente })}</h3>
              <span className="text-sm text-slate-600">{t(`estado.${o.estado}`)}</span>
            </div>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(o.direccion)}`}
              className="text-sm text-marca underline"
            >
              {o.direccion}
            </a>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={t('avance', { pct: pct(o.avance.pct) })}
            >
              <div className="bg-marca" style={{ width: `${pct(o.avance.pct)}%` }} />
              <div className="bg-marca/30" style={{ width: `${pct(o.avance.curso)}%` }} />
            </div>
            <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
              <span>{t('avance', { pct: pct(o.avance.pct) })}</span>
              {o.avance.curso > 0 ? <span>{t('enCurso', { pct: pct(o.avance.curso) })}</span> : null}
              <span>{t('partidas', o.partidas)}</span>
            </p>
            <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
              <span>{t('entrega', { dia: dia(o.entregaComprometida) })}</span>
              {o.entregaPrevista ? <span>{t('prevista', { dia: dia(o.entregaPrevista) })}</span> : null}
              {o.atrasoPrevisto > 0 ? (
                <span className="font-semibold text-red-700">{t('tarde', { n: o.atrasoPrevisto })}</span>
              ) : null}
            </p>
            {o.estado === 'en_obra' ? (
              <p className={`text-sm font-medium ${o.cerradoHoy ? 'text-emerald-700' : 'text-amber-700'}`}>
                {o.cerradoHoy ? t('cerradoHoy') : t('sinCerrarHoy')}
              </p>
            ) : null}
            {o.inspeccionesPendientes.length ? (
              <div className="text-sm text-slate-700">
                <p className="font-medium">{t('inspecciones')}</p>
                <ul className="list-disc pl-5">
                  {o.inspeccionesPendientes.map((i) => (
                    <li key={`${i.espacio}-${i.hito}`}>
                      {t('inspeccion', { espacio: i.espacio, hito: i.hito, nombre: nombre(i.nombre) })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </Seccion>

      {datos.semana.length ? (
        <Seccion titulo={t('semana')}>
          <ol className={`${estilos.tarjeta} flex flex-col divide-y divide-slate-100 p-0`}>
            {datos.semana.map((d) => (
              <li key={d.dia} className="flex flex-col gap-1 p-3">
                <p
                  className={`text-sm font-semibold ${d.dia === datos.hoy ? 'text-marca' : 'text-slate-800'}`}
                >
                  {dia(d.dia, 'semana')}
                </p>
                {d.partidas.length === 0 && d.llegan.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('libre')}</p>
                ) : null}
                {d.partidas.map((p, i) => (
                  <p key={i} className="text-sm text-slate-700">
                    {t('partidaDia', { obra: p.obra, espacio: p.espacio, partida: nombre(p.nombre) })}
                  </p>
                ))}
                {d.llegan.map((l, i) => (
                  <p key={i} className="text-sm font-medium text-marca">
                    {t('llega', l)}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        </Seccion>
      ) : null}

      {datos.porConfirmar.length ? (
        <Seccion titulo={t('porConfirmar')}>
          <ul className="flex flex-col gap-2">
            {datos.porConfirmar.map((o) => (
              <li
                key={o.folio}
                className={`${estilos.tarjeta} flex items-center justify-between gap-2 text-sm`}
              >
                <span>{t('ordenConfirmar', { sub: o.sub, dia: dia(o.inicio), obra: o.obra })}</span>
                {o.telefono ? (
                  <a href={`tel:${o.telefono}`} className="font-medium text-marca underline">
                    {o.telefono}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {datos.cambios.length ? (
        <Seccion titulo={t('cambios')}>
          <ul className="flex flex-col gap-2">
            {datos.cambios.map((c) => (
              <li key={c.folio} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
                <span>
                  {c.nueva ? (
                    <span className="mr-2 rounded-full bg-marca px-2 py-0.5 text-xs font-semibold text-white">
                      {t('nueva')}
                    </span>
                  ) : null}
                  {t('cambio', { descripcion: c.descripcion, obra: c.obra })}
                </span>
                <span className="text-slate-600">{t('cambioDias', { n: c.dias })}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {datos.avisosAbiertos.length ? (
        <Seccion titulo={t('avisos')}>
          <ul className="flex flex-col gap-2">
            {datos.avisosAbiertos.map((a) => (
              <li key={a.folio} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
                <span>{t('aviso', { descripcion: a.descripcion })}</span>
                <span className="text-slate-500">
                  {a.obra
                    ? t('avisoObra', { obra: a.obra, dia: dia(a.dia) })
                    : t('avisoSinObra', { dia: dia(a.dia) })}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {datos.respuestas.length ? (
        <Seccion titulo={t('respuestas')}>
          <ul className="flex flex-col gap-2">
            {datos.respuestas.map((a) => (
              <li key={a.folio} className={`${estilos.tarjeta} flex flex-col gap-1 text-sm`}>
                <span className="text-slate-600">{t('aviso', { descripcion: a.descripcion })}</span>
                <span className="font-medium">{a.respuesta}</span>
                <span className="text-slate-500">
                  {a.obra
                    ? t('avisoObra', { obra: a.obra, dia: dia(a.dia) })
                    : t('avisoSinObra', { dia: dia(a.dia) })}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {datos.sinRecibo.length ? (
        <Seccion titulo={t('sinRecibo')}>
          <ul className="flex flex-col gap-2">
            {datos.sinRecibo.map((g) => (
              <li key={g.folio} className={`${estilos.tarjeta} text-sm`}>
                {t('gasto', { proveedor: g.proveedor, monto: dinero.format(g.monto), dia: dia(g.dia) })}
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}
    </div>
  );
}
