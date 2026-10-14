'use client';
// Un subcontratista: su oficio, cómo localizarlo, sus papeles y sus órdenes abiertas; editarlo, y darlo de baja o
// reactivarlo. De baja ya no se le emiten órdenes; las abiertas siguen.
import type { Subcontratista } from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { alternarSub, guardarSub } from '../acciones/subcontratistas';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { AvisosPapeles } from './avisos-papeles';
import { CamposSub, type OficioDelSub } from './campos-sub';

export function TarjetaSub({ sub: x, oficios }: { sub: Subcontratista; oficios: readonly OficioDelSub[] }) {
  const t = useTranslations('subcontratistas');
  const formato = useFormatter();
  const idioma = useLocale();
  const [editando, setEditando] = useState(false);
  const [edicion, editar, guardando] = useActionState(
    async (previo: Awaited<ReturnType<typeof guardarSub>> | null, f: FormData) => {
      const r = await guardarSub(x.id, previo, f);
      if (r.ok) setEditando(false);
      return r;
    },
    null,
  );
  const [baja, alternar, alternando] = useActionState(alternarSub.bind(null, x.id, !x.activo), null);
  const oficio = (idioma === 'en' ? x.oficio.nombre.en : null) ?? x.oficio.nombre.es;
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });

  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-2 ${x.activo ? '' : 'opacity-70'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{x.nombre}</h3>
        <span className="text-sm text-slate-700">{oficio}</span>
      </div>
      <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
        {x.telefono ? (
          <a href={`tel:${x.telefono}`} className="font-medium text-marca underline">
            {x.telefono}
          </a>
        ) : null}
        {x.contacto ? <span>{x.contacto}</span> : null}
        {x.correo ? (
          <a href={`mailto:${x.correo}`} className="text-marca underline">
            {x.correo}
          </a>
        ) : null}
      </p>
      <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
        {x.seguroVence ? <span>{t('seguroHasta', { dia: dia(x.seguroVence) })}</span> : null}
        {x.licencia ? <span>{t('licenciaNum', { licencia: x.licencia })}</span> : null}
        <span className={x.w9 ? 'text-emerald-800' : 'text-amber-800'}>{x.w9 ? t('conW9') : t('sinW9')}</span>
      </p>
      {x.activo ? <AvisosPapeles avisos={x.avisos} /> : null}
      {x.ordenesAbiertas ? (
        <p className="text-sm font-medium text-slate-800">{t('abiertas', { n: x.ordenesAbiertas })}</p>
      ) : null}
      {baja?.ok && !x.activo && baja.datos.abiertas ? (
        <p role="status" className="text-sm text-amber-900">
          {t('bajaConAbiertas', { n: baja.datos.abiertas })}
        </p>
      ) : null}

      {editando ? (
        <form
          onSubmit={enviarSinVaciar(editar)}
          className="flex flex-col gap-3 border-t border-slate-100 pt-3"
        >
          <CamposSub oficios={oficios} sub={x} />
          <MensajeError problema={edicion && !edicion.ok ? edicion : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={guardando} className={`${estilos.boton} flex-1`}>
              {t('guardar')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <MensajeError problema={baja && !baja.ok ? baja : null} />
          <div className="grid grid-cols-2 gap-2">
            {x.activo ? (
              <button type="button" onClick={() => setEditando(true)} className={estilos.botonSecundario}>
                {t('editar')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={alternando}
              onClick={() => startTransition(() => alternar())}
              className={`${estilos.botonSecundario} ${x.activo ? 'text-red-700' : 'col-span-2'}`}
            >
              {x.activo ? t('darDeBaja') : t('reactivar')}
            </button>
          </div>
        </>
      )}
    </li>
  );
}
