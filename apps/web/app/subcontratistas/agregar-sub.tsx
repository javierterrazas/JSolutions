'use client';
// Dar de alta un subcontratista. Guardado, avisa lo que le falta en papeles, si algo.
import type { AvisoPapeles } from '@ijm/core';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { guardarSub } from '../acciones/subcontratistas';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { AvisosPapeles } from './avisos-papeles';
import { CamposSub, type OficioDelSub } from './campos-sub';

export function AgregarSub({ oficios }: { oficios: readonly OficioDelSub[] }) {
  const t = useTranslations('subcontratistas');
  const [abierto, setAbierto] = useState(false);
  const [avisos, setAvisos] = useState<readonly AvisoPapeles[] | null>(null);
  const [resultado, accion, enviando] = useActionState(
    async (previo: Awaited<ReturnType<typeof guardarSub>> | null, f: FormData) => {
      const r = await guardarSub(null, previo, f);
      if (r.ok) {
        setAbierto(false);
        setAvisos(r.datos.avisos);
      }
      return r;
    },
    null,
  );
  if (!abierto)
    return (
      <div className="flex flex-col gap-2">
        {avisos ? (
          <>
            <p role="status" className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
              {t('guardado')}
            </p>
            <AvisosPapeles avisos={avisos} />
          </>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setAvisos(null);
            setAbierto(true);
          }}
          className={estilos.boton}
        >
          {t('agregar')}
        </button>
      </div>
    );
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <h2 className="font-semibold text-marca">{t('agregar')}</h2>
      <CamposSub oficios={oficios} />
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
