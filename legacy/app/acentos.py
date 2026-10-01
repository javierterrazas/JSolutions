# Usado por idioma_en.py (traducir igual los nombres con y sin acentos) y como registro del cambio.
# Mapa exacto de los nombres que se ven en pantalla: sin acentos ni ñ -> corregidos.
import re
NOMBRES = {
  # puntos de control
  'PC1 Post demolicion': 'PC1 Post demolición', 'PC3 Impermeabilizacion': 'PC3 Impermeabilización',
  # partidas
  'Contenedor y disposicion': 'Contenedor y disposición',
  'Demolicion y retiro de escombro': 'Demolición y retiro de escombro', 'Demolicion': 'Demolición',
  'Electrico final y luminarias': 'Eléctrico final y luminarias', 'Iluminacion': 'Iluminación',
  'Impermeabilizacion + prueba de inundacion': 'Impermeabilización + prueba de inundación',
  'Inspeccion rough-in': 'Inspección rough-in',
  'Instalacion de appliances': 'Instalación de appliances', 'Instalacion de countertop': 'Instalación de countertop',
  'Instalacion de estructura': 'Instalación de estructura', 'Instalacion de gabinetes': 'Instalación de gabinetes',
  'Instalacion de puertas y herrajes': 'Instalación de puertas y herrajes', 'Instalacion de vanity': 'Instalación de vanity',
  'Instalacion de vidrio y accesorios': 'Instalación de vidrio y accesorios',
  'Plomeria final y luminarias': 'Plomería final y luminarias', 'Plomeria final': 'Plomería final',
  'Proteccion y movilizacion': 'Protección y movilización', 'Reparacion de muros': 'Reparación de muros',
  'Rough de plomeria': 'Rough de plomería', 'Rough electrico y extractor': 'Rough eléctrico y extractor',
  'Rough electrico': 'Rough eléctrico',
  # puntos de revision
  'Estructura visible sin dano por agua ni termita': 'Estructura visible sin daño por agua ni termita',
  'Material de la plomeria existente identificado (galvanizado, PEX, cobre)': 'Material de la plomería existente identificado (galvanizado, PEX, cobre)',
  'Subpiso nivelado, sin pudricion ni capas previas de tile': 'Subpiso nivelado, sin pudrición ni capas previas de tile',
  'El extractor existente descarga al exterior, no al atico': 'El extractor existente descarga al exterior, no al ático',
  'Hallazgos levantados como aviso el mismo dia': 'Hallazgos levantados como aviso el mismo día',
  'Prueba de presion de plomeria sostenida': 'Prueba de presión de plomería sostenida',
  'Drenaje con pendiente y ventilacion conectada': 'Drenaje con pendiente y ventilación conectada',
  'Ubicaciones verificadas contra plano: regadera, desagues, salidas': 'Ubicaciones verificadas contra plano: regadera, desagües, salidas',
  'Alturas de salidas verificadas contra el diseno de tile': 'Alturas de salidas verificadas contra el diseño de tile',
  'FOTO PANORAMICA DE CADA MURO COMPLETO antes de cubrir': 'FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir',
  'Sistema aplicado segun instrucciones del fabricante': 'Sistema aplicado según instrucciones del fabricante',
  'Pre-pendiente y pendiente correctas hacia el desague': 'Pre-pendiente y pendiente correctas hacia el desagüe',
  'Desague con brida y sello correctos': 'Desagüe con brida y sello correctos',
  'PRUEBA DE INUNDACION DE 24 HORAS documentada': 'PRUEBA DE INUNDACIÓN DE 24 HORAS documentada',
  'Plomeria probada: llaves, desagues, sanitario, sin fugas bajo vanity': 'Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity',
  'Iluminacion y extractor funcionando (extractor probado con papel)': 'Iluminación y extractor funcionando (extractor probado con papel)',
  'Silicon parejo en todas las uniones': 'Silicón parejo en todas las uniones',
  'Fotos finales para portafolio, misma toma que las del dia 1': 'Fotos finales para portafolio, misma toma que las del día 1',
  # opciones de motivo
  'Condicion oculta': 'Condición oculta', 'Cambio de seleccion': 'Cambio de selección',
  'Esperando fabricacion': 'Esperando fabricación', 'Esperando inspeccion': 'Esperando inspección',
  # oficios (van al final: son parte de nombres mas largos ya cubiertos arriba)
  'Plomeria': 'Plomería', 'Electrico': 'Eléctrico',
}
PALABRAS = [(r'\bBanos\b', 'Baños'), (r'\bbanos\b', 'baños'), (r'\bBano\b', 'Baño'), (r'\bbano\b', 'baño'),
            (r'\bdanos\b', 'daños'), (r'\bdano\b', 'daño'), (r'\bDiseno\b', 'Diseño'), (r'\bdiseno\b', 'diseño'),
            (r'\banos\b', 'años')]
ORDEN = sorted(NOMBRES, key=len, reverse=True)
def corregir(t, dueno=False):
    for v in ORDEN: t = t.replace(v, NOMBRES[v])
    for p, n in PALABRAS + ([(r'\bdueno\b', 'dueño'), (r'\bDueno\b', 'Dueño')] if dueno else []): t = re.sub(p, n, t)
    return t
