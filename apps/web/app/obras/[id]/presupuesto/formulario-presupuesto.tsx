'use client';
// El presupuesto por etapa: un monto por cada etapa de cada espacio. Al guardar, la obra queda lista para arranque
// si cada espacio tiene al menos una etapa con monto.
import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { formatoDinero } from '@/lib/dinero';
import { guardarPresupuestoObra } from '../../../acciones/obras';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

interface Espacio {
  id: string;
  nombre: string;
  etapas: { etapaId: string | null; nombre: string | null; partidas: number; monto: number }[];
}

const clave = (espacioId: string, etapaId: string | null) => `${espacioId}|${etapaId ?? ''}`;
const numero = (s: string) => Number(s.replace(/[$,\s]/g, '')) || 0;

export function FormularioPresupuesto({
  obraId,
  espacios,
}: {
  obraId: string;
  espacios: readonly Espacio[];
}) {
  const t = useTranslations('presupuesto');
  const idioma = useLocale();
  const [resultado, accion, enviando] = useActionState(guardarPresupuestoObra, null);
  const [montos, setMontos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      espacios.flatMap((e) => e.etapas.map((x) => [clave(e.id, x.etapaId), x.monto ? String(x.monto) : ''])),
    ),
  );
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  const total = Object.values(montos).reduce((a, m) => a + numero(m), 0);
  const nombreDe = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? id;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() =>
          accion({
            obraId,
            lineas: espacios.flatMap((esp) =>
              esp.etapas.map((x) => ({
                espacioId: esp.id,
                etapaId: x.etapaId,
                monto: numero(montos[clave(esp.id, x.etapaId)] ?? ''),
              })),
            ),
          }),
        );
      }}
      className="flex flex-col gap-4"
    >
      {espacios.map((e) => {
        const subtotal = e.etapas.reduce((a, x) => a + numero(montos[clave(e.id, x.etapaId)] ?? ''), 0);
        return (
          <fieldset key={e.id} className={`${estilos.tarjeta} flex flex-col gap-2`}>
            <legend className="flex w-full justify-between gap-2 px-1 font-semibold text-marca">
              <span>{e.nombre}</span>
              <span>{dinero(subtotal)}</span>
            </legend>
            {e.etapas.map((x) => (
              <label key={clave(e.id, x.etapaId)} className="grid grid-cols-[1fr_8rem] items-center gap-2">
                <span className="text-sm">
                  {x.nombre ?? t('otras')}
                  <br />
                  <span className="text-xs text-slate-500">{t('partidas', { n: x.partidas })}</span>
                </span>
                <input
                  value={montos[clave(e.id, x.etapaId)] ?? ''}
                  onChange={(v) => setMontos((m) => ({ ...m, [clave(e.id, x.etapaId)]: v.target.value }))}
                  inputMode="decimal"
                  className={`${estilos.campo} text-right`}
                />
              </label>
            ))}
          </fieldset>
        );
      })}
      <p className="text-right text-lg font-semibold text-marca">{t('total', { total: dinero(total) })}</p>
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
