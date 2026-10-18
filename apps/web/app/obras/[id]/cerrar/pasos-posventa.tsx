'use client';
// Después de la entrega (D-090; legacy: la cosecha): las fotos autorizadas, la reseña pedida y recibida y el referido.
// Cada paso, "Sí" o "No" con un toque (D-098): el "No" es que el cliente no quiso, y lo saca de los pendientes. Tocar
// el que ya está marcado lo regresa a pendiente.
import type { PASOS_POSVENTA as Pasos, PasoPosventa, ValorPaso } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { useOptimistic, useState, useTransition } from 'react';
import { marcarPasoPosventa } from '../../../acciones/posventa';
import { estilos } from '../../../componentes/marco';
import { MensajeError, type Problema } from '../../../componentes/mensaje-error';

/** En el orden en que pasan (el tipo los revisa contra el servidor). */
const PASOS = [
  'autoriza_fotos',
  'resena_pedida',
  'resena_recibida',
  'referido_pedido',
] as const satisfies typeof Pasos;

export function PasosPosventa({
  obraId,
  pasos,
}: {
  obraId: string;
  pasos: Readonly<Record<PasoPosventa, ValorPaso>>;
}) {
  const t = useTranslations('posventa');
  const [vista, marcar] = useOptimistic(pasos, (actual, [paso, valor]: [PasoPosventa, ValorPaso]) => ({
    ...actual,
    [paso]: valor,
  }));
  const [, empezar] = useTransition();
  const [problema, setProblema] = useState<Problema | null>(null);
  const poner = (p: PasoPosventa, valor: 'si' | 'no') => {
    const nuevo = vista[p] === valor ? null : valor;
    empezar(async () => {
      marcar([p, nuevo]);
      const r = await marcarPasoPosventa(obraId, p, nuevo);
      setProblema(r.ok ? null : r);
    });
  };
  return (
    <div className={`${estilos.tarjeta} flex flex-col gap-2`}>
      <p className="text-sm text-slate-600">{t('ayudaPasos')}</p>
      <ul className="flex flex-col gap-1">
        {PASOS.map((p) => (
          <li key={p} role="group" aria-label={t(`pasos.${p}`)} className="flex min-h-12 items-center gap-2">
            <span className={`flex-1 ${vista[p] === 'no' ? 'text-slate-500' : ''}`}>{t(`pasos.${p}`)}</span>
            {(['si', 'no'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista[p] === v}
                onClick={() => poner(p, v)}
                className={`min-h-11 w-14 rounded-lg border text-sm font-semibold ${
                  vista[p] === v
                    ? v === 'si'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-600 bg-slate-600 text-white'
                    : 'border-slate-300 text-slate-700'
                }`}
              >
                {t(v)}
              </button>
            ))}
          </li>
        ))}
      </ul>
      <MensajeError problema={problema} />
    </div>
  );
}
