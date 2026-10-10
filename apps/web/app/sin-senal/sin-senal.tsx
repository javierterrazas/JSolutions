'use client';
// La app sin señal (D-047): el PIN local, las obras de la copia y el cierre del día de hoy, con el mismo formulario
// que con señal. El cierre va a la cola del teléfono y se envía solo cuando vuelve la señal.
import type { CopiaSinSenal } from '@ijm/servidor';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import type { ElementoCola } from '@/lib/cola';
import { alCambiar, pendientes } from '@/lib/cola-telefono';
import { guardarPin, leerCopia, leerPin } from '@/lib/copia-telefono';
import {
  datosDeHoy,
  estadoDeHoy,
  estaAbierto,
  hoyDeLaCopia,
  huellaDePin,
  type PinLocal,
  type ResultadoPinLocal,
  revisarPinLocal,
} from '@/lib/sin-senal';
import { estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { EstadoCola } from '../estado-cola';
import { FormularioCierre } from '../obras/[id]/cierre/formulario-cierre';
import { CampoPin } from '../pin/campo-pin';

type Guardado = { copia: CopiaSinSenal; pin: PinLocal };

export function SinSenal() {
  const t = useTranslations('sinSenal');
  const [guardado, setGuardado] = useState<Guardado | 'cargando' | 'nada'>('cargando');
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    Promise.all([leerCopia(), leerPin()])
      .then(([copia, pin]) => {
        // la copia y el PIN tienen que ser del mismo miembro
        if (!copia || !pin || pin.miembroId !== copia.miembro.id) return setGuardado('nada');
        setGuardado({ copia, pin });
        setAbierto(estaAbierto(pin, new Date()));
      })
      .catch(() => setGuardado('nada'));
  }, []);

  if (guardado === 'cargando') return null;
  if (guardado === 'nada')
    return (
      <>
        <p className={estilos.tarjeta}>{t('sinCopia')}</p>
        <ProbarConSenal />
      </>
    );
  if (!abierto)
    return (
      <PinLocalForm
        pin={guardado.pin}
        alAbrir={(pin) => {
          setGuardado({ ...guardado, pin });
          setAbierto(true);
        }}
      />
    );
  return <ObrasSinSenal copia={guardado.copia} />;
}

function ProbarConSenal() {
  const t = useTranslations('sinSenal');
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- a propósito: recarga la página entera, y si hay señal, carga la app de verdad
    <a href="/" className={`${estilos.botonSecundario} flex items-center justify-center`}>
      {t('probarConSenal')}
    </a>
  );
}

function PinLocalForm({ pin, alAbrir }: { pin: PinLocal; alAbrir: (p: PinLocal) => void }) {
  const t = useTranslations('sinSenal');
  const tp = useTranslations('pin');
  const [problema, setProblema] = useState<ResultadoPinLocal | null>(null);
  const [revisando, setRevisando] = useState(false);

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const escrito = String(new FormData(e.currentTarget).get('pin') ?? '');
    setRevisando(true);
    try {
      const coincide = (await huellaDePin(escrito, pin.sal)) === pin.huella;
      const r = revisarPinLocal(pin, coincide, new Date());
      await guardarPin(r.pin);
      if (r.resultado.ok) alAbrir(r.pin);
      else setProblema(r.resultado);
    } finally {
      setRevisando(false);
    }
  }
  return (
    <form onSubmit={(e) => void alEnviar(e)} className="flex flex-col gap-4">
      <p className="text-slate-700">{t('pinAyuda')}</p>
      <CampoPin nombre="pin" etiqueta={tp('etiqueta')} largo={pin.largo} />
      <MensajeError problema={problema && !problema.ok ? problema : null} />
      <button type="submit" disabled={revisando} className={estilos.boton}>
        {tp('entrar')}
      </button>
      <ProbarConSenal />
    </form>
  );
}

function ObrasSinSenal({ copia }: { copia: CopiaSinSenal }) {
  const t = useTranslations('sinSenal');
  const formato = useFormatter();
  const idioma = useLocale();
  const [cola, setCola] = useState<readonly ElementoCola[]>([]);
  const [elegida, setElegida] = useState<string | null>(null);
  const hoy = hoyDeLaCopia(copia, new Date());

  useEffect(() => {
    const leer = () => void pendientes().then(setCola);
    leer();
    return alCambiar(leer);
  }, []);

  const obra = copia.obras.find((o) => o.datos.obra.id === elegida);
  if (obra) {
    const d = datosDeHoy(obra, hoy);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setElegida(null);
          }}
          className="self-start text-sm font-medium text-marca"
        >
          {t('volver')}
        </button>
        <p className="text-slate-700">{t('obra', { folio: d.obra.folio, cliente: d.obra.cliente })}</p>
        <FormularioCierre
          datos={{
            obraId: d.obra.id,
            folio: d.obra.folio,
            dia: d.dia,
            tardio: d.tardio,
            espacios: d.espacios.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              partidas: e.partidas.map((p) => ({
                id: p.id,
                nombre: (idioma === 'en' ? p.nombre.en : null) ?? p.nombre.es,
                enCurso: p.estado === 'en_progreso',
                hito: p.hito,
                faltaInspeccion: p.faltaInspeccion,
              })),
            })),
            trabajadores: d.trabajadores,
            subs: d.subs.map((s) => ({ ordenId: s.ordenId, sub: s.sub, alcance: s.alcance })),
            motivos: d.motivos,
          }}
        />
      </>
    );
  }

  return (
    <>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
        {t('aviso', {
          cuando: formato.dateTime(new Date(copia.hecha), {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
          }),
        })}
      </p>
      <EstadoCola />
      <h2 className="text-lg font-bold text-marca">{t('obras')}</h2>
      {copia.obras.length === 0 ? <p className="text-slate-600">{t('sinObras')}</p> : null}
      <ul className="flex flex-col gap-3">
        {copia.obras.map((o) => {
          const estado = estadoDeHoy(o, hoy, cola);
          return (
            <li key={o.datos.obra.id} className={`${estilos.tarjeta} flex flex-col gap-3`}>
              <p className="font-semibold">
                {t('obra', { folio: o.datos.obra.folio, cliente: o.datos.obra.cliente })}
              </p>
              {estado === 'por_cerrar' ? (
                <button
                  type="button"
                  onClick={() => {
                    setElegida(o.datos.obra.id);
                  }}
                  className={estilos.boton}
                >
                  {t('cerrarDia')}
                </button>
              ) : (
                <p className="text-sm text-slate-600">
                  {estado === 'cerrado' ? t('yaCerrado') : t('enElTelefono')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <ProbarConSenal />
    </>
  );
}
