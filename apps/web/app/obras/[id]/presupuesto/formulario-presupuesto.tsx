'use client';
// El presupuesto por etapa (D-084): de cada etapa de cada espacio, lo que se espera gastar (costo) y el margen; el
// precio sale solo (costo / (1 − margen), el margen sobre el precio). Abajo, la suma de los costos y de los precios,
// y el contrato, que sigue a la suma de los precios hasta que el dueño lo cambia (por ejemplo, para redondearlo).
// Al guardar, la obra queda lista para arranque si cada espacio tiene al menos una etapa con costo. Con obras
// cerradas, cada etapa sugiere su costo según el tamaño del espacio (D-095), y se usa con un toque.
import { type AnalisisEtapa, costoSugerido, margenDe, precioConMargen, type UnidadEtapa } from '@ijm/core';
import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { guardarPresupuestoObra } from '../../../acciones/obras';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

interface Espacio {
  id: string;
  nombre: string;
  /** Sus medidas vigentes: con ellas sale el costo por unidad de cada etapa (D-086). */
  pies2: number;
  piesLineales: number;
  etapas: {
    etapaId: string | null;
    nombre: string | null;
    unidad: UnidadEtapa;
    /** Lo que ha costado en obras cerradas de este tipo de espacio (D-095). */
    historia: AnalisisEtapa | null;
    partidas: number;
    /** Su precio. */
    monto: number;
    costo: number | null;
  }[];
}

const clave = (espacioId: string, etapaId: string | null) => `${espacioId}|${etapaId ?? ''}`;
const numero = (s: string) => Number(s.replace(/[$,\s%]/g, '')) || 0;
/** Un margen escrito en por ciento (35) como fracción (0.35); null si está vacío o no sirve. */
const fraccion = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = numero(s) / 100;
  return n >= 0 && n < 1 ? n : null;
};
const porciento = (m: number) => String(Math.round(m * 1000) / 10);

export function FormularioPresupuesto({
  obraId,
  espacios,
  margenObjetivo,
  contrato: contratoInicial,
  conSugerido = true,
}: {
  obraId: string;
  espacios: readonly Espacio[];
  margenObjetivo: number;
  contrato: number | null;
  /** El costo sugerido sale del histórico (D-110). */
  conSugerido?: boolean;
}) {
  const t = useTranslations('presupuesto');
  const idioma = useLocale();
  const [resultado, accion, enviando] = useActionState(guardarPresupuestoObra, null);
  const [margenObra, setMargenObra] = useState(porciento(margenObjetivo));
  // de cada etapa, su costo y su margen propio (vacío: el de la obra). Las que solo tenían precio (de antes) traen
  // el costo que deja el margen de la obra.
  const [costos, setCostos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      espacios.flatMap((e) =>
        e.etapas.map((x) => {
          const costo = x.costo ?? (x.monto ? Math.round(x.monto * (1 - margenObjetivo) * 100) / 100 : 0);
          return [clave(e.id, x.etapaId), costo ? String(costo) : ''];
        }),
      ),
    ),
  );
  const [margenes, setMargenes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      espacios.flatMap((e) =>
        e.etapas.map((x) => {
          const m = x.costo !== null && x.monto ? margenDe(x.costo, x.monto) : null;
          const propio = m !== null && Math.abs(m - margenObjetivo) > 0.0005 && m >= 0 && m < 1;
          return [clave(e.id, x.etapaId), propio ? porciento(m) : ''];
        }),
      ),
    ),
  );

  // los pies lineales de los espacios con etapas que se cotizan por pie lineal (D-086)
  const [lineales, setLineales] = useState<Record<string, string>>(() =>
    Object.fromEntries(espacios.map((e) => [e.id, e.piesLineales ? String(e.piesLineales) : ''])),
  );
  const conLineal = (e: Espacio) => e.etapas.some((x) => x.unidad === 'pie_lineal');
  const medidaDe = (e: Espacio, unidad: UnidadEtapa) =>
    unidad === 'fijo' ? 0 : unidad === 'pie_lineal' ? numero(lineales[e.id] ?? '') : e.pies2;

  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const margenDeObra = fraccion(margenObra) ?? margenObjetivo;
  const precioDe = (k: string) => {
    const costo = numero(costos[k] ?? '');
    return costo ? precioConMargen(costo, fraccion(margenes[k] ?? '') ?? margenDeObra) : 0;
  };
  const claves = espacios.flatMap((e) => e.etapas.map((x) => clave(e.id, x.etapaId)));
  const costoTotal = claves.reduce((a, k) => a + numero(costos[k] ?? ''), 0);
  const precioTotal = Math.round(claves.reduce((a, k) => a + precioDe(k), 0) * 100) / 100;

  // el contrato sigue a la suma de los precios mientras el dueño no lo cambie; si ya era la suma, también
  const sumaInicial = espacios.reduce((a, e) => a + e.etapas.reduce((b, x) => b + x.monto, 0), 0);
  const [contratoEscrito, setContratoEscrito] = useState<string | null>(() =>
    contratoInicial === null || Math.abs(contratoInicial - sumaInicial) < 0.01
      ? null
      : String(contratoInicial),
  );
  const contrato = contratoEscrito === null ? precioTotal : numero(contratoEscrito);
  const margenContrato = costoTotal ? margenDe(costoTotal, contrato) : null;
  const nombreDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? id;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() =>
          accion({
            obraId,
            margenObjetivo: margenDeObra,
            contrato: contratoInicial === null ? null : contrato,
            medidas: espacios
              .filter(conLineal)
              .map((esp) => ({ espacioId: esp.id, piesLineales: numero(lineales[esp.id] ?? '') })),
            lineas: espacios.flatMap((esp) =>
              esp.etapas.map((x) => {
                const k = clave(esp.id, x.etapaId);
                return {
                  espacioId: esp.id,
                  etapaId: x.etapaId,
                  costo: numero(costos[k] ?? ''),
                  margen: fraccion(margenes[k] ?? ''),
                };
              }),
            ),
          }),
        );
      }}
      className="flex flex-col gap-4"
    >
      <label className={`${estilos.tarjeta} grid grid-cols-[1fr_6rem] items-center gap-3`}>
        <span className="flex flex-col">
          <span className="font-semibold">{t('margenObra')}</span>
          <span className="text-sm text-slate-600">{t('margenObraAyuda')}</span>
        </span>
        <span className="flex items-center gap-1">
          <input
            value={margenObra}
            onChange={(v) => setMargenObra(v.target.value)}
            inputMode="decimal"
            aria-label={t('margenObra')}
            className={`${estilos.campo} text-right`}
          />
          <span aria-hidden="true">{t('porciento')}</span>
        </span>
      </label>

      {espacios.map((e) => {
        const costoEspacio = e.etapas.reduce((a, x) => a + numero(costos[clave(e.id, x.etapaId)] ?? ''), 0);
        const precioEspacio = e.etapas.reduce((a, x) => a + precioDe(clave(e.id, x.etapaId)), 0);
        return (
          <fieldset key={e.id} className={`${estilos.tarjeta} flex flex-col gap-3`}>
            <legend className="px-1 font-semibold text-marca">{e.nombre}</legend>
            <p className="-mt-2 text-sm text-slate-600">
              {t('subtotales', { costo: dinero(costoEspacio), precio: dinero(precioEspacio) })}
            </p>
            {e.pies2 ? <p className="text-sm text-slate-600">{t('medidaPies2', { n: e.pies2 })}</p> : null}
            {conLineal(e) ? (
              <label className="grid grid-cols-[1fr_7rem] items-center gap-2 text-sm">
                <span>{t('piesLineales')}</span>
                <input
                  value={lineales[e.id] ?? ''}
                  onChange={(v) => setLineales((l) => ({ ...l, [e.id]: v.target.value }))}
                  inputMode="decimal"
                  aria-label={t('piesLinealesDe', { espacio: e.nombre })}
                  className={`${estilos.campo} text-right`}
                />
              </label>
            ) : null}
            {e.etapas.map((x) => {
              const k = clave(e.id, x.etapaId);
              const nombre = x.nombre ?? t('otras');
              return (
                <div key={k} className="flex flex-col gap-1 border-t border-slate-200 pt-2">
                  <p className="text-sm font-medium">
                    {t('etapaPartidas', { etapa: nombre, n: x.partidas })}
                  </p>
                  <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      {t('costo')}
                      <input
                        value={costos[k] ?? ''}
                        onChange={(v) => setCostos((c) => ({ ...c, [k]: v.target.value }))}
                        inputMode="decimal"
                        aria-label={t('costoDe', { etapa: nombre, espacio: e.nombre })}
                        className={`${estilos.campo} text-right`}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      {t('margen')}
                      <input
                        value={margenes[k] ?? ''}
                        onChange={(v) => setMargenes((m) => ({ ...m, [k]: v.target.value }))}
                        inputMode="decimal"
                        placeholder={porciento(margenDeObra)}
                        aria-label={t('margenDe', { etapa: nombre, espacio: e.nombre })}
                        className={`${estilos.campo} text-right`}
                      />
                    </label>
                  </div>
                  <p className="text-right text-sm">{t('precio', { precio: dinero(precioDe(k)) })}</p>
                  {/* lo que ha costado en obras cerradas, según el tamaño (D-095) */}
                  {(() => {
                    const s =
                      conSugerido && x.historia
                        ? costoSugerido(x.historia, {
                            pies2: e.pies2,
                            piesLineales: numero(lineales[e.id] ?? ''),
                          })
                        : null;
                    if (s === null || !x.historia) return null;
                    return (
                      <p className="flex items-center justify-end gap-2 text-xs text-slate-600">
                        <span>{t('sugerido', { costo: dinero(s), n: x.historia.n })}</span>
                        {numero(costos[k] ?? '') !== s ? (
                          <button
                            type="button"
                            onClick={() => setCostos((c) => ({ ...c, [k]: String(s) }))}
                            className="min-h-9 rounded-lg border border-marca px-2 font-semibold text-marca"
                          >
                            {t('usarSugerido')}
                          </button>
                        ) : null}
                      </p>
                    );
                  })()}
                  {/* el costo y el precio por la unidad de la etapa (D-086) */}
                  {numero(costos[k] ?? '') ? (
                    medidaDe(e, x.unidad) ? (
                      <p className="text-right text-xs text-slate-600">
                        {t(x.unidad === 'pie_lineal' ? 'porPieLineal' : 'porPie2', {
                          costo: dinero(numero(costos[k] ?? '') / medidaDe(e, x.unidad)),
                          precio: dinero(precioDe(k) / medidaDe(e, x.unidad)),
                        })}
                      </p>
                    ) : x.unidad === 'pie_lineal' ? (
                      <p className="text-right text-xs text-amber-800">{t('faltanLineales')}</p>
                    ) : x.unidad === 'fijo' ? (
                      <p className="text-right text-xs text-slate-600">{t('fijoPorEspacio')}</p>
                    ) : null
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        );
      })}

      <div className={`${estilos.tarjeta} flex flex-col gap-2`}>
        <p className="flex justify-between gap-2">
          <span>{t('costoTotal')}</span>
          <span className="font-semibold">{dinero(costoTotal)}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span>{t('precioTotal')}</span>
          <span className="font-semibold">{dinero(precioTotal)}</span>
        </p>
        {contratoInicial !== null ? (
          <>
            <label className="grid grid-cols-[1fr_9rem] items-center gap-2 border-t border-slate-200 pt-2">
              <span className="font-semibold text-marca">{t('contrato')}</span>
              <input
                value={contratoEscrito ?? String(precioTotal)}
                onChange={(v) => setContratoEscrito(v.target.value)}
                inputMode="decimal"
                aria-label={t('contrato')}
                className={`${estilos.campo} text-right font-semibold`}
              />
            </label>
            {contratoEscrito !== null ? (
              <button
                type="button"
                onClick={() => setContratoEscrito(null)}
                className="self-end text-sm text-marca underline"
              >
                {t('usarSuma')}
              </button>
            ) : (
              <p className="text-right text-xs text-slate-600">{t('contratoSigue')}</p>
            )}
            {margenContrato !== null ? (
              <p
                className={`text-right text-sm ${margenContrato < margenDeObra - 0.0005 ? 'text-amber-800' : 'text-slate-700'}`}
              >
                {t('margenContrato', { margen: `${porciento(margenContrato)}%` })}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      {resultado?.ok ? (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${resultado.datos.completo ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
        >
          {resultado.datos.completo
            ? t('completo')
            : t('incompleto', { espacios: resultado.datos.faltan.map(nombreDe).join(', ') })}
        </p>
      ) : null}
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('guardar')}
      </button>
    </form>
  );
}
