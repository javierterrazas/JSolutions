'use client';
// Checar entrada o salida (D-117): primero la ubicación (el GPS del celular), luego la selfie con la cámara de enfrente
// en ese momento (no se elige una foto guardada; si el navegador no deja usar la cámara, la abre el sistema), y se
// envía. El servidor decide si está dentro de la obra.
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { checarAhora, type RespuestaChecada } from '../acciones/checada';
import { estilos } from '../componentes/marco';

type Paso = 'listo' | 'ubicando' | 'camara' | 'enviando';
type Ubicacion = { lat: number; lng: number; precision: number };

/** La foto, a lo más de 640 px y en JPEG: pesa poco aunque la señal sea mala. */
async function reducir(origen: CanvasImageSource, ancho: number, alto: number): Promise<Blob> {
  const escala = Math.min(1, 640 / Math.max(ancho, alto));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  lienzo.getContext('2d')!.drawImage(origen, 0, 0, lienzo.width, lienzo.height);
  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error('sin foto'))), 'image/jpeg', 0.75),
  );
}

export function PantallaChecar({ dentro }: { dentro: { obra: string; desde: string } | null }) {
  const t = useTranslations('checada');
  const formato = useFormatter();
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('listo');
  const [problema, setProblema] = useState<string | null>(null);
  const [hecho, setHecho] = useState<RespuestaChecada | null>(null);
  // la foto se toma cuando la cámara ya muestra algo
  const [camaraLista, setCamaraLista] = useState(false);
  const ubicacion = useRef<Ubicacion | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const tipo = dentro ? 'salida' : 'entrada';
  const hora = (iso: string) => formato.dateTime(new Date(iso), { hour: 'numeric', minute: '2-digit' });

  const apagarCamara = () => {
    flujo.current?.getTracks().forEach((x) => x.stop());
    flujo.current = null;
    setCamaraLista(false);
  };
  useEffect(() => apagarCamara, []);

  function empezar() {
    setProblema(null);
    setHecho(null);
    if (!('geolocation' in navigator)) return setProblema(t('sinGps'));
    setPaso('ubicando');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        ubicacion.current = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
        void abrirCamara();
      },
      (e) => {
        setPaso('listo');
        setProblema(e.code === e.PERMISSION_DENIED ? t('gpsNegado') : t('gpsNoSale'));
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function abrirCamara() {
    setPaso('camara');
    try {
      flujo.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = flujo.current;
        await video.current.play().catch(() => {});
      }
    } catch {
      // sin permiso de cámara en el navegador: que la abra el sistema
      apagarCamara();
      archivo.current?.click();
    }
  }

  async function tomarFoto() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const foto = await reducir(v, v.videoWidth, v.videoHeight);
    apagarCamara();
    await enviar(foto);
  }

  async function fotoDelSistema(f: File | undefined) {
    if (!f) return setPaso('listo');
    const img = await createImageBitmap(f).catch(() => null);
    await enviar(img ? await reducir(img, img.width, img.height) : f);
  }

  async function enviar(foto: Blob) {
    const u = ubicacion.current!;
    setPaso('enviando');
    const datos = new FormData();
    datos.set('tipo', tipo);
    datos.set('lat', String(u.lat));
    datos.set('lng', String(u.lng));
    datos.set('precision', String(Math.round(u.precision)));
    datos.set('foto', foto, 'selfie.jpg');
    try {
      const r = await checarAhora(datos);
      setPaso('listo');
      if (r.resultado === 'ok') {
        setHecho(r);
        router.refresh();
      } else {
        setProblema(
          r.resultado === 'fuera'
            ? t('fuera', { obra: r.obra ?? '', metros: r.distancia ?? 0 })
            : t(`resultados.${r.resultado}` as 'resultados.sin_obras'),
        );
      }
    } catch {
      setPaso('listo');
      setProblema(t('sinSenal'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`${estilos.tarjeta} flex flex-col gap-1`}>
        {dentro ? (
          <>
            <p className="text-lg font-semibold text-emerald-800">{t('dentro', { obra: dentro.obra })}</p>
            <p className="text-slate-700">{t('desde', { hora: hora(dentro.desde) })}</p>
          </>
        ) : (
          <p className="text-lg font-semibold text-slate-700">{t('fueraDeTurno')}</p>
        )}
      </div>

      {hecho ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 font-medium text-emerald-900">
          {t(hecho.horas === null ? 'listoEntrada' : 'listoSalida', {
            obra: hecho.obra ?? '',
            hora: hecho.en ? hora(hecho.en) : '',
            horas: hecho.horas ?? 0,
          })}
        </p>
      ) : null}
      {problema ? (
        <p role="alert" className={estilos.error}>
          {problema}
        </p>
      ) : null}

      {paso === 'camara' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">{t('mirate')}</p>
          <video
            ref={video}
            playsInline
            muted
            onLoadedData={() => setCamaraLista(true)}
            className="aspect-[3/4] w-full -scale-x-100 rounded-2xl bg-slate-900 object-cover"
          />
          <button type="button" onClick={tomarFoto} disabled={!camaraLista} className={estilos.boton}>
            {t('tomarFoto')}
          </button>
          <button
            type="button"
            onClick={() => {
              apagarCamara();
              setPaso('listo');
            }}
            className={estilos.botonSecundario}
          >
            {t('cancelar')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={empezar}
          disabled={paso !== 'listo'}
          className={`${estilos.boton} min-h-20 text-xl`}
        >
          {paso === 'ubicando'
            ? t('ubicando')
            : paso === 'enviando'
              ? t('enviando')
              : t(tipo === 'entrada' ? 'checarEntrada' : 'checarSalida')}
        </button>
      )}
      <input
        ref={archivo}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => void fotoDelSistema(e.target.files?.[0])}
      />
      <p className="text-sm text-slate-500">{t('aviso')}</p>
    </div>
  );
}
