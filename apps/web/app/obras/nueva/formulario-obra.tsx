'use client';
// El alta de una obra: cliente, PM, fechas, contrato y sus espacios. Los campos son controlados: si algo falta, el
// dueño corrige sin volver a escribir todo.
import { useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import { crearObraNueva } from '../../acciones/obras';
import { estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

interface Espacio {
  clave: number;
  tipoEspacioId: string;
  nombre: string;
  pies2: string;
}

/** "28,500" o "$28500.50" → 28500.5; vacío → null. */
const numero = (s: string) => {
  const limpio = s.replace(/[$,\s]/g, '');
  return limpio === '' ? null : Number(limpio);
};

export function FormularioObra({
  tipos,
  pms,
}: {
  tipos: readonly { id: string; nombre: string; partidas: number }[];
  pms: readonly { id: string; nombre: string }[];
}) {
  const t = useTranslations('obraNueva');
  const [resultado, accion, enviando] = useActionState(crearObraNueva, null);
  const [obra, setObra] = useState({
    cliente: '',
    telefono: '',
    direccion: '',
    pmId: pms.length === 1 ? pms[0]!.id : '',
    inicio: '',
    finEstimada: '',
    contrato: '',
    notas: '',
  });
  const [espacios, setEspacios] = useState<Espacio[]>(
    tipos.length ? [{ clave: 0, tipoEspacioId: tipos[0]!.id, nombre: '', pies2: '' }] : [],
  );

  const campo = (k: keyof typeof obra) => ({
    value: obra[k],
    onChange: (e: { target: { value: string } }) => setObra((o) => ({ ...o, [k]: e.target.value })),
  });
  const cambiarEspacio = (clave: number, cambio: Partial<Espacio>) =>
    setEspacios((es) => es.map((e) => (e.clave === clave ? { ...e, ...cambio } : e)));

  function enviar(confirmado: string[]) {
    startTransition(() =>
      accion({
        cliente: obra.cliente,
        telefono: obra.telefono,
        direccion: obra.direccion,
        pmId: obra.pmId || null,
        inicio: obra.inicio || null,
        finEstimada: obra.finEstimada || null,
        contrato: numero(obra.contrato),
        notas: obra.notas || null,
        espacios: espacios.map((e) => ({
          tipoEspacioId: e.tipoEspacioId,
          nombre: e.nombre,
          pies2: numero(e.pies2),
        })),
        confirmado,
      }),
    );
  }

  const duplicada = resultado && !resultado.ok && resultado.codigo === 'obra_duplicada';
  const problema = resultado && !resultado.ok && !duplicada ? resultado : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar([]);
      }}
      className="flex flex-col gap-4"
    >
      <div className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <label className={estilos.etiqueta}>
          {t('cliente')}
          <input {...campo('cliente')} className={estilos.campo} autoComplete="off" />
        </label>
        <label className={estilos.etiqueta}>
          {t('telefono')}
          <input
            {...campo('telefono')}
            type="tel"
            inputMode="tel"
            className={estilos.campo}
            autoComplete="off"
          />
        </label>
        <label className={estilos.etiqueta}>
          {t('direccion')}
          <input {...campo('direccion')} className={estilos.campo} autoComplete="off" />
        </label>
        <label className={estilos.etiqueta}>
          {t('pm')}
          {pms.length ? (
            <select {...campo('pmId')} className={estilos.campo}>
              <option value="">{t('elegirPm')}</option>
              {pms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <span className={estilos.error}>{t('sinPms')}</span>
          )}
        </label>
        <div className="flex flex-col gap-3">
          <label className={estilos.etiqueta}>
            {t('inicio')}
            <input {...campo('inicio')} type="date" className={estilos.campo} />
          </label>
          <label className={estilos.etiqueta}>
            {t('entrega')}
            <input {...campo('finEstimada')} type="date" className={estilos.campo} />
          </label>
        </div>
        <label className={estilos.etiqueta}>
          {t('contrato')}
          <input {...campo('contrato')} inputMode="decimal" className={estilos.campo} autoComplete="off" />
        </label>
        <label className={estilos.etiqueta}>
          {t('notas')}
          <textarea {...campo('notas')} rows={2} className={`${estilos.campo} py-2`} />
        </label>
      </div>

      <fieldset className={`${estilos.tarjeta} flex flex-col gap-3`}>
        <legend className="px-1 font-semibold text-marca">{t('espacios')}</legend>
        <p className="text-sm text-slate-600">{t('espaciosAyuda')}</p>
        {espacios.map((e) => (
          <div key={e.clave} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <label className={estilos.etiqueta}>
                {t('tipo')}
                <select
                  value={e.tipoEspacioId}
                  onChange={(x) => cambiarEspacio(e.clave, { tipoEspacioId: x.target.value })}
                  className={estilos.campo}
                >
                  {tipos.map((ti) => (
                    <option key={ti.id} value={ti.id}>
                      {ti.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className={estilos.etiqueta}>
                {t('pies2')}
                <input
                  value={e.pies2}
                  onChange={(x) => cambiarEspacio(e.clave, { pies2: x.target.value })}
                  inputMode="decimal"
                  className={estilos.campo}
                />
              </label>
            </div>
            <label className={estilos.etiqueta}>
              {t('nombreEspacio')}
              <input
                value={e.nombre}
                onChange={(x) => cambiarEspacio(e.clave, { nombre: x.target.value })}
                placeholder={tipos.find((ti) => ti.id === e.tipoEspacioId)?.nombre}
                className={estilos.campo}
              />
            </label>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                {t('partidas', { n: tipos.find((ti) => ti.id === e.tipoEspacioId)?.partidas ?? 0 })}
              </span>
              {espacios.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setEspacios((es) => es.filter((x) => x.clave !== e.clave))}
                  className="min-h-11 px-2 font-medium text-red-700"
                >
                  {t('quitar')}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {tipos.length ? (
          <button
            type="button"
            onClick={() =>
              setEspacios((es) => [
                ...es,
                {
                  clave: Math.max(0, ...es.map((x) => x.clave)) + 1,
                  tipoEspacioId: tipos[0]!.id,
                  nombre: '',
                  pies2: '',
                },
              ])
            }
            className={estilos.botonSecundario}
          >
            {t('agregar')}
          </button>
        ) : null}
      </fieldset>

      <MensajeError problema={problema} />
      {duplicada ? (
        <div className={`${estilos.error} flex flex-col gap-2`}>
          <p>{t('duplicada')}</p>
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviar(['obra_duplicada'])}
            className={estilos.boton}
          >
            {t('crearIgual')}
          </button>
        </div>
      ) : null}
      <button type="submit" disabled={enviando || !pms.length} className={estilos.boton}>
        {t('crear')}
      </button>
    </form>
  );
}
