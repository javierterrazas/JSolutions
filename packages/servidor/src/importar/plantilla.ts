// La plantilla estándar de datos iniciales (D-039): el libro que llena cada empresa nueva con su forma de trabajar
// (el catálogo), su configuración, sus subcontratistas y su cuadrilla, y que se carga con cargar-libro.ts. Usa los
// nombres de hoja y el orden de columnas del libro del sistema actual, para que un solo lector (libro.ts) sirva para
// los dos; lo que solo trae la plantilla (inglés, prueba de agua, días laborables, feriados) va en columnas u hojas
// propias. Los renglones grises que empiezan con EJEMPLO nunca se cargan.
import { escribirLibro, type Celda, type HojaParaEscribir, type Valor } from './escribir-xlsx';

/** La versión de la plantilla, en Config → PLANTILLA. Así el lector sabe que no es un libro del sistema anterior. */
export const VERSION_PLANTILLA = 'J Solutions 1';
export const MARCA_EJEMPLO = 'EJEMPLO';

const SI_NO = ['SI', 'NO'];
const HASTA = 1000;

const encabezados = (...t: string[]): Celda[] => t.map((v) => ({ v, estilo: 'encabezado' as const }));
const ejemplo = (...vs: Valor[]): Celda[] =>
  vs.map((v, i) => ({
    v: i === 0 && typeof v === 'string' ? `${MARCA_EJEMPLO} · ${v}` : v,
    estilo: v instanceof Date ? ('ejemplo_fecha' as const) : ('ejemplo' as const),
  }));
const llenar = (v: Valor = null): Celda => ({ v, estilo: 'llenar' });
const fecha = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a!, m! - 1, d!);
};
const p = (v: string): Celda[] => [{ v, estilo: 'parrafo' }];

const INSTRUCCIONES: HojaParaEscribir = {
  nombre: 'Instrucciones',
  anchos: [110],
  filas: [
    [{ v: 'Plantilla de datos iniciales · J Solutions', estilo: 'titulo' }],
    p(
      'Llena este libro con los datos de tu empresa y mándalo a quien administra J Solutions. Con él se carga tu empresa antes de empezar: tu forma de trabajar (el catálogo), tu configuración, tus subcontratistas y tu cuadrilla.',
    ),
    [],
    [{ v: 'Cómo llenarlo', estilo: 'titulo' }],
    p(
      '1. Cada pestaña es un tema. No cambies el nombre de las pestañas ni el primer renglón (los títulos en azul).',
    ),
    p(
      '2. Los renglones grises que empiezan con EJEMPLO muestran cómo se llena cada pestaña. Puedes dejarlos o borrarlos: nunca se cargan.',
    ),
    p('3. Las celdas amarillas (en Empresa y Config) son las que tienes que llenar o revisar.'),
    p('4. Donde la celda tiene una lista (SI / NO, Por hora / Por dia), elige de la lista.'),
    p(
      '5. Las fechas, como 2027-03-31. Los montos, sin el signo de pesos. Los porcentajes, como fracción: 8.25% es 0.0825.',
    ),
    p(
      '6. Puedes llenarlo en Excel o en Google Sheets. Desde Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx).',
    ),
    [],
    [{ v: 'Qué va en cada pestaña', estilo: 'titulo' }],
    p(
      'Empresa: el nombre, la ciudad, el dueño y su correo. Con esto se da de alta la empresa y se prepara la invitación del dueño.',
    ),
    p(
      'Equipo: tus PMs. El dueño los invita desde la app (pantalla Equipo); aquí solo se anotan para tenerlos a la mano.',
    ),
    p(
      'Config: los valores de tu negocio (impuesto, límite de compra del PM, plazos de respuesta, días laborables y metas).',
    ),
    p('Feriados: los días que no se trabaja. Si un feriado sí se trabaja, pon SI en "Se trabaja".'),
    p(
      'Partidas_Catalogo: los pasos de cada tipo de espacio (Baño, Cocina, Closet…). Es lo más importante: de aquí salen el cronograma, el avance y el presupuesto de cada obra.',
    ),
    p(
      '   • Tipo de espacio: Baño, Cocina, Closet… "Generales de obra" es lo que no es de un espacio: protección, permisos, contenedor, limpieza final.',
    ),
    p('   • Orden: el orden de la partida dentro de su espacio (1, 2, 3…).'),
    p(
      '   • Punto de control: el de Checklist_Calidad que revisa esa partida, escrito igual (p. ej. "PC1 Post demolición"). Vacío si ninguno.',
    ),
    p(
      '   • Peso: cuánto pesa en el avance del espacio, comparado con las demás partidas del mismo espacio (10 pesa el doble que 5).',
    ),
    p(
      '   • Días: los días de trabajo que toma. Espera: los días que hay que esperar después (secado, inspección).',
    ),
    p(
      '   • Quién la hace: Cuadrilla, PM, o el oficio del subcontratista (Plomería, Eléctrico, Tile…), escrito igual que en Subcontratistas.',
    ),
    p('   • En paralelo: SI si puede hacerse al mismo tiempo que la partida anterior.'),
    p('   • Etapa del presupuesto: el renglón del presupuesto donde cae (Demolición, Plomería, Tile…).'),
    p(
      'Checklist_Calidad: los puntos de control de calidad y sus preguntas. El punto se escribe con su clave y su nombre ("PC1 Post demolición"). "Exige prueba de agua": SI en el punto que no se aprueba sin la prueba de inundación de 24 horas.',
    ),
    p(
      'Subcontratistas: con sus papeles. En Texas, plomería, electricidad y aire acondicionado requieren licencia estatal; la app avisa si falta o venció.',
    ),
    p('Trabajadores: tu cuadrilla propia, con su tarifa por hora o por día. El PM nunca ve la tarifa.'),
    p('Las columnas "en inglés" son opcionales: lo que no tenga inglés se muestra en español.'),
    [],
    [{ v: 'Qué pasa después', estilo: 'titulo' }],
    p(
      'Antes de cargarlo se revisa y se muestra un resumen. Si algún dato no se entiende, se te dice la pestaña y el renglón para corregirlo. Se carga una sola vez; después, los cambios se hacen en la app.',
    ),
  ],
};

const EMPRESA: HojaParaEscribir = {
  nombre: 'Empresa',
  anchos: [26, 34, 70],
  congelar: true,
  filas: [
    encabezados('Dato', 'Valor', 'Nota'),
    ['Nombre de la empresa', llenar(), 'Como aparecerá en la app.'],
    ['Ciudad', llenar(), 'P. ej. Austin, TX.'],
    [
      'Zona horaria',
      llenar('America/Chicago'),
      'America/Chicago para casi todo Texas; America/Denver para El Paso.',
    ],
    ['Idioma de la empresa', llenar('es'), 'es (español) o en (inglés).'],
    ['Nombre del dueño', llenar(), ''],
    ['Correo del dueño', llenar(), 'Es su usuario. No se le manda nada: su invitación se le entrega aparte.'],
  ],
  listas: [{ rango: 'B5', opciones: ['es', 'en'] }],
};

const EQUIPO: HojaParaEscribir = {
  nombre: 'Equipo',
  anchos: [30, 34, 12, 12],
  congelar: true,
  filas: [
    encabezados('Nombre', 'Correo', 'Idioma', 'Rol'),
    ejemplo('Carlos Méndez', 'carlos@ejemplo.com', 'es', 'PM'),
  ],
  listas: [
    { rango: `C2:C${HASTA}`, opciones: ['es', 'en'] },
    { rango: `D2:D${HASTA}`, opciones: ['PM', 'Administrador'] },
  ],
};

const CONFIG: HojaParaEscribir = {
  nombre: 'Config',
  anchos: [26, 26, 80],
  congelar: true,
  filas: [
    encabezados('Parametro', 'Valor', 'Descripcion'),
    ['PLANTILLA', VERSION_PLANTILLA, 'No lo cambies: dice qué versión de la plantilla es.'],
    ['IMPUESTO', llenar(0.0825), 'Sales tax de las órdenes de cambio, como fracción (0.0825 = 8.25%).'],
    ['LIMITE_COMPRA_PM', llenar(300), 'Monto máximo ($) que el PM puede gastar sin autorización.'],
    ['SLA_BLOQUEO_HORAS', llenar(24), 'Horas máximas para que el dueño responda un aviso del PM.'],
    ['SLA_OC_HORAS', llenar(48), 'Horas máximas del hallazgo a la orden de cambio emitida.'],
    ['UMBRAL_OC_MENOR', llenar(200), 'Debajo de este monto ($), la orden de cambio se acumula o se absorbe.'],
    [
      'MARGEN_MINIMO_OC',
      llenar(0.35),
      'Margen mínimo exigido en una orden de cambio, como fracción (0.35 = 35%).',
    ],
    ['HORAS_SIN_RECIBO', llenar(72), 'Horas máximas de un cargo sin foto del recibo.'],
    [
      'DIAS_LABORABLES',
      llenar('lun,mar,mie,jue,vie,sab'),
      'Los días que se trabaja, separados por coma: lun, mar, mie, jue, vie, sab, dom.',
    ],
    ['META_TASA_REPORTE', llenar(0.95), 'Meta: días cerrados por el PM sobre días de obra (0.95 = 95%).'],
    ['META_PRESENTACION_SUBS', llenar(0.9), 'Meta: subs que llegan sobre subs que confirmaron.'],
    ['META_OC_AUTORIZADAS', llenar(0.7), 'Meta: órdenes de cambio que el cliente aprueba.'],
    [
      'MAX_OC_SOBRE_CONTRATO',
      llenar(0.2),
      'Tope: órdenes de cambio sobre el contrato (arriba, el problema es la estimación).',
    ],
    ['MAX_NO_CALIDAD', llenar(0.02), 'Tope: costo de no calidad sobre ingresos.'],
  ],
};

const FERIADOS: HojaParaEscribir = {
  nombre: 'Feriados',
  anchos: [36, 14, 14, 36],
  congelar: true,
  filas: [
    encabezados('Nombre', 'Fecha', 'Se trabaja', 'Nombre en inglés (opcional)'),
    ejemplo('Día de Acción de Gracias', fecha('2026-11-26'), 'NO', 'Thanksgiving Day'),
  ],
  listas: [{ rango: `C2:C${HASTA}`, opciones: SI_NO }],
};

const PARTIDAS: HojaParaEscribir = {
  nombre: 'Partidas_Catalogo',
  anchos: [22, 8, 34, 26, 8, 8, 18, 12, 10, 24, 34],
  congelar: true,
  filas: [
    encabezados(
      'Tipo de espacio',
      'Orden',
      'Partida',
      'Punto de control',
      'Peso',
      'Días',
      'Quién la hace',
      'En paralelo',
      'Espera (días)',
      'Etapa del presupuesto',
      'Partida en inglés (opcional)',
    ),
    ejemplo(
      'Generales de obra',
      1,
      'Protección y movilización',
      '',
      2,
      1,
      'Cuadrilla',
      'NO',
      0,
      'Generales de obra',
      'Protection and setup',
    ),
    ejemplo(
      'Baño',
      3,
      'Rough de plomería',
      'PC2 Pre-cierre de muros',
      10,
      2,
      'Plomería',
      'NO',
      0,
      'Plomería',
      'Plumbing rough-in',
    ),
  ],
  listas: [{ rango: `H2:H${HASTA}`, opciones: SI_NO }],
};

const CHECKLIST: HojaParaEscribir = {
  nombre: 'Checklist_Calidad',
  anchos: [28, 8, 60, 14, 16, 60],
  congelar: true,
  filas: [
    encabezados(
      'Punto de control',
      'Orden',
      'Pregunta',
      'Requiere foto',
      'Exige prueba de agua',
      'Pregunta en inglés (opcional)',
    ),
    ejemplo(
      'PC2 Pre-cierre de muros',
      1,
      'Prueba de presión de plomería sostenida',
      'SI',
      'NO',
      'Plumbing pressure test held',
    ),
  ],
  listas: [
    { rango: `D2:D${HASTA}`, opciones: SI_NO },
    { rango: `E2:E${HASTA}`, opciones: SI_NO },
  ],
};

const SUBCONTRATISTAS: HojaParaEscribir = {
  nombre: 'Subcontratistas',
  anchos: [14, 30, 18, 16, 14, 10, 22, 30, 14, 14, 8],
  congelar: true,
  filas: [
    encabezados(
      'Clave (opcional)',
      'Nombre',
      'Oficio',
      'Teléfono',
      'Seguro vence',
      'Activo',
      'Contacto',
      'Correo',
      'Licencia',
      'Licencia vence',
      'W-9',
    ),
    ejemplo(
      'SUB-01',
      'Rios Plumbing LLC',
      'Plomería',
      '512-555-0301',
      fecha('2027-03-31'),
      'SI',
      'Arturo Rios',
      'arturo@riosplumbing.com',
      'M-40218',
      fecha('2027-08-31'),
      'SI',
    ),
  ],
  listas: [
    { rango: `F2:F${HASTA}`, opciones: SI_NO },
    { rango: `K2:K${HASTA}`, opciones: SI_NO },
  ],
};

const TRABAJADORES: HojaParaEscribir = {
  nombre: 'Trabajadores',
  anchos: [14, 28, 24, 14, 12, 16, 10],
  congelar: true,
  filas: [
    encabezados('Clave (opcional)', 'Nombre', 'Puesto', 'Tipo de pago', 'Tarifa ($)', 'Teléfono', 'Activo'),
    ejemplo('TRB-01', 'Jose Luna', 'Oficial de tile', 'Por hora', 32, '512-555-0401', 'SI'),
  ],
  listas: [
    { rango: `D2:D${HASTA}`, opciones: ['Por hora', 'Por dia'] },
    { rango: `G2:G${HASTA}`, opciones: SI_NO },
  ],
};

export const HOJAS_PLANTILLA = [
  INSTRUCCIONES,
  EMPRESA,
  EQUIPO,
  CONFIG,
  FERIADOS,
  PARTIDAS,
  CHECKLIST,
  SUBCONTRATISTAS,
  TRABAJADORES,
] as const;

/** La plantilla vacía, lista para llenarse: solo sus títulos, sus renglones de ejemplo y la configuración típica. */
export function generarPlantilla(): Buffer {
  return escribirLibro(HOJAS_PLANTILLA);
}
