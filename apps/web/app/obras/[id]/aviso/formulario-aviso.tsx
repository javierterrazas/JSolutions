'use client';
// Levantar un aviso (legacy: vAviso y mandarAviso de PM.html): si detiene el avance, de qué tipo es, qué pasa y qué
// necesita, y fotos del problema. El dueño se compromete a contestar en las horas de su configuración.
//
// Como el cierre y el gasto (D-043, D-050): lleva una clave de envío y se manda en el momento; si una regla lo
// rechaza, se corrige aquí mismo. Sin señal, o con la sesión vencida, va a la cola del teléfono con sus fotos detrás.
// Lo usan la pantalla con señal y la versión sin señal.
import type { EntradaAviso, TipoAviso } from '@ijm/servidor';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { enviarAviso } from '@/app/acciones/cola';
import type { ElementoCola } from '@/lib/cola';
import { encolar, enviarPendientes, siguienteN } from '@/lib/cola-telefono';
import { CampoFotos, type FotoTomada } from '../../../componentes/campo-fotos';
import { estilos } from '../../../componentes/marco';
import { MensajeError, type Problema } from '../../../componentes/mensaje-error';

const TIPOS: readonly TipoAviso[] = ['material', 'cliente', 'sub', 'condicion_oculta', 'diseno', 'otro'];
/** Lo mínimo para que el dueño pueda resolverlo (el servidor lo vuelve a revisar). */
const LARGO_DESCRIPCION = 10;

export interface DatosFormularioAviso {
  readonly obraId: string;
  readonly folio: string;
  readonly slaHoras: number;
}

type Destino = 'enviado' | 'sin_red' | 'sin_sesion';

export function FormularioAviso({
  datos,
  alTerminar,
}: {
  datos: DatosFormularioAviso;
  alTerminar?: () => void;
}) {
  const t = useTranslations('aviso');
  const [detiene, setDetiene] = useState(true);
  const [tipo, setTipo] = useState<TipoAviso>('material');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<readonly FotoTomada[]>([]);
  const [problema, setProblema] = useState<Problema | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [enviando, iniciar] = useTransition();

  function mandar() {
    setProblema(null);
    if (descripcion.trim().length < LARGO_DESCRIPCION) return setProblema({ codigo: 'aviso_sin_detalle' });
    iniciar(async () => {
      const id = crypto.randomUUID();
      const entrada: EntradaAviso = {
        obraId: datos.obraId,
        claveEnvio: id,
        tipo,
        descripcion,
        detiene,
        fotos: fotos.length,
      };
      // el día del teléfono, solo para mostrarlo en la cola
      const etiqueta = { obra: datos.folio, dia: new Date().toLocaleDateString('en-CA') };
      // el turno en la cola se toma al encolar: las fotos siempre van detrás de su aviso
      const fotosDetras = (): ElementoCola[] =>
        fotos.map((f, i) => ({
          id: crypto.randomUUID(),
          n: siguienteN(),
          tipo: 'foto',
          de: 'aviso',
          etiqueta,
          clave: id,
          indice: i + 1,
          foto: f.blob,
          tomadaEn: new Date().toISOString(),
          intentos: 0,
        }));
      const todoALaCola = async (como: 'sin_red' | 'sin_sesion') => {
        const aviso: ElementoCola = { id, n: siguienteN(), tipo: 'aviso', etiqueta, entrada, intentos: 0 };
        await encolar(aviso, ...fotosDetras());
        setDestino(como);
      };

      let r: Awaited<ReturnType<typeof enviarAviso>>;
      try {
        r = await enviarAviso(entrada);
      } catch {
        await todoALaCola('sin_red');
        return;
      }
      if (!r.ok && r.codigo === 'sesion') return todoALaCola('sin_sesion');
      if (!r.ok) {
        setProblema(r);
        return;
      }
      if (fotos.length) {
        await encolar(...fotosDetras());
        void enviarPendientes().catch(() => {});
      }
      setDestino('enviado');
    });
  }

  if (destino)
    return (
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className={`rounded-2xl p-4 text-lg font-semibold ${destino === 'enviado' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
        >
          {destino === 'enviado'
            ? t('enviado', { horas: datos.slaHoras })
            : destino === 'sin_red'
              ? t('guardadoSinRed')
              : t('guardadoSinSesion')}
        </p>
        {destino === 'sin_sesion' ? (
          <Link href="/pin" className={`${estilos.boton} flex items-center justify-center`}>
            {t('entrarParaEnviar')}
          </Link>
        ) : null}
        {alTerminar ? (
          <button type="button" onClick={alTerminar} className={estilos.botonSecundario}>
            {t('volverObras')}
          </button>
        ) : (
          <Link href="/" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('volver')}
          </Link>
        )}
      </div>
    );

  const opcion = (activo: boolean) =>
    `min-h-12 flex-1 rounded-xl px-3 text-sm font-medium ${activo ? 'bg-marca text-white' : 'border border-marca/30 text-marca'}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{t('ayuda', { horas: datos.slaHoras })}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className={estilos.etiqueta}>{t('detiene')}</legend>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={detiene}
            onClick={() => setDetiene(true)}
            className={opcion(detiene)}
          >
            {t('detieneSi')}
          </button>
          <button
            type="button"
            aria-pressed={!detiene}
            onClick={() => setDetiene(false)}
            className={opcion(!detiene)}
          >
            {t('detieneNo')}
          </button>
        </div>
      </fieldset>
      <label className={estilos.etiqueta}>
        {t('tipo')}
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAviso)} className={estilos.campo}>
          {TIPOS.map((x) => (
            <option key={x} value={x}>
              {t(`tipos.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.etiqueta}>
        {t('descripcion')}
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={t('descripcionEjemplo')}
          className={`${estilos.campo} py-2`}
        />
      </label>
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
        <legend className="px-1 font-semibold text-marca">{t('fotos')}</legend>
        <CampoFotos fotos={fotos} alCambiar={setFotos} />
      </fieldset>
      <MensajeError problema={problema} />
      <button type="button" disabled={enviando} onClick={mandar} className={estilos.boton}>
        {enviando ? t('enviando') : t('enviar')}
      </button>
    </div>
  );
}
