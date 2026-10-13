'use client';
// El formulario para corregir los datos de una obra: lleno con los que tiene. Si el PM cambia, avisa qué pasa.
import type { DatosDeObra } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { corregirDatosObra } from '../../../acciones/obras';
import { enviarSinVaciar } from '../../../componentes/enviar';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function FormularioDatos({ obra }: { obra: DatosDeObra }) {
  const t = useTranslations('datosObra');
  const tn = useTranslations('obraNueva');
  const [resultado, accion, enviando] = useActionState(corregirDatosObra.bind(null, obra.id), null);
  const [pmId, setPmId] = useState(obra.pmId);

  return (
    <form onSubmit={enviarSinVaciar(accion)} className="flex flex-col gap-4">
      <label className={estilos.etiqueta}>
        {tn('cliente')}
        <input
          name="cliente"
          required
          maxLength={200}
          defaultValue={obra.cliente}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {tn('telefono')}
        <input
          name="telefono"
          type="tel"
          required
          maxLength={40}
          defaultValue={obra.telefono}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {tn('direccion')}
        <input
          name="direccion"
          required
          maxLength={200}
          defaultValue={obra.direccion}
          autoComplete="off"
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {tn('pm')}
        <select name="pmId" value={pmId} onChange={(e) => setPmId(e.target.value)} className={estilos.campo}>
          {obra.pms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.activo ? p.nombre : t('inactivo', { nombre: p.nombre })}
            </option>
          ))}
        </select>
      </label>
      {pmId !== obra.pmId ? (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {t('cambioDePm')}
        </p>
      ) : null}
      <label className={estilos.etiqueta}>
        {tn('notas')}
        <textarea
          name="notas"
          rows={3}
          maxLength={2000}
          defaultValue={obra.notas ?? ''}
          className={estilos.campo}
        />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="flex gap-2">
        <Link
          href={`/obras/${obra.id}/seguimiento`}
          className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
        >
          {t('cancelar')}
        </Link>
        <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1`}>
          {enviando ? t('guardando') : t('guardar')}
        </button>
      </div>
    </form>
  );
}
