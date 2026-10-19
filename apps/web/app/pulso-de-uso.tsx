'use client';
// El pulso del uso de la app (D-101): mientras está abierta, a la vista y con señal, avisa cada minuto. Solo cuenta el
// tiempo, nunca lo que se escribe ni dónde está. Sin señal no avisa (ese tiempo no se cuenta).
import { useEffect } from 'react';
import { registrarMiUso } from './acciones/uso';

export function PulsoDeUso() {
  useEffect(() => {
    const avisar = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registrarMiUso().catch(() => {});
    };
    avisar();
    const cada = setInterval(avisar, 60_000);
    document.addEventListener('visibilitychange', avisar);
    return () => {
      clearInterval(cada);
      document.removeEventListener('visibilitychange', avisar);
    };
  }, []);
  return null;
}
