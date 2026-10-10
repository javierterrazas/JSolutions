'use client';
// Un tipo de obra nuevo (legacy: duCrearTipo y duClonarSecuencia): en blanco, con sus partidas una por renglón, o
// copiando uno que ya existe. Al crearse se abren sus partidas para afinarlas.
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { crearTipo } from '../acciones/catalogo';
import { estilos } from '../componentes/marco';
import { enviarSinVaciar } from '../componentes/enviar';
import { MensajeError } from '../componentes/mensaje-error';

export function NuevoTipo({ tipos }: { tipos: readonly { id: string; nombre: string }[] }) {
  const t = useTranslations('catalogo');
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<'blanco' | 'copiar'>('blanco');
  const [resultado, accion, enviando] = useActionState(crearTipo, null);
  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className={estilos.boton}
      >
        {t('nuevoTipo')}
      </button>
    );
  const pestana = (m: typeof modo) =>
    `min-h-11 flex-1 rounded-xl px-3 text-sm font-medium ${modo === m ? 'bg-marca text-white' : 'border border-marca/30 text-marca'}`;
  return (
    <form onSubmit={enviarSinVaciar(accion)} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <p className="font-semibold text-marca">{t('nuevoTipo')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setModo('blanco');
          }}
          className={pestana('blanco')}
        >
          {t('enBlanco')}
        </button>
        <button
          type="button"
          onClick={() => {
            setModo('copiar');
          }}
          className={pestana('copiar')}
        >
          {t('copiar')}
        </button>
      </div>
      <input type="hidden" name="modo" value={modo} />
      <p className="text-sm text-slate-600">{modo === 'blanco' ? t('enBlancoAyuda') : t('copiarAyuda')}</p>
      {modo === 'copiar' ? (
        <label className={estilos.etiqueta}>
          {t('copiarDesde')}
          <select name="desde" className={estilos.campo}>
            {tipos.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={estilos.etiqueta}>
        {t('nombreTipo')}
        <input
          name="nombre"
          required
          maxLength={80}
          placeholder={t('nombreTipoEjemplo')}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('nombreEn')}
        <input name="nombreEn" maxLength={80} className={estilos.campo} />
      </label>
      {modo === 'blanco' ? (
        <>
          <label className={estilos.etiqueta}>
            {t('partidasRenglones')}
            <textarea
              name="partidas"
              rows={6}
              placeholder={t('partidasEjemplo')}
              className={`${estilos.campo} py-2`}
            />
          </label>
          <label className={estilos.etiqueta}>
            {t('tamano')}
            <input name="tamano" inputMode="decimal" defaultValue="40" className={estilos.campo} />
            <span className="text-xs font-normal text-slate-500">{t('tamanoAyuda')}</span>
          </label>
        </>
      ) : null}
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {t('crearTipo')}
      </button>
    </form>
  );
}
