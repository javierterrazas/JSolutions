'use client';
// Registrar un gasto (legacy: vGasto y guardarGasto de PM.html): el monto, la partida (las que van en curso,
// sugeridas; sin partida va a Generales de obra), la categoría, el proveedor, qué se compró y la foto del recibo.
// Con la tarjeta de la empresa, siempre.
//
// Como el cierre (D-043, D-049): lleva una clave de envío y se manda en el momento; si una regla lo rechaza, se
// corrige aquí mismo. Sin señal, o con la sesión vencida, va a la cola del teléfono con su recibo detrás. Lo usan la
// pantalla con señal y la versión sin señal.
import type { CategoriaGasto, EntradaGasto } from '@ijm/servidor';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { enviarGasto } from '@/app/acciones/cola';
import type { ElementoCola } from '@/lib/cola';
import { encolar, enviarPendientes, siguienteN } from '@/lib/cola-telefono';
import { formatoDinero } from '@/lib/dinero';
import { CampoFotos, type FotoTomada } from '../../../componentes/campo-fotos';
import { estilos } from '../../../componentes/marco';
import { MensajeError, type Problema } from '../../../componentes/mensaje-error';

export const CATEGORIAS: readonly CategoriaGasto[] = [
  'material',
  'renta_equipo',
  'herramienta',
  'permisos',
  'disposicion',
  'otro',
];

export interface DatosFormularioGasto {
  readonly obraId: string;
  readonly folio: string;
  readonly limite: number;
  readonly espacios: readonly {
    id: string;
    nombre: string;
    partidas: readonly { id: string; nombre: string; enCurso: boolean }[];
  }[];
}

/** "1,250.50" o "$85" → número; vacío o basura → NaN. */
const numero = (s: string) => Number(s.replace(/[$,\s]/g, '') || 'x');

type Destino =
  { readonly como: 'enviado'; readonly enRevision: boolean } | { readonly como: 'sin_red' | 'sin_sesion' };

export function FormularioGasto({
  datos,
  alTerminar,
}: {
  datos: DatosFormularioGasto;
  alTerminar?: () => void;
}) {
  const t = useTranslations('gasto');
  const formato = formatoDinero(useLocale());
  const dinero = (n: number) => formato.format(n);
  // la que va en curso; si ninguna, la primera, como el legacy
  const partidas = datos.espacios.flatMap((e) => e.partidas);
  const sugerida = (partidas.find((p) => p.enCurso) ?? partidas[0])?.id ?? '';
  const [monto, setMonto] = useState('');
  const [partida, setPartida] = useState(sugerida);
  const [categoria, setCategoria] = useState<CategoriaGasto>('material');
  const [proveedor, setProveedor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [recibo, setRecibo] = useState<readonly FotoTomada[]>([]);
  const [problema, setProblema] = useState<Problema | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [enviando, iniciar] = useTransition();

  function registrar() {
    setProblema(null);
    // lo que el teléfono ya sabe se dice antes de enviar; el servidor lo vuelve a revisar
    if (!proveedor.trim()) return setProblema({ codigo: 'faltan', datos: { campos: ['proveedor'] } });
    const cantidad = numero(monto);
    if (!(cantidad > 0)) return setProblema({ codigo: 'monto_invalido' });
    iniciar(async () => {
      const id = crypto.randomUUID();
      const entrada: EntradaGasto = {
        obraId: datos.obraId,
        claveEnvio: id,
        capturado: new Date().toISOString(),
        monto: cantidad,
        partidaId: partida || null,
        categoria,
        proveedor,
        descripcion: descripcion.trim() || null,
        recibo: recibo.length ? 1 : 0,
      };
      // el día del teléfono, solo para mostrarlo en la cola; el del gasto lo decide el servidor con la hora de captura
      const etiqueta = { obra: datos.folio, dia: new Date().toLocaleDateString('en-CA'), monto: cantidad };
      // el turno en la cola se toma al encolar: el recibo siempre va detrás de su gasto
      const fotoDelRecibo = (): ElementoCola[] =>
        recibo.slice(0, 1).map((f) => ({
          id: crypto.randomUUID(),
          n: siguienteN(),
          tipo: 'foto',
          de: 'gasto',
          etiqueta,
          clave: id,
          indice: 1,
          foto: f.blob,
          tomadaEn: new Date().toISOString(),
          intentos: 0,
        }));
      const todoALaCola = async (como: 'sin_red' | 'sin_sesion') => {
        const gasto: ElementoCola = { id, n: siguienteN(), tipo: 'gasto', etiqueta, entrada, intentos: 0 };
        await encolar(gasto, ...fotoDelRecibo());
        setDestino({ como });
      };

      let r: Awaited<ReturnType<typeof enviarGasto>>;
      try {
        r = await enviarGasto(entrada);
      } catch {
        await todoALaCola('sin_red');
        return;
      }
      if (!r.ok && r.codigo === 'sesion') return todoALaCola('sin_sesion');
      if (!r.ok) {
        setProblema(r);
        return;
      }
      // el recibo sube detrás, por la cola: si la señal se va, no se pierde
      if (recibo.length) {
        await encolar(...fotoDelRecibo());
        void enviarPendientes().catch(() => {});
      }
      setDestino({ como: 'enviado', enRevision: !!r.enRevision });
    });
  }

  if (destino)
    return (
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className={`rounded-2xl p-4 text-lg font-semibold ${destino.como === 'enviado' && !destino.enRevision ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
        >
          {destino.como === 'enviado'
            ? destino.enRevision
              ? t('enRevision', { limite: dinero(datos.limite) })
              : recibo.length
                ? t('registrado')
                : t('registradoSinRecibo')
            : destino.como === 'sin_red'
              ? t('guardadoSinRed')
              : t('guardadoSinSesion')}
        </p>
        {destino.como === 'sin_sesion' ? (
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{t('ayuda', { limite: dinero(datos.limite) })}</p>
      <label className={estilos.etiqueta}>
        {t('monto')}
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className={`${estilos.campo} min-h-16 text-center text-3xl font-bold`}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('partida')}
        <select value={partida} onChange={(e) => setPartida(e.target.value)} className={estilos.campo}>
          {datos.espacios.map((e) => (
            <optgroup key={e.id} label={e.nombre}>
              {e.partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="">{t('sinPartida')}</option>
        </select>
      </label>
      <label className={estilos.etiqueta}>
        {t('categoria')}
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
          className={estilos.campo}
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {t(`categorias.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={estilos.etiqueta}>
        {t('proveedor')}
        <input
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          maxLength={120}
          placeholder={t('proveedorEjemplo')}
          className={estilos.campo}
        />
      </label>
      <label className={estilos.etiqueta}>
        {t('descripcion')}
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={200}
          placeholder={t('descripcionEjemplo')}
          className={estilos.campo}
        />
      </label>
      <fieldset className={`${estilos.tarjeta} flex flex-col gap-2`}>
        <legend className="px-1 font-semibold text-marca">{t('recibo')}</legend>
        <CampoFotos fotos={recibo} alCambiar={setRecibo} una etiqueta={t('fotoRecibo')} />
      </fieldset>
      <MensajeError problema={problema} />
      <button type="button" disabled={enviando} onClick={registrar} className={estilos.boton}>
        {enviando ? t('enviando') : t('registrar')}
      </button>
    </div>
  );
}
