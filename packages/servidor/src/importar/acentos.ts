// Los libros del sistema actual anteriores al cambio de acentos tienen los nombres sin acentos ni ñ ("Bano",
// "Plomeria"). El legacy los mostraba corregidos con un mapa exacto (legacy/app/acentos.py); el cargador los guarda
// ya corregidos, con el mismo mapa y dos etapas que le faltaban (D-039). Un nombre que ya trae sus acentos queda
// igual.

const NOMBRES: Readonly<Record<string, string>> = {
  // puntos de control
  'PC1 Post demolicion': 'PC1 Post demolición',
  'PC3 Impermeabilizacion': 'PC3 Impermeabilización',
  // partidas
  'Contenedor y disposicion': 'Contenedor y disposición',
  'Demolicion y retiro de escombro': 'Demolición y retiro de escombro',
  Demolicion: 'Demolición',
  'Electrico final y luminarias': 'Eléctrico final y luminarias',
  Iluminacion: 'Iluminación',
  'Impermeabilizacion + prueba de inundacion': 'Impermeabilización + prueba de inundación',
  'Inspeccion rough-in': 'Inspección rough-in',
  'Instalacion de appliances': 'Instalación de appliances',
  'Instalacion de countertop': 'Instalación de countertop',
  'Instalacion de estructura': 'Instalación de estructura',
  'Instalacion de gabinetes': 'Instalación de gabinetes',
  'Instalacion de puertas y herrajes': 'Instalación de puertas y herrajes',
  'Instalacion de vanity': 'Instalación de vanity',
  'Instalacion de vidrio y accesorios': 'Instalación de vidrio y accesorios',
  'Plomeria final y luminarias': 'Plomería final y luminarias',
  'Plomeria final': 'Plomería final',
  'Proteccion y movilizacion': 'Protección y movilización',
  'Reparacion de muros': 'Reparación de muros',
  'Rough de plomeria': 'Rough de plomería',
  'Rough electrico y extractor': 'Rough eléctrico y extractor',
  'Rough electrico': 'Rough eléctrico',
  // puntos de revisión
  'Estructura visible sin dano por agua ni termita': 'Estructura visible sin daño por agua ni termita',
  'Material de la plomeria existente identificado (galvanizado, PEX, cobre)':
    'Material de la plomería existente identificado (galvanizado, PEX, cobre)',
  'Subpiso nivelado, sin pudricion ni capas previas de tile':
    'Subpiso nivelado, sin pudrición ni capas previas de tile',
  'El extractor existente descarga al exterior, no al atico':
    'El extractor existente descarga al exterior, no al ático',
  'Hallazgos levantados como aviso el mismo dia': 'Hallazgos levantados como aviso el mismo día',
  'Prueba de presion de plomeria sostenida': 'Prueba de presión de plomería sostenida',
  'Drenaje con pendiente y ventilacion conectada': 'Drenaje con pendiente y ventilación conectada',
  'Ubicaciones verificadas contra plano: regadera, desagues, salidas':
    'Ubicaciones verificadas contra plano: regadera, desagües, salidas',
  'Alturas de salidas verificadas contra el diseno de tile':
    'Alturas de salidas verificadas contra el diseño de tile',
  'FOTO PANORAMICA DE CADA MURO COMPLETO antes de cubrir':
    'FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir',
  'Sistema aplicado segun instrucciones del fabricante':
    'Sistema aplicado según instrucciones del fabricante',
  'Pre-pendiente y pendiente correctas hacia el desague':
    'Pre-pendiente y pendiente correctas hacia el desagüe',
  'Desague con brida y sello correctos': 'Desagüe con brida y sello correctos',
  'PRUEBA DE INUNDACION DE 24 HORAS documentada': 'PRUEBA DE INUNDACIÓN DE 24 HORAS documentada',
  'Plomeria probada: llaves, desagues, sanitario, sin fugas bajo vanity':
    'Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity',
  'Iluminacion y extractor funcionando (extractor probado con papel)':
    'Iluminación y extractor funcionando (extractor probado con papel)',
  'Silicon parejo en todas las uniones': 'Silicón parejo en todas las uniones',
  'Fotos finales para portafolio, misma toma que las del dia 1':
    'Fotos finales para portafolio, misma toma que las del día 1',
  // etapas que el mapa del legacy no cubría solas
  'Carpinteria y muros': 'Carpintería y muros',
  Impermeabilizacion: 'Impermeabilización',
  // oficios (al final: son parte de nombres más largos ya cubiertos arriba)
  Plomeria: 'Plomería',
  Electrico: 'Eléctrico',
};

const PALABRAS: readonly [RegExp, string][] = [
  [/\bBanos\b/g, 'Baños'],
  [/\bbanos\b/g, 'baños'],
  [/\bBano\b/g, 'Baño'],
  [/\bbano\b/g, 'baño'],
  [/\bdanos\b/g, 'daños'],
  [/\bdano\b/g, 'daño'],
  [/\bDiseno\b/g, 'Diseño'],
  [/\bdiseno\b/g, 'diseño'],
  [/\banos\b/g, 'años'],
];

// los más largos primero, como el legacy: "Rough electrico y extractor" antes que "Rough electrico"
const ORDEN = Object.keys(NOMBRES).sort((a, b) => b.length - a.length);

/** Pone los acentos y la ñ a un nombre del catálogo escrito sin ellos (legacy: acentos.py, corregir). */
export function corregirAcentos(t: string): string {
  let r = t;
  for (const v of ORDEN) r = r.split(v).join(NOMBRES[v]!);
  for (const [p, n] of PALABRAS) r = r.replace(p, n);
  return r;
}
