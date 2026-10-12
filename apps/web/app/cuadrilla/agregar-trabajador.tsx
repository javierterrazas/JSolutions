'use client';
// Dar de alta a un trabajador: su nombre, su puesto, cómo cobra y su salario (desde hoy).
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { darDeAlta } from '../acciones/cuadrilla';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { CamposTrabajador } from './campos-trabajador';

export function AgregarTrabajador() {
  const t = useTranslations('cuadrilla');
  const [abierto, setAbierto] = useState(false);
  // dado de alta, el formulario se cierra
  const [resultado, accion, enviando] = useActionState(
    async (previo: Awaited<ReturnType<typeof darDeAlta>> | null, f: FormData) => {
      const r = await darDeAlta(previo, f);
      if (r.ok) setAbierto(false);
      return r;
    },
    null,
  );
  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className={estilos.boton}>
        {t('agregar')}
      </button>
    );
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('agregar')}</h2>
      <CamposTrabajador />
      <label className={estilos.etiqueta}>
        {t('salario')}
        <input name="tarifa" inputMode="decimal" required autoComplete="off" className={estilos.campo} />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={`${estilos.botonSecundario} flex-1`}
        >
          {t('cancelar')}
        </button>
        <button type="submit" disabled={enviando} className={`${estilos.boton} flex-1`}>
          {t('guardar')}
        </button>
      </div>
    </form>
  );
}
