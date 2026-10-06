'use client';
// El PIN se escribe oculto y con el teclado numérico; el ojo lo muestra para revisarlo y lo vuelve a ocultar sin
// borrar lo tecleado (legacy/pruebas/prueba_pin.py).
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { estilos } from '../componentes/marco';

export function CampoPin({ nombre, etiqueta, largo }: { nombre: string; etiqueta: string; largo: number }) {
  const t = useTranslations('pin');
  const [visible, setVisible] = useState(false);
  return (
    <label className={estilos.etiqueta}>
      {etiqueta}
      <span className="flex gap-2">
        <input
          name={nombre}
          type={visible ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={largo}
          minLength={largo}
          required
          className={`${estilos.campo} text-center text-2xl tracking-[0.5em]`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('ocultar') : t('mostrar')}
          title={visible ? t('ocultar') : t('mostrar')}
          aria-pressed={visible}
          className={estilos.botonSecundario}
        >
          <Ojo abierto={visible} />
        </button>
      </span>
    </label>
  );
}

function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {abierto ? null : <path d="M3 3l18 18" />}
    </svg>
  );
}
