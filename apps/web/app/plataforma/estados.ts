// El color de cada estado de una suscripción (D-080), en la lista y en la cuenta de cada empresa.
import type { EstadoSuscripcion } from '@ijm/core';

export const COLOR_ESTADO: Record<EstadoSuscripcion, string> = {
  activa: 'bg-emerald-100 text-emerald-900',
  prueba: 'bg-sky-100 text-sky-900',
  por_vencer: 'bg-amber-100 text-amber-900',
  gracia: 'bg-red-100 text-red-900',
  solo_lectura: 'bg-red-200 text-red-950',
  suspendida: 'bg-slate-300 text-slate-900',
};
