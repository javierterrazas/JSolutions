'use client';
// Fijar la geocerca con la ubicación del celular (D-117): hay que estar en la obra. El radio, de una lista.
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { fijarUbicacion } from '../../../acciones/checada';
import { estilos } from '../../../componentes/marco';

const RADIOS = [100, 150, 250, 500] as const;

export function FijarUbicacion({ obraId, radio: inicial }: { obraId: string; radio: number }) {
  const t = useTranslations('ubicacion');
  const [radio, setRadio] = useState(RADIOS.includes(inicial as never) ? inicial : 150);
  const [estado, setEstado] = useState<'listo' | 'ubicando' | 'guardado'>('listo');
  const [problema, setProblema] = useState<string | null>(null);

  function fijar() {
    setProblema(null);
    if (!('geolocation' in navigator)) return setProblema(t('sinGps'));
    setEstado('ubicando');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        if (p.coords.accuracy > 100) {
          setEstado('listo');
          return setProblema(t('impreciso', { metros: Math.round(p.coords.accuracy) }));
        }
        const r = await fijarUbicacion(obraId, {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          radio,
        }).catch(() => null);
        setEstado(r?.ok ? 'guardado' : 'listo');
        if (!r?.ok) setProblema(t('noSeGuardo'));
      },
      () => {
        setEstado('listo');
        setProblema(t('gpsNegado'));
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  return (
    <div className={`${estilos.tarjeta} flex flex-col gap-3`}>
      <label className={estilos.etiqueta}>
        {t('radio')}
        <select value={radio} onChange={(e) => setRadio(Number(e.target.value))} className={estilos.campo}>
          {RADIOS.map((m) => (
            <option key={m} value={m}>
              {t('metros', { metros: m })}
            </option>
          ))}
        </select>
        <span className="text-sm font-normal text-slate-600">{t('radioAyuda')}</span>
      </label>
      {estado === 'guardado' ? (
        <p role="status" className="font-medium text-emerald-800">
          {t('guardada')}
        </p>
      ) : null}
      {problema ? (
        <p role="alert" className={estilos.error}>
          {problema}
        </p>
      ) : null}
      <button type="button" onClick={fijar} disabled={estado === 'ubicando'} className={estilos.boton}>
        {estado === 'ubicando' ? t('ubicando') : t('fijarAqui')}
      </button>
    </div>
  );
}
