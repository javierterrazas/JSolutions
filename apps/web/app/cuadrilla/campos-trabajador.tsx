'use client';
// Los campos de un trabajador: nombre, puesto (la profesión), cómo cobra y teléfono. Cómo cobra no cambia si ya tiene
// días anotados: sus horas se leerían como días, o al revés.
import type { TrabajadorDeLaCuadrilla } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import { estilos } from '../componentes/marco';

export function CamposTrabajador({ trabajador }: { trabajador?: TrabajadorDeLaCuadrilla }) {
  const t = useTranslations('cuadrilla');
  const fijo = !!trabajador?.diasTrabajados;
  return (
    <>
      <label className={estilos.etiqueta}>
        {t('nombre')}
        <input
          name="nombre"
          required
          maxLength={80}
          defaultValue={trabajador?.nombre}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('puesto')}
        <input
          name="puesto"
          list="puestos"
          maxLength={80}
          defaultValue={trabajador?.puesto ?? ''}
          placeholder={t('puestoEjemplo')}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('tipoPago')}
        <select
          name="tipoPago"
          defaultValue={trabajador?.tipoPago ?? 'hora'}
          disabled={fijo}
          className={estilos.campo}
        >
          <option value="hora">{t('porHora')}</option>
          <option value="dia">{t('porDia')}</option>
        </select>
        {fijo ? <span className="text-xs font-normal text-slate-500">{t('tipoFijo')}</span> : null}
      </label>
      <label className={estilos.etiqueta}>
        {t('telefono')}
        <input
          name="telefono"
          type="tel"
          inputMode="tel"
          maxLength={40}
          defaultValue={trabajador?.telefono ?? ''}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
    </>
  );
}
