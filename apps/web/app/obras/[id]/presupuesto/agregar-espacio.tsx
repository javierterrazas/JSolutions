'use client';
// Agregar un espacio a la obra (legacy: duAgregarArea): toma las partidas de su tipo y aparece abajo, listo para
// capturarle su presupuesto.
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { agregarEspacioAObra } from '../../../acciones/obras';
import { estilos } from '../../../componentes/marco';
import { MensajeError } from '../../../componentes/mensaje-error';

export function AgregarEspacio({
  obraId,
  tipos,
}: {
  obraId: string;
  tipos: readonly { id: string; nombre: string; partidas: number }[];
}) {
  const t = useTranslations('obraNueva');
  const tp = useTranslations('presupuesto');
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, enviando] = useActionState(agregarEspacioAObra.bind(null, obraId), null);
  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className={estilos.botonSecundario}
      >
        {tp('agregarEspacio')}
      </button>
    );
  return (
    <form action={accion} className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <p className="font-semibold text-marca">{tp('agregarEspacio')}</p>
      <label className={estilos.etiqueta}>
        {t('tipo')}
        <select name="tipo" className={estilos.campo}>
          {tipos.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.etiqueta}>
        {t('nombreEspacio')}
        <input name="nombre" maxLength={80} className={estilos.campo} />
      </label>
      <label className={estilos.etiqueta}>
        {t('pies2')}
        <input name="pies2" inputMode="decimal" required className={estilos.campo} />
      </label>
      <MensajeError problema={resultado && !resultado.ok ? resultado : null} />
      <button type="submit" disabled={enviando} className={estilos.boton}>
        {tp('agregarEspacio')}
      </button>
    </form>
  );
}
