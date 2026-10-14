'use client';
// Los datos de un subcontratista: quién es, cómo se le localiza y sus papeles (seguro, licencia, W-9). Llenos con lo
// que tiene al editarlo.
import type { Nombre, Subcontratista } from '@ijm/servidor';
import { useLocale, useTranslations } from 'next-intl';
import { estilos } from '../componentes/marco';

export interface OficioDelSub {
  readonly id: string;
  readonly nombre: Nombre;
  readonly requiereLicencia: boolean;
}

export function CamposSub({ oficios, sub }: { oficios: readonly OficioDelSub[]; sub?: Subcontratista }) {
  const t = useTranslations('subcontratistas');
  const idioma = useLocale();
  const nombre = (n: Nombre) => (idioma === 'en' ? n.en : null) ?? n.es;
  return (
    <>
      <label className={estilos.etiqueta}>
        {t('nombre')}
        <input name="nombre" required maxLength={200} defaultValue={sub?.nombre} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('oficio')}
        <select name="oficio" required defaultValue={sub?.oficio.id ?? ''} className={estilos.campo}>
          <option value="" disabled>
            {t('elegirOficio')}
          </option>
          {oficios.map((o) => (
            <option key={o.id} value={o.id}>
              {o.requiereLicencia ? t('oficioConLicencia', { oficio: nombre(o.nombre) }) : nombre(o.nombre)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('telefono')}
          <input
            name="telefono"
            type="tel"
            required
            maxLength={40}
            defaultValue={sub?.telefono ?? ''}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('contacto')}
          <input
            name="contacto"
            maxLength={200}
            defaultValue={sub?.contacto ?? ''}
            className={estilos.campo}
          />
        </label>
      </div>
      <label className={estilos.etiqueta}>
        {t('correo')}
        <input
          name="correo"
          type="email"
          maxLength={200}
          defaultValue={sub?.correo ?? ''}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('seguro')}
        <input name="seguro" type="date" defaultValue={sub?.seguroVence ?? ''} className={estilos.campo} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={estilos.etiqueta}>
          {t('licencia')}
          <input
            name="licencia"
            maxLength={80}
            defaultValue={sub?.licencia ?? ''}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('licenciaVence')}
          <input
            name="licenciaVence"
            type="date"
            defaultValue={sub?.licenciaVence ?? ''}
            className={estilos.campo}
          />
        </label>
      </div>
      <label className="flex min-h-12 items-center gap-3 text-base font-medium text-slate-800">
        <input name="w9" type="checkbox" defaultChecked={sub?.w9} className="size-6" />
        {t('w9')}
      </label>
    </>
  );
}
