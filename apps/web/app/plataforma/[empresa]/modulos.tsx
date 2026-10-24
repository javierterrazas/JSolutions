'use client';
// Los módulos de una empresa (D-110): quien administra la plataforma los prende o apaga, uno por uno o con el plan de un
// toque. Prender uno prende lo que necesita; apagar uno apaga lo que depende de él. Nada se borra al apagar.
import { conLoQueNecesitan, type Modulo, MODULOS, MODULOS_DEL_PLAN, REQUIERE, sinElModulo } from '@ijm/core';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { guardarLosModulos } from '../../acciones/plataforma';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

export function ModulosDeLaEmpresa({
  empresaId,
  modulos,
}: {
  empresaId: string;
  modulos: readonly Modulo[];
}) {
  const t = useTranslations('modulos');
  const [elegidos, setElegidos] = useState<readonly Modulo[]>(modulos);
  const [r, accion, enviando] = useActionState(guardarLosModulos.bind(null, empresaId), null);
  const guardados = r?.ok ? r.datos : modulos;
  const cambio = elegidos.join() !== guardados.join();

  return (
    <form action={accion} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="text-lg font-bold text-marca">{t('titulo')}</h2>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODULOS_DEL_PLAN) as (keyof typeof MODULOS_DEL_PLAN)[]).map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => setElegidos(conLoQueNecesitan(MODULOS_DEL_PLAN[plan]))}
            className="min-h-10 rounded-full border-2 border-marca/30 px-3 text-sm font-semibold text-marca"
          >
            {t(`planes.${plan}`)}
          </button>
        ))}
      </div>
      <p className="text-sm font-medium text-slate-700">{t('base')}</p>
      <ul className="flex flex-col divide-y divide-slate-100">
        {MODULOS.map((m) => {
          const prendido = elegidos.includes(m);
          return (
            <li key={m}>
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2">
                <span className="flex flex-col">
                  <span className="font-medium">{t(`nombres.${m}`)}</span>
                  <span className="text-xs text-slate-600">{t(`descripciones.${m}`)}</span>
                  {REQUIERE[m]?.length ? (
                    <span className="text-xs text-slate-500">
                      {t('necesita', { modulos: REQUIERE[m]!.map((x) => t(`nombres.${x}`)).join(', ') })}
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  name="modulo"
                  value={m}
                  checked={prendido}
                  onChange={() =>
                    setElegidos(prendido ? sinElModulo(elegidos, m) : conLoQueNecesitan([...elegidos, m]))
                  }
                  className="size-6 shrink-0 accent-marca"
                />
              </label>
            </li>
          );
        })}
      </ul>
      {r?.ok && !cambio ? (
        <p role="status" className="text-sm font-semibold text-emerald-800">
          {t('guardados')}
        </p>
      ) : null}
      <MensajeError problema={r && !r.ok ? r : null} />
      <button type="submit" disabled={enviando || !cambio} className={estilos.boton}>
        {t('guardar')}
      </button>
    </form>
  );
}
