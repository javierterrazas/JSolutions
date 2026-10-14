'use client';
// Los campos de una suscripción (D-080): plan, precio, ciclo, si está a prueba y hasta cuándo. En el alta y en la
// cuenta de cada empresa.
import { useTranslations } from 'next-intl';
import { estilos } from '../componentes/marco';

export interface ValoresSuscripcion {
  readonly plan: string;
  readonly precio: number;
  readonly ciclo: string;
  readonly enPrueba: boolean;
  readonly venceEl: string | null;
}

export function CamposSuscripcion({ valores }: { valores: ValoresSuscripcion }) {
  const t = useTranslations('plataforma');
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className={estilos.etiqueta}>
          {t('plan')}
          <select name="plan" defaultValue={valores.plan} className={estilos.campo}>
            {(['basico', 'pro', 'empresa'] as const).map((p) => (
              <option key={p} value={p}>
                {t(`planes.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={estilos.etiqueta}>
          {t('ciclo')}
          <select name="ciclo" defaultValue={valores.ciclo} className={estilos.campo}>
            <option value="mensual">{t('ciclos.mensual')}</option>
            <option value="anual">{t('ciclos.anual')}</option>
          </select>
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {t('precio')}
        <input
          name="precio"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          defaultValue={valores.precio}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('venceEl')}
        <input name="venceEl" type="date" defaultValue={valores.venceEl ?? ''} className={estilos.campo} />
        <span className="text-sm font-normal text-slate-600">{t('venceElAyuda')}</span>
      </label>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input name="enPrueba" type="checkbox" defaultChecked={valores.enPrueba} className="size-5" />
        {t('enPrueba')}
      </label>
    </>
  );
}
