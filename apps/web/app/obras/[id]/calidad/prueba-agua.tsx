'use client';
// La prueba de inundación de un espacio (legacy: bloqueAgua de PM.html): arrancarla con la foto del nivel, y a las
// 24 horas cerrarla con otra foto, sin fuga o con fuga. Es el registro que defiende de la reclamación de garantía
// más cara.
import type { PruebaAgua as Prueba } from '@ijm/servidor';
import { useFormatter, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { arrancarPrueba, cerrarPrueba } from '../../../acciones/calidad';
import { agregarAlFormulario, CampoFotos, type FotoTomada } from '../../../componentes/campo-fotos';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

/** Desde cuántas horas se puede cerrar: menos de 23 no cuenta (core: cerrarPruebaAgua). */
const HORAS_MINIMAS = 23;

export function PruebaAgua({
  obraId,
  espacioId,
  prueba,
  ahora,
}: {
  obraId: string;
  espacioId: string;
  prueba: Prueba | null;
  /** La hora del servidor al mostrar la página (ISO). */
  ahora: string;
}) {
  const t = useTranslations('calidad');
  const formato = useFormatter();
  const [fotos, setFotos] = useState<readonly FotoTomada[]>([]);
  const [inicio, arrancar, arrancando] = useActionState(
    arrancarPrueba.bind(null, { obraId, espacioId }),
    null,
  );
  const [fin, cerrar, cerrando] = useActionState(
    cerrarPrueba.bind(null, { obraId, pruebaId: prueba?.id ?? '' }),
    null,
  );
  const cuando = (iso: string) =>
    formato.dateTime(new Date(iso), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const enviar = (accion: (f: FormData) => void, extra?: (f: FormData) => void) => {
    const f = new FormData();
    agregarAlFormulario(f, fotos);
    extra?.(f);
    startTransition(() => {
      accion(f);
    });
  };

  if (prueba?.resultado === 'en_curso') {
    const horas = Math.round(((Date.parse(ahora) - Date.parse(prueba.inicio)) / 3_600_000) * 10) / 10;
    const lista = horas >= HORAS_MINIMAS;
    return (
      <div
        className={`${estilos.tarjeta} flex flex-col gap-3 ${lista ? 'border-emerald-300' : 'border-amber-300'}`}
      >
        <p className="font-semibold">{t('pruebaEnCurso')}</p>
        <p className="text-sm text-slate-700">
          {t('pruebaLlevan', { inicio: cuando(prueba.inicio), horas })}
        </p>
        {lista ? (
          <>
            <CampoFotos fotos={fotos} alCambiar={setFotos} una etiqueta={t('fotoNivelAhora')} />
            <MensajeError problema={fin && !fin.ok ? fin : null} />
            <button
              type="button"
              disabled={cerrando}
              onClick={() => enviar(cerrar)}
              className={`${estilos.boton} bg-emerald-700`}
            >
              {t('sinFugas')}
            </button>
            <button
              type="button"
              disabled={cerrando}
              onClick={() => {
                if (window.confirm(t('confirmarFuga'))) enviar(cerrar, (f) => f.set('fuga', 'si'));
              }}
              className={estilos.botonSecundario}
            >
              {t('hayFuga')}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-600">{t('pruebaVuelve')}</p>
        )}
      </div>
    );
  }
  if (prueba?.resultado === 'sin_fugas')
    return (
      <div className={`${estilos.tarjeta} border-emerald-300 bg-emerald-50`}>
        <p className="font-semibold text-emerald-800">{t('pruebaAprobada')}</p>
        <p className="text-sm text-emerald-900">
          {t('pruebaDeA', { inicio: cuando(prueba.inicio), fin: cuando(prueba.fin ?? prueba.inicio) })}
        </p>
      </div>
    );
  return (
    <div className={`${estilos.tarjeta} flex flex-col gap-3 border-red-300`}>
      <p className="font-semibold text-red-800">{t('faltaPrueba')}</p>
      {prueba?.resultado === 'con_fuga' ? <p className="text-sm text-red-800">{t('ultimaConFuga')}</p> : null}
      <p className="text-sm text-slate-700">{t('pruebaComo')}</p>
      <CampoFotos fotos={fotos} alCambiar={setFotos} una etiqueta={t('fotoNivelInicio')} />
      <MensajeError problema={inicio && !inicio.ok ? inicio : null} />
      <button type="button" disabled={arrancando} onClick={() => enviar(arrancar)} className={estilos.boton}>
        {t('arrancarPrueba')}
      </button>
    </div>
  );
}
