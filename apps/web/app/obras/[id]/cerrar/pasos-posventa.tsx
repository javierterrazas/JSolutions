'use client';
// Después de la entrega (D-090; legacy: la cosecha): las fotos autorizadas, la reseña pedida y recibida y el referido.
// Cada paso se marca o desmarca con un toque.
import type { PASOS_POSVENTA as Pasos, PasoPosventa } from '@ijm/servidor';
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
  pasos: Readonly<Record<PasoPosventa, boolean>>;
}) {
  const t = useTranslations('posventa');
  const [vista, marcar] = useOptimistic(pasos, (actual, [paso, hecho]: [PasoPosventa, boolean]) => ({
    ...actual,
    [paso]: hecho,
  }));
  const [, empezar] = useTransition();
  const [problema, setProblema] = useState<Problema | null>(null);
  return (
    <ul className={`${estilos.tarjeta} flex flex-col gap-1`}>
      {PASOS.map((p) => (
        <li key={p}>
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-6 accent-marca"
              checked={vista[p]}
              onChange={(e) => {
                const hecho = e.target.checked;
                empezar(async () => {
                  marcar([p, hecho]);
                  const r = await marcarPasoPosventa(obraId, p, hecho);
                  setProblema(r.ok ? null : r);
                });
              }}
            />
            {t(`pasos.${p}`)}
          </label>
        </li>
      ))}
      <MensajeError problema={problema} />
    </ul>
  );
}
