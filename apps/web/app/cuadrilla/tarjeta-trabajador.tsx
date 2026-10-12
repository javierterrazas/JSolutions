'use client';
// Un trabajador de la cuadrilla: su puesto, cómo cobra, su salario y sus días anotados; y editarlo, cambiarle el
// salario desde una fecha (lo trabajado antes no cambia), o darlo de baja y reactivarlo.
import type { TrabajadorDeLaCuadrilla } from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { startTransition, useActionState, useState } from 'react';
import type { Resultado } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { cambiarActivo, guardarTrabajador, nuevoSalario } from '../acciones/cuadrilla';
import { enviarSinVaciar } from '../componentes/enviar';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { CamposTrabajador } from './campos-trabajador';

type Abierto = 'editar' | 'salario' | null;

export function TarjetaTrabajador({
  trabajador: x,
  hoy,
}: {
  trabajador: TrabajadorDeLaCuadrilla;
  /** Hoy en la zona de la empresa (lo dice el servidor). */
  hoy: string;
}) {
  const t = useTranslations('cuadrilla');
  const formato = useFormatter();
  const dinero = formatoDinero(useLocale());
  const [abierto, setAbierto] = useState<Abierto>(null);
  /** Guardado, se cierra el formulario. */
  const yCerrar =
    (accion: (previo: Resultado | null, f: FormData) => Promise<Resultado>) =>
    async (previo: Resultado | null, f: FormData) => {
      const r = await accion(previo, f);
      if (r.ok) setAbierto(null);
      return r;
    };
  const [edicion, editar, editando] = useActionState(yCerrar(guardarTrabajador.bind(null, x.id)), null);
  const [salario, cambiarSalario, cambiando] = useActionState(yCerrar(nuevoSalario.bind(null, x.id)), null);
  const [baja, alternar, alternando] = useActionState(cambiarActivo.bind(null, x.id, !x.activo), null);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' });
  const sueldo = (monto: number) =>
    t(x.tipoPago === 'hora' ? 'porHoraMonto' : 'porDiaMonto', { monto: dinero.format(monto) });

  return (
    <li className={`${estilos.tarjeta} flex flex-col gap-2 ${x.activo ? '' : 'opacity-70'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{x.nombre}</h3>
        <span className="text-sm text-slate-600">{x.puesto ?? ''}</span>
      </div>
      <p className="flex flex-wrap gap-x-3 text-sm text-slate-700">
        <span className="font-medium">{x.tarifa !== null ? sueldo(x.tarifa) : t('sinSalario')}</span>
        <span>{t('dias', { n: x.diasTrabajados })}</span>
        {x.telefono ? (
          <a href={`tel:${x.telefono}`} className="text-marca underline">
            {x.telefono}
          </a>
        ) : null}
      </p>
      {x.proxima ? (
        <p className="text-sm text-amber-800">
          {t('proximo', { salario: sueldo(x.proxima.tarifa), dia: dia(x.proxima.vigenteDesde) })}
        </p>
      ) : null}

      {abierto === 'editar' ? (
        <form
          onSubmit={enviarSinVaciar(editar)}
          className="flex flex-col gap-3 border-t border-slate-100 pt-3"
        >
          <CamposTrabajador trabajador={x} />
          <MensajeError problema={edicion && !edicion.ok ? edicion : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(null)}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={editando} className={`${estilos.boton} flex-1`}>
              {t('guardar')}
            </button>
          </div>
        </form>
      ) : null}

      {abierto === 'salario' ? (
        <form
          onSubmit={enviarSinVaciar(cambiarSalario)}
          className="flex flex-col gap-3 border-t border-slate-100 pt-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className={estilos.etiqueta}>
              {t(x.tipoPago === 'hora' ? 'nuevoPorHora' : 'nuevoPorDia')}
              <input
                name="tarifa"
                inputMode="decimal"
                required
                autoComplete="off"
                className={estilos.campo}
              />
            </label>
            <label className={estilos.etiqueta}>
              {t('desde')}
              <input name="desde" type="date" required defaultValue={hoy} className={estilos.campo} />
            </label>
          </div>
          <p className="text-xs text-slate-500">{t('salarioAyuda')}</p>
          {x.tarifas.length ? (
            <div className="text-sm text-slate-700">
              <p className="font-medium">{t('historial')}</p>
              <ul className="list-disc pl-5">
                {x.tarifas.map((s) => (
                  <li key={s.vigenteDesde}>
                    {t('desdeFecha', { salario: sueldo(s.tarifa), dia: dia(s.vigenteDesde) })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <MensajeError problema={salario && !salario.ok ? salario : null} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(null)}
              className={`${estilos.botonSecundario} flex-1`}
            >
              {t('cancelar')}
            </button>
            <button type="submit" disabled={cambiando} className={`${estilos.boton} flex-1`}>
              {t('guardar')}
            </button>
          </div>
        </form>
      ) : null}

      <MensajeError problema={baja && !baja.ok ? baja : null} />
      {abierto === null ? (
        <div className="grid grid-cols-3 gap-2">
          {x.activo ? (
            <>
              <button type="button" onClick={() => setAbierto('editar')} className={estilos.botonSecundario}>
                {t('editar')}
              </button>
              <button type="button" onClick={() => setAbierto('salario')} className={estilos.botonSecundario}>
                {t('cambiarSalario')}
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={alternando}
            onClick={() => startTransition(() => alternar())}
            className={`${estilos.botonSecundario} ${x.activo ? 'text-red-700' : 'col-span-3'}`}
          >
            {x.activo ? t('darDeBaja') : t('reactivar')}
          </button>
        </div>
      ) : null}
    </li>
  );
}
