'use client';
// Lo que le falta en papeles a un subcontratista: seguro y licencia (revisarPapelesSub). No bloquea: avisa.
import type { AvisoPapeles } from '@ijm/core';
import { useFormatter, useTranslations } from 'next-intl';

export function AvisosPapeles({ avisos }: { avisos: readonly AvisoPapeles[] }) {
  const t = useTranslations('subcontratistas');
  const formato = useFormatter();
  if (!avisos.length) return null;
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  return (
    <ul role="status" className="flex flex-col gap-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      {avisos.map((a) => (
        <li key={a.codigo}>{t(`avisos.${a.codigo}`, 'dia' in a ? { dia: dia(a.dia) } : {})}</li>
      ))}
    </ul>
  );
}
