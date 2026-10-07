// Del libro de Google Sheets del sistema actual (descargado como .xlsx) a lo que se carga en una empresa: su
// catálogo (tipos de espacio, partidas, etapas, oficios, puntos de control), su configuración, sus metas, sus
// subcontratistas y su cuadrilla (D-039). Solo convierte y revisa; la carga la hace la base (cargar_libro).
// Sigue las reglas de lectura del legacy: "SI" es sí, el oficio de una partida se empata con el de un sub por texto,
// un renglón sin su id (sub_id, trabajador_id) es una nota y no un registro.
import { ErrorDeNegocio, METAS_POR_OMISION, type ClaveIndicador } from '@ijm/core';
import type { Libro } from './xlsx';

export interface DatosDelLibro {
  readonly configuracion: Readonly<Record<string, number>>;
  readonly metas: readonly { indicador: ClaveIndicador; meta: number }[];
  readonly tipos: readonly { nombre_es: string; es_generales: boolean; orden: number }[];
  readonly oficios: readonly { nombre_es: string; requiere_licencia: boolean }[];
  readonly etapas: readonly { nombre_es: string; orden: number }[];
  readonly hitos: readonly { clave: string; nombre_es: string; orden: number; exige_prueba_agua: boolean }[];
  readonly puntos: readonly { hito: string; orden: number; texto_es: string; requiere_foto: boolean }[];
  readonly partidas: readonly {
    tipo: string;
    orden: number;
    nombre_es: string;
    hito: string | null;
    peso: number;
    dias: number;
    responsable: 'cuadrilla' | 'pm' | 'subcontratista';
    oficio: string | null;
    paralelo: boolean;
    espera: number;
    etapa: string | null;
  }[];
  readonly subcontratistas: readonly {
    nombre: string;
    oficio: string;
    telefono: string | null;
    contacto: string | null;
    correo: string | null;
    seguro_vence: string | null;
    licencia: string | null;
    licencia_vence: string | null;
    w9: boolean;
    activo: boolean;
  }[];
  readonly trabajadores: readonly {
    nombre: string;
    puesto: string | null;
    tipo_pago: 'hora' | 'dia';
    tarifa: number;
    telefono: string | null;
    activo: boolean;
  }[];
}

/** El tipo de espacio del legacy para lo que no es de un espacio, y su nombre en el modelo nuevo. */
const GENERALES = 'Generales';
const NOMBRE_GENERALES = 'Generales de obra';

/** Config del legacy → configuracion. */
const CONFIGURACION: Readonly<Record<string, string>> = {
  IMPUESTO: 'impuesto',
  LIMITE_COMPRA_PM: 'limite_compra_pm',
  SLA_BLOQUEO_HORAS: 'sla_bloqueo_horas',
  SLA_OC_HORAS: 'sla_oc_horas',
  UMBRAL_OC_MENOR: 'umbral_oc_menor',
  MARGEN_MINIMO_OC: 'margen_minimo_oc',
  HORAS_SIN_RECIBO: 'horas_sin_recibo',
};

/** Config del legacy → metas_indicadores (D-019). Solo se guardan las que difieren de la del legacy. */
const METAS: Readonly<Record<string, keyof typeof METAS_POR_OMISION>> = {
  META_TASA_REPORTE: 'tasa_cierre_dia',
  META_PRESENTACION_SUBS: 'presentacion_subs',
  META_OC_AUTORIZADAS: 'oc_autorizadas',
  MAX_OC_SOBRE_CONTRATO: 'oc_sobre_contratos',
  MAX_NO_CALIDAD: 'no_calidad_sobre_contratos',
};

const texto = (v: unknown) => String(v ?? '').trim();
const opcional = (v: unknown) => texto(v) || null;
const si = (v: unknown) => texto(v).toUpperCase() === 'SI';
const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const p2 = (n: number) => String(n).padStart(2, '0');
const dia = (v: unknown) =>
  v instanceof Date ? `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}` : null;

/** En Texas, plomería, electricidad y aire acondicionado requieren licencia estatal (legacy: requiereLicencia_). */
export const requiereLicencia = (oficio: string) =>
  /plomer|electric|aire|hvac|a\/c|clima/i.test(sinAcentos(oficio));

/** "PC3 Impermeabilización" → { clave: 'PC3', nombre: 'Impermeabilización' }. */
function hito(nombre: string): { clave: string; nombre: string } {
  const m = nombre.match(/^(\S+)\s+(.+)$/);
  return m ? { clave: m[1]!, nombre: m[2]! } : { clave: nombre, nombre };
}

/** Los renglones de una hoja, sin el encabezado. Una hoja que falta: libro_incompleto, con su nombre. */
function hoja(libro: Libro, nombre: string): unknown[][] {
  const h = libro[nombre];
  if (!h) throw new ErrorDeNegocio('libro_incompleto', { hoja: nombre });
  return h.slice(1);
}

/** Convierte el libro. Lo que no se puede cargar (un dato que falta o no se entiende) es libro_invalido. */
export function datosDelLibro(libro: Libro): DatosDelLibro {
  const problemas: { hoja: string; renglon: number; problema: string }[] = [];
  const mal = (h: string, i: number, problema: string) =>
    problemas.push({ hoja: h, renglon: i + 2, problema });

  // configuración y metas
  const configuracion: Record<string, number> = {};
  const metas: { indicador: ClaveIndicador; meta: number }[] = [];
  hoja(libro, 'Config').forEach((r, i) => {
    const clave = texto(r[0]);
    const columna = CONFIGURACION[clave];
    const meta = METAS[clave];
    if (!columna && !meta) return;
    const valor = Number(r[1]);
    if (texto(r[1]) === '' || Number.isNaN(valor) || valor < 0)
      return mal('Config', i, `${clave}: no es un número`);
    if (columna) configuracion[columna] = valor;
    else if (meta && valor !== METAS_POR_OMISION[meta]) metas.push({ indicador: meta, meta: valor });
  });

  // subcontratistas: un renglón sin sub_id es una nota
  const subcontratistas = hoja(libro, 'Subcontratistas')
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => texto(r[0]))
    .flatMap(({ r, i }) => {
      if (!texto(r[1]) || !texto(r[2])) {
        mal('Subcontratistas', i, 'falta el nombre o el oficio');
        return [];
      }
      return [
        {
          nombre: texto(r[1]),
          oficio: texto(r[2]),
          telefono: opcional(r[3]),
          contacto: opcional(r[6]),
          correo: opcional(r[7]),
          seguro_vence: dia(r[4]),
          licencia: opcional(r[8]),
          licencia_vence: dia(r[9]),
          w9: si(r[10]),
          activo: si(r[5]),
        },
      ];
    });

  // la cuadrilla: un renglón sin trabajador_id es una nota ("La tarifa NUNCA se envía a la app del PM")
  const trabajadores = hoja(libro, 'Trabajadores')
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => texto(r[0]))
    .flatMap(({ r, i }) => {
      const pago = sinAcentos(texto(r[3]));
      const tarifa = Number(r[4]);
      if (!texto(r[1])) return (mal('Trabajadores', i, 'falta el nombre'), []);
      if (pago !== 'por hora' && pago !== 'por dia')
        return (mal('Trabajadores', i, 'tipo de pago: Por hora o Por dia'), []);
      if (texto(r[4]) === '' || Number.isNaN(tarifa) || tarifa < 0)
        return (mal('Trabajadores', i, 'tarifa'), []);
      return [
        {
          nombre: texto(r[1]),
          puesto: opcional(r[2]),
          tipo_pago: pago === 'por hora' ? ('hora' as const) : ('dia' as const),
          tarifa,
          telefono: opcional(r[5]),
          activo: si(r[6]),
        },
      ];
    });

  // los puntos de control y sus preguntas
  const checklist = hoja(libro, 'Checklist_Calidad').filter((r) => texto(r[0]) && texto(r[2]));
  const hitos = [...new Set(checklist.map((r) => texto(r[0])))].map((nombre, orden) => {
    const { clave, nombre: n } = hito(nombre);
    // el punto que no se aprueba sin la prueba de inundación de 24 h: en el legacy, el que empieza con "PC3"
    return { clave, nombre_es: n, orden: orden + 1, exige_prueba_agua: clave.toUpperCase() === 'PC3' };
  });
  const puntos = checklist.map((r) => ({
    hito: hito(texto(r[0])).clave,
    orden: Number(r[1]) || 0,
    texto_es: texto(r[2]),
    requiere_foto: si(r[3]),
  }));

  // las partidas de cada tipo de espacio
  const catalogo = hoja(libro, 'Partidas_Catalogo')
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => texto(r[0]) && texto(r[2]));
  // el oficio de una partida se empata con el de un sub por texto contenido en el otro, como el legacy
  // ("Plomería" ↔ "Plomería y gas"); si ninguno empata, la partida trae su propio oficio
  const oficiosDeSubs = [...new Set(subcontratistas.map((s) => s.oficio))];
  const oficioDe = (quien: string) =>
    oficiosDeSubs.find(
      (o) => sinAcentos(o).includes(sinAcentos(quien)) || sinAcentos(quien).includes(sinAcentos(o)),
    ) ?? quien;
  const partidas = catalogo.flatMap(({ r, i }) => {
    const quien = texto(r[6]) || 'Cuadrilla';
    const q = sinAcentos(quien);
    const esSub = q !== 'cuadrilla' && q !== 'pm';
    const peso = Number(r[4]);
    if (Number.isNaN(peso) || peso <= 0)
      return (mal('Partidas_Catalogo', i, 'el peso debe ser mayor que cero'), []);
    const nombreHito = texto(r[3]);
    if (nombreHito && !hitos.some((h) => h.clave === hito(nombreHito).clave))
      return (
        mal('Partidas_Catalogo', i, `el punto de control ${nombreHito} no está en Checklist_Calidad`),
        []
      );
    return [
      {
        tipo: texto(r[0]) === GENERALES ? NOMBRE_GENERALES : texto(r[0]),
        orden: Number(r[1]) || 0,
        nombre_es: texto(r[2]),
        hito: nombreHito ? hito(nombreHito).clave : null,
        peso,
        dias: Math.max(1, Math.round(Number(r[5]) || 1)),
        responsable: esSub
          ? ('subcontratista' as const)
          : q === 'pm'
            ? ('pm' as const)
            : ('cuadrilla' as const),
        oficio: esSub ? oficioDe(quien) : null,
        paralelo: si(r[7]),
        espera: Math.max(0, Math.round(Number(r[8]) || 0)),
        etapa: opcional(r[9]),
      },
    ];
  });

  // los tipos de espacio, en el orden en que aparecen. "Generales de obra" va primero aunque el libro no lo traiga:
  // toda obra lo tiene
  const tipos = [
    { nombre_es: NOMBRE_GENERALES, es_generales: true, orden: 0 },
    ...[...new Set(catalogo.map(({ r }) => texto(r[0])))]
      .filter((t) => t !== GENERALES)
      .map((nombre_es, i) => ({ nombre_es, es_generales: false, orden: i + 1 })),
  ];

  const etapas = [...new Set(partidas.map((p) => p.etapa).filter((e): e is string => !!e))].map(
    (nombre_es, i) => ({
      nombre_es,
      orden: i + 1,
    }),
  );
  const oficios = [
    ...new Set([...oficiosDeSubs, ...partidas.flatMap((p) => (p.oficio ? [p.oficio] : []))]),
  ].map((nombre_es) => ({ nombre_es, requiere_licencia: requiereLicencia(nombre_es) }));

  if (problemas.length) throw new ErrorDeNegocio('libro_invalido', { problemas });
  if (!partidas.length) throw new ErrorDeNegocio('libro_incompleto', { hoja: 'Partidas_Catalogo' });
  return {
    configuracion,
    metas,
    tipos,
    oficios,
    etapas,
    hitos,
    puntos,
    partidas,
    subcontratistas,
    trabajadores,
  };
}
