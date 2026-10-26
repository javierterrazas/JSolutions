'use client';
// La cuadrilla del cierre cuando la empresa tiene la checada (D-117): no se captura; son las checadas de la obra ese
// día (quién entró, a qué hora, si ya salió y lo que se le contó). Las horas de quien sigue dentro se cuentan cuando
// cheque su salida.
import { useFormatter, useTranslations } from 'next-intl';
import { estilos } from '../../../componentes/marco';

export interface ChecadaDelCierre {
  readonly trabajador: string;
  readonly entrada: string;
  readonly salida: string | null;
  readonly horas: number | null;
}

export function CuadrillaChecada({ checadas }: { checadas: readonly ChecadaDelCierre[] }) {
  const t = useTranslations('cierre');
  const formato = useFormatter();
  const hora = (iso: string) => formato.dateTime(new Date(iso), { hour: 'numeric', minute: '2-digit' });
  return (
    <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
      <legend className="px-1 font-semibold text-marca">{t('cuadrillaChecada')}</legend>
      <p className="text-sm text-slate-600">{t('cuadrillaChecadaAyuda')}</p>
      {checadas.length === 0 ? <p className="text-sm text-slate-700">{t('nadieCheco')}</p> : null}
      <ul className="flex flex-col gap-1 text-sm">
        {checadas.map((c, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="font-medium">{c.trabajador}</span>
            <span className={c.salida ? 'text-slate-700' : 'text-emerald-800'}>
              {c.salida
                ? t('checadaCompleta', {
                    entrada: hora(c.entrada),
                    salida: hora(c.salida),
                    horas: c.horas ?? 0,
                  })
                : t('checadaDentro', { entrada: hora(c.entrada) })}
            </span>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
