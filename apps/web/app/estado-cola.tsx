'use client';
// Lo que la cola del teléfono tiene pendiente, en el inicio del PM (fase 2, paso 5; legacy: pintarBanner). Envía
// solo al abrir la app, al volver la señal y cada 30 segundos mientras quede algo; lo que una regla rechazó se
// muestra con su razón hasta que el PM lo da por visto.
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ElementoCola, Rechazo } from '@/lib/cola';
import {
  alCambiar,
  descartarRechazo,
  enviarPendientes,
  pendientes as leerPendientes,
  rechazados as leerRechazados,
} from '@/lib/cola-telefono';
import { estilos } from './componentes/marco';
import { MensajeError } from './componentes/mensaje-error';

/** El encabezado de lo que una regla rechazó, según qué era. */
const RECHAZADO = {
  cierre: 'cierreRechazado',
  gasto: 'gastoRechazado',
  aviso: 'avisoRechazado',
  foto: 'fotoRechazada',
} as const;

export function EstadoCola() {
  const t = useTranslations('cola');
  const formato = useFormatter();
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'short' });
  const router = useRouter();
  const [pendientes, setPendientes] = useState<readonly ElementoCola[]>([]);
  const [rechazos, setRechazos] = useState<readonly Rechazo[]>([]);
  const [fin, setFin] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(() => {
    leerPendientes()
      .then((p) => {
        if (!p.length) return;
        setEnviando(true);
        return enviarPendientes()
          .catch(() => 'sin_red' as const)
          .then((r) => {
            setEnviando(false);
            setFin(r);
            // se envió algo: el inicio cambia (el día cerrado, la racha)
            if (r === 'vacia') router.refresh();
          });
      })
      .catch(() => {
        // sin IndexedDB (navegación privada): no hay cola
      });
  }, [router]);

  // la cola es un sistema externo: la pantalla se suscribe a sus cambios
  useEffect(() => {
    const leer = () => {
      leerPendientes()
        .then(setPendientes)
        .catch(() => {});
      leerRechazados()
        .then(setRechazos)
        .catch(() => {});
    };
    const quitar = alCambiar(leer);
    leer();
    enviar();
    window.addEventListener('online', enviar);
    const reloj = window.setInterval(enviar, 30_000);
    return () => {
      quitar();
      window.removeEventListener('online', enviar);
      window.clearInterval(reloj);
    };
  }, [enviar]);

  if (!pendientes.length && !rechazos.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {pendientes.length ? (
        <div role="status" className="flex flex-col gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          <p>{t('pendientes', { n: pendientes.length })}</p>
          {fin === 'sin_red' ? <p className="text-xs">{t('sinRed')}</p> : null}
          <button
            type="button"
            disabled={enviando}
            onClick={enviar}
            className="self-start rounded-lg bg-sky-900 px-3 py-2 font-semibold text-white disabled:opacity-50"
          >
            {enviando ? t('enviando') : t('enviarAhora')}
          </button>
        </div>
      ) : null}
      {rechazos.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">
            {t(RECHAZADO[r.tipo], { obra: r.etiqueta.obra, dia: dia(r.etiqueta.dia) })}
          </p>
          <MensajeError problema={r} />
          <button
            type="button"
            onClick={() => void descartarRechazo(r.id)}
            className={`${estilos.botonSecundario} self-start`}
          >
            {t('entendido')}
          </button>
        </div>
      ))}
    </div>
  );
}
