// De un libro de Excel a lo que se carga en una empresa: su catálogo (tipos de espacio, partidas, etapas, oficios,
// puntos de control), su configuración, sus metas, sus feriados, sus subcontratistas y su cuadrilla (D-039). Solo
// convierte y revisa; la carga la hace la base (cargar_libro).
//
// Lee dos formatos, con las mismas hojas y el mismo orden de columnas:
// - el libro del sistema actual (Google Sheets descargado como .xlsx), con sus reglas de lectura: un renglón sin su
//   id (sub_id, trabajador_id) es una nota, y el punto de control PC3 es el que exige la prueba de agua;
// - la plantilla estándar (plantilla.ts), que se reconoce por Config → PLANTILLA: todo renglón con datos es un
//   registro, la prueba de agua se marca en su columna, y trae nombres en inglés, días laborables y feriados.
// En los dos, "SI" es sí, los renglones que empiezan con EJEMPLO no se cargan, y el oficio de una partida se empata
// con el de un sub por texto, como el legacy.
import { ErrorDeNegocio, METAS_POR_OMISION, type ClaveIndicador } from '@ijm/core';
import { corregirAcentos } from './acentos';
import { MARCA_EJEMPLO } from './plantilla';
import type { Libro } from './xlsx';

export interface DatosDelLibro {
  readonly configuracion: Readonly<Record<string, number>>;
  /** ISO 8601: 1 = lunes … 7 = domingo (D-028). null: los de siempre. */
  readonly diasLaborables: readonly number[] | null;
  readonly metas: readonly { indicador: ClaveIndicador; meta: number }[];
  readonly feriados: readonly {
    dia: string;
    nombre_es: string;
    nombre_en: string | null;
    se_trabaja: boolean;
  }[];
  readonly tipos: readonly { nombre_es: string; es_generales: boolean; orden: number }[];
  readonly oficios: readonly { nombre_es: string; requiere_licencia: boolean }[];
  readonly etapas: readonly { nombre_es: string; orden: number }[];
  readonly hitos: readonly { clave: string; nombre_es: string; orden: number; exige_prueba_agua: boolean }[];
  readonly puntos: readonly {
    hito: string;
    orden: number;
    texto_es: string;
    texto_en: string | null;
    requiere_foto: boolean;
  }[];
  readonly partidas: readonly {
    tipo: string;
    orden: number;
    nombre_es: string;
    nombre_en: string | null;
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

/** El tipo de espacio para lo que no es de un espacio: "Generales" en el legacy, "Generales de obra" ahora. */
const NOMBRE_GENERALES = 'Generales de obra';

/** Config → configuracion. */
const CONFIGURACION: Readonly<Record<string, string>> = {
  IMPUESTO: 'impuesto',
  LIMITE_COMPRA_PM: 'limite_compra_pm',
  SLA_BLOQUEO_HORAS: 'sla_bloqueo_horas',
  SLA_OC_HORAS: 'sla_oc_horas',
  UMBRAL_OC_MENOR: 'umbral_oc_menor',
  MARGEN_MINIMO_OC: 'margen_minimo_oc',
  HORAS_SIN_RECIBO: 'horas_sin_recibo',
};

/** Config → metas_indicadores (D-019). Solo se guardan las que difieren de la del legacy. */
const METAS: Readonly<Record<string, keyof typeof METAS_POR_OMISION>> = {
  META_TASA_REPORTE: 'tasa_cierre_dia',
  META_PRESENTACION_SUBS: 'presentacion_subs',
  META_OC_AUTORIZADAS: 'oc_autorizadas',
  MAX_OC_SOBRE_CONTRATO: 'oc_sobre_contratos',
  MAX_NO_CALIDAD: 'no_calidad_sobre_contratos',
};

const DIAS_SEMANA: Readonly<Record<string, number>> = {
  lun: 1,
  mar: 2,
  mie: 3,
  jue: 4,
  vie: 5,
  sab: 6,
  dom: 7,
};

const texto = (v: unknown) => String(v ?? '').trim();
const opcional = (v: unknown) => texto(v) || null;
const si = (v: unknown) => texto(v).toUpperCase() === 'SI';
const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const p2 = (n: number) => String(n).padStart(2, '0');
const dia = (v: unknown) =>
  v instanceof Date ? `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}` : null;
const esGenerales = (tipo: string) => ['generales', 'generales de obra'].includes(sinAcentos(tipo));

/** En Texas, plomería, electricidad y aire acondicionado requieren licencia estatal (legacy: requiereLicencia_). */
export const requiereLicencia = (oficio: string) =>
  /plomer|electric|aire|hvac|a\/c|clima/i.test(sinAcentos(oficio));

/** "PC3 Impermeabilización" → { clave: 'PC3', nombre: 'Impermeabilización' }. */
function hito(nombre: string): { clave: string; nombre: string } {
  const m = nombre.match(/^(\S+)\s+(.+)$/);
  return m ? { clave: m[1]!, nombre: m[2]! } : { clave: nombre, nombre };
}

type Renglon = { readonly r: readonly unknown[]; readonly i: number };

/**
 * Los renglones de una hoja, sin el encabezado ni los de EJEMPLO, con su posición. Una hoja que falta es
 * libro_incompleto, salvo que sea opcional.
 */
function hoja(libro: Libro, nombre: string, opcionalmente = false): Renglon[] {
  const h = libro[nombre];
  if (!h) {
    if (opcionalmente) return [];
    throw new ErrorDeNegocio('libro_incompleto', { hoja: nombre });
  }
  return h
    .slice(1)
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !texto(r[0]).toUpperCase().startsWith(MARCA_EJEMPLO));
}

const conDatos = ({ r }: Renglon) => r.some((c) => texto(c) !== '');

/** Las columnas con nombres del catálogo, que se guardan con sus acentos aunque el libro no los traiga. */
const COLUMNAS_CON_ACENTOS: Readonly<Record<string, readonly number[]>> = {
  Partidas_Catalogo: [0, 2, 3, 6, 9], // tipo de espacio, partida, punto de control, quién, etapa
  Checklist_Calidad: [0, 2], // punto de control, pregunta
  Subcontratistas: [2], // oficio
};

/** Una copia del libro con los acentos puestos en los nombres del catálogo. */
function conAcentos(libro: Libro): Libro {
  const copia: Libro = { ...libro };
  for (const [nombre, columnas] of Object.entries(COLUMNAS_CON_ACENTOS)) {
    const h = libro[nombre];
    if (!h) continue;
    copia[nombre] = h.map((r, i) =>
      i === 0 ? r : r.map((c, j) => (columnas.includes(j) && typeof c === 'string' ? corregirAcentos(c) : c)),
    );
  }
  return copia;
}

/** Convierte el libro. Lo que no se puede cargar (un dato que falta o no se entiende) es libro_invalido. */
export function datosDelLibro(original: Libro): DatosDelLibro {
  const libro = conAcentos(original);
  const problemas: { hoja: string; renglon: number; problema: string }[] = [];
  const mal = (h: string, i: number, problema: string) =>
    problemas.push({ hoja: h, renglon: i + 2, problema });

  // configuración, días laborables y metas
  const config = hoja(libro, 'Config');
  const plantilla = config.some(({ r }) => texto(r[0]) === 'PLANTILLA' && texto(r[1]));
  const configuracion: Record<string, number> = {};
  const metas: { indicador: ClaveIndicador; meta: number }[] = [];
  let diasLaborables: number[] | null = null;
  for (const { r, i } of config) {
    const clave = texto(r[0]);
    if (clave === 'DIAS_LABORABLES') {
      const dias = texto(r[1])
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((d) => DIAS_SEMANA[sinAcentos(d).slice(0, 3)]);
      if (!dias.length || dias.some((d) => d === undefined))
        mal('Config', i, 'DIAS_LABORABLES: lun, mar, mie, jue, vie, sab o dom, separados por coma');
      else diasLaborables = [...new Set(dias as number[])].sort();
      continue;
    }
    const columna = CONFIGURACION[clave];
    const meta = METAS[clave];
    if (!columna && !meta) continue;
    const valor = Number(r[1]);
    if (texto(r[1]) === '' || Number.isNaN(valor) || valor < 0) {
      mal('Config', i, `${clave}: no es un número`);
      continue;
    }
    if (columna) configuracion[columna] = valor;
    else if (meta && valor !== METAS_POR_OMISION[meta]) metas.push({ indicador: meta, meta: valor });
  }

  // un registro: en la plantilla, todo renglón con datos; en el legacy, el que tiene su id (lo demás son notas)
  const registros = (rs: Renglon[]) => rs.filter((x) => (plantilla ? conDatos(x) : texto(x.r[0])));

  // feriados (solo en la plantilla)
  const feriados = registros(hoja(libro, 'Feriados', true)).flatMap(({ r, i }) => {
    const d = dia(r[1]);
    if (!texto(r[0]) || !d) return (mal('Feriados', i, 'falta el nombre o la fecha (como 2026-11-26)'), []);
    return [{ dia: d, nombre_es: texto(r[0]), nombre_en: opcional(r[3]), se_trabaja: si(r[2]) }];
  });

  // subcontratistas
  const subcontratistas = registros(hoja(libro, 'Subcontratistas')).flatMap(({ r, i }) => {
    if (!texto(r[1]) || !texto(r[2])) return (mal('Subcontratistas', i, 'falta el nombre o el oficio'), []);
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

  // la cuadrilla
  const trabajadores = registros(hoja(libro, 'Trabajadores')).flatMap(({ r, i }) => {
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
  const checklist = hoja(libro, 'Checklist_Calidad')
    .filter((x) => (plantilla ? conDatos(x) : texto(x.r[0]) && texto(x.r[2])))
    .filter(
      ({ r, i }) =>
        (texto(r[0]) && texto(r[2])) || (mal('Checklist_Calidad', i, 'falta el punto o la pregunta'), false),
    );
  const hitos = [...new Set(checklist.map(({ r }) => texto(r[0])))].map((nombre, orden) => {
    const { clave, nombre: n } = hito(nombre);
    // el punto que no se aprueba sin la prueba de inundación de 24 h: en la plantilla, el marcado; en el legacy,
    // el que empieza con "PC3"
    const agua = plantilla
      ? checklist.some(({ r }) => texto(r[0]) === nombre && si(r[4]))
      : clave.toUpperCase() === 'PC3';
    return { clave, nombre_es: n, orden: orden + 1, exige_prueba_agua: agua };
  });
  const puntos = checklist.map(({ r }) => ({
    hito: hito(texto(r[0])).clave,
    orden: Number(r[1]) || 0,
    texto_es: texto(r[2]),
    texto_en: opcional(r[5]),
    requiere_foto: si(r[3]),
  }));

  // las partidas de cada tipo de espacio
  const catalogo = hoja(libro, 'Partidas_Catalogo')
    .filter((x) => (plantilla ? conDatos(x) : texto(x.r[0]) && texto(x.r[2])))
    .filter(
      ({ r, i }) =>
        (texto(r[0]) && texto(r[2])) ||
        (mal('Partidas_Catalogo', i, 'falta el tipo de espacio o la partida'), false),
    );
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
        tipo: esGenerales(texto(r[0])) ? NOMBRE_GENERALES : texto(r[0]),
        orden: Number(r[1]) || 0,
        nombre_es: texto(r[2]),
        nombre_en: opcional(r[10]),
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
    ...[...new Set(partidas.map((p) => p.tipo))]
      .filter((t) => t !== NOMBRE_GENERALES)
      .map((nombre_es, i) => ({ nombre_es, es_generales: false, orden: i + 1 })),
  ];

  const etapas = [...new Set(partidas.map((p) => p.etapa).filter((e): e is string => !!e))].map(
    (nombre_es, i) => ({ nombre_es, orden: i + 1 }),
  );
  const oficios = [
    ...new Set([...oficiosDeSubs, ...partidas.flatMap((p) => (p.oficio ? [p.oficio] : []))]),
  ].map((nombre_es) => ({ nombre_es, requiere_licencia: requiereLicencia(nombre_es) }));

  if (problemas.length) throw new ErrorDeNegocio('libro_invalido', { problemas });
  if (!partidas.length) throw new ErrorDeNegocio('libro_sin_partidas');
  return {
    configuracion,
    diasLaborables,
    metas,
    feriados,
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
