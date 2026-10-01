// ARCHIVO GENERADO por construir.py a partir de fuente/. No lo edites aquí: tus cambios se perderían
// en la siguiente construcción. Edita fuente/ y vuelve a correr: python3 construir.py

// admin/config.js
// Solo de la app del administrador. Lo compartido está en comun/. Después de editar, corre construir.py.

// lo que distingue a esta app en el código compartido
const APP_NOMBRE_ = 'Admin';

const PREFIJO_SESION_ = 'du_';

const SH = {
  CONFIG: 'Config', USUARIOS: 'Usuarios', PROYECTOS: 'Proyectos',
  PARTIDAS: 'Partidas_Catalogo', SUBS: 'Subcontratistas', BITACORA: 'Bitacora',
  AVANCE: 'Avance', GASTOS: 'Gastos', OT: 'Ordenes_Trabajo',
  BLOQUEOS: 'Bloqueos', OC: 'Ordenes_Cambio', NC: 'No_Calidad',
  TRABAJADORES: 'Trabajadores', MANO_OBRA: 'Mano_Obra', PAGOS: 'Pagos_Sub',
  PRESUPUESTO: 'Presupuesto', COBROS: 'Cobros', CERRADAS: 'Obras_Cerradas',
  CHECKLIST: 'Checklist_Calidad', CALIDAD: 'Calidad', AGUA: 'Pruebas_Agua',
  PUNCH: 'Punch_List', ENTREGA: 'Entrega', AREAS: 'Areas', PARTIDAS_OBRA: 'Partidas_Obra', PLAN_SEMANAL: 'Plan_Semanal'
};

/** Llena las duraciones sugeridas en las partidas estandar que no las tengan (catalogo y obras en curso). */
const CRONO_SUGERIDO = {
  'Protección y movilización': [1, 'Cuadrilla', '', 0], 'Permisos e inspecciones': [1, 'PM', 'SI', 0], 'Contenedor y disposición': [1, 'PM', 'SI', 0],
  'Limpieza final y punch list': [1, 'Cuadrilla', '', 0], 'Demolición y retiro de escombro': [2, 'Cuadrilla', '', 0], 'Rough de plomería': [2, 'Plomería', '', 0],
  'Rough eléctrico y extractor': [1, 'Eléctrico', 'SI', 0], 'Blocking y framing': [1, 'Cuadrilla', '', 0], 'Inspección rough-in': [1, 'PM', '', 0],
  'Cementboard y drywall': [1, 'Cuadrilla', '', 0], 'Impermeabilización + prueba de inundación': [2, 'Cuadrilla', '', 0], 'Tile de piso y muro': [3, 'Tile', '', 0],
  'Plantilla de puerta de vidrio': [1, 'PM', '', 0], 'Lechada y sellado': [1, 'Cuadrilla', 'SI', 0], 'Instalación de vanity': [1, 'Cuadrilla', 'SI', 0],
  'Plantilla de countertop': [1, 'PM', '', 0], 'Pintura primera mano': [1, 'Cuadrilla', 'SI', 0], 'Instalación de countertop': [1, 'Countertops', '', 3],
  'Instalación de vidrio y accesorios': [1, 'Vidrio', 'SI', 3], 'Plomería final y luminarias': [1, 'Plomería', '', 0], 'Rough eléctrico': [2, 'Eléctrico', 'SI', 0],
  'Framing y blocking': [1, 'Cuadrilla', '', 0], 'Drywall y acabado': [2, 'Drywall', '', 0], 'Piso': [2, 'Cuadrilla', '', 0],
  'Instalación de gabinetes': [2, 'Cuadrilla', '', 0], 'Backsplash': [2, 'Tile', '', 0], 'Plomería final': [1, 'Plomería', 'SI', 0],
  'Eléctrico final y luminarias': [1, 'Eléctrico', '', 0], 'Instalación de appliances': [1, 'Cuadrilla', 'SI', 0], 'Demolición': [1, 'Cuadrilla', '', 0],
  'Reparación de muros': [1, 'Cuadrilla', '', 0], 'Pintura': [1, 'Cuadrilla', '', 0], 'Instalación de estructura': [2, 'Cuadrilla', '', 0],
  'Instalación de puertas y herrajes': [1, 'Cuadrilla', '', 0], 'Iluminación': [1, 'Eléctrico', 'SI', 0]
};

// ------------------------------------------------------ etapas del presupuesto
/*
 * El presupuesto se captura por ETAPA (demolicion, roughs, acabados...): un costo esperado por etapa y
 * por espacio, no un renglon por partida. El PM sigue registrando por partida y el sistema suma sus
 * costos por etapa: ahi los errores de asignacion del campo (tile contra lechada) se compensan y el
 * desvio si dice algo. Una partida sin etapa cae en "Otras partidas".
 */
const SIN_ETAPA = 'Otras partidas';

// una etapa por TIPO DE TRABAJO: un precio para todo lo de demolicion, otro para todo lo de plomeria...
const ETAPA_SUGERIDA = {
  Generales: { 'Protección y movilización': 'Generales de obra', 'Permisos e inspecciones': 'Generales de obra',
               'Contenedor y disposición': 'Generales de obra', 'Limpieza final y punch list': 'Generales de obra' },
  Bano: { 'Demolición y retiro de escombro': 'Demolición', 'Rough de plomería': 'Plomería', 'Inspección rough-in': 'Plomería',
          'Plomería final y luminarias': 'Plomería', 'Rough eléctrico y extractor': 'Eléctrico', 'Blocking y framing': 'Carpintería y muros',
          'Cementboard y drywall': 'Carpintería y muros', 'Impermeabilización + prueba de inundación': 'Impermeabilización',
          'Tile de piso y muro': 'Tile', 'Lechada y sellado': 'Tile', 'Pintura primera mano': 'Pintura',
          'Instalación de vanity': 'Vanity y countertop', 'Plantilla de countertop': 'Vanity y countertop',
          'Instalación de countertop': 'Vanity y countertop', 'Plantilla de puerta de vidrio': 'Vidrio y accesorios',
          'Instalación de vidrio y accesorios': 'Vidrio y accesorios' },
  Cocina: { 'Demolición y retiro de escombro': 'Demolición', 'Rough de plomería': 'Plomería', 'Inspección rough-in': 'Plomería',
            'Plomería final': 'Plomería', 'Rough eléctrico': 'Eléctrico', 'Eléctrico final y luminarias': 'Eléctrico',
            'Framing y blocking': 'Carpintería y muros', 'Drywall y acabado': 'Carpintería y muros', 'Pintura primera mano': 'Pintura',
            'Piso': 'Piso', 'Instalación de gabinetes': 'Gabinetes', 'Plantilla de countertop': 'Countertop',
            'Instalación de countertop': 'Countertop', 'Backsplash': 'Backsplash', 'Instalación de appliances': 'Appliances' },
  Closet: { 'Demolición': 'Demolición', 'Reparación de muros': 'Muros y pintura', 'Pintura': 'Muros y pintura',
            'Instalación de estructura': 'Sistema de closet', 'Instalación de puertas y herrajes': 'Sistema de closet', 'Iluminación': 'Eléctrico' }
};

// la agrupacion anterior, por fase: sirve para reconocer las etiquetas que nadie ha modificado y cambiarlas
const ETAPA_POR_FASE_ = {
  Generales: { 'Protección y movilización': 'Generales de obra', 'Permisos e inspecciones': 'Generales de obra',
               'Contenedor y disposición': 'Generales de obra', 'Limpieza final y punch list': 'Generales de obra' },
  Bano: { 'Demolición y retiro de escombro': 'Demolición', 'Rough de plomería': 'Roughs', 'Rough eléctrico y extractor': 'Roughs',
          'Blocking y framing': 'Roughs', 'Inspección rough-in': 'Roughs', 'Cementboard y drywall': 'Preparación e impermeabilización',
          'Impermeabilización + prueba de inundación': 'Preparación e impermeabilización', 'Tile de piso y muro': 'Acabados',
          'Lechada y sellado': 'Acabados', 'Pintura primera mano': 'Acabados', 'Plantilla de puerta de vidrio': 'Instalaciones finales',
          'Instalación de vanity': 'Instalaciones finales', 'Plantilla de countertop': 'Instalaciones finales',
          'Instalación de countertop': 'Instalaciones finales', 'Instalación de vidrio y accesorios': 'Instalaciones finales',
          'Plomería final y luminarias': 'Instalaciones finales' },
  Cocina: { 'Demolición y retiro de escombro': 'Demolición', 'Rough de plomería': 'Roughs', 'Rough eléctrico': 'Roughs',
            'Framing y blocking': 'Roughs', 'Inspección rough-in': 'Roughs', 'Drywall y acabado': 'Muros y piso',
            'Pintura primera mano': 'Muros y piso', 'Piso': 'Muros y piso', 'Instalación de gabinetes': 'Gabinetes y countertop',
            'Plantilla de countertop': 'Gabinetes y countertop', 'Instalación de countertop': 'Gabinetes y countertop',
            'Backsplash': 'Gabinetes y countertop', 'Plomería final': 'Instalaciones finales',
            'Eléctrico final y luminarias': 'Instalaciones finales', 'Instalación de appliances': 'Instalaciones finales' },
  Closet: { 'Demolición': 'Preparación', 'Reparación de muros': 'Preparación', 'Pintura': 'Preparación',
            'Instalación de estructura': 'Sistema e instalación', 'Instalación de puertas y herrajes': 'Sistema e instalación',
            'Iluminación': 'Sistema e instalación' }
};

// ------------------------------------------------------ respaldos, salud del libro y proteccion
const ESQUEMA_ = {"Config":["Parametro","Valor","Descripcion"],"Usuarios":["usuario","pin","nombre","rol","tarjeta_ultimos4","telefono","activo","correo_avisos","idioma"],"Proyectos":["proyecto_id","cliente","telefono_cliente","direccion","etiqueta","pm_usuario","fecha_inicio","fecha_fin_est","fecha_fin_real","estado","contrato_original","notas"],"Areas":["area_id","proyecto_id","tipo","nombre","pies2","pies_lineales","orden"],"Partidas_Catalogo":["tipo_obra","orden","partida","hito_calidad","peso","dias","quien","paralelo","espera","etapa"],"Subcontratistas":["sub_id","nombre","oficio","telefono","seguro_vence","activo","contacto","correo","licencia","licencia_vence","w9"],"Bitacora":["bitacora_id","fecha","proyecto_id","usuario","partidas","subs_presentes","incidencia","fotos_url","timestamp","estado","tardio","fotos_pendientes"],"Avance":["avance_id","fecha","proyecto_id","partida","estado","usuario","timestamp","vigencia","area_id"],"Gastos":["gasto_id","fecha","proyecto_id","categoria","proveedor","descripcion","monto","metodo_pago","tarjeta_ultimos4","recibo_url","usuario","timestamp","partida","estado","area_id","revision"],"Ordenes_Trabajo":["ot_id","proyecto_id","sub_id","oficio","alcance","precio","fecha_inicio_prog","fecha_fin_prog","estado","fecha_confirmacion","se_presento","fecha_aprobacion","aprobada_por","partida","area_id","faltas"],"Bloqueos":["bloqueo_id","fecha_hora","proyecto_id","tipo","descripcion","foto_url","levantado_por","detiene_avance","estado","respuesta","fecha_respuesta","horas_respuesta","genera_oc"],"Ordenes_Cambio":["oc_id","proyecto_id","fecha_hallazgo","motivo","descripcion","costo_estimado","precio_cliente","margen_pct","dias_impacto","estado","fecha_emision","fecha_autorizacion","fecha_cobro","condicion_pago","foto_url","bloqueo_id","creada_por"],"No_Calidad":["nc_id","fecha","proyecto_id","tipo","causa","sub_responsable","costo","dias_perdidos","descripcion","estado","fecha_cierre","registrado_por"],"Trabajadores":["trabajador_id","nombre","puesto","tipo_pago","tarifa","telefono","activo"],"Mano_Obra":["mo_id","fecha","proyecto_id","trabajador_id","partida","horas","registrado_por","timestamp","estado","area_id"],"Pagos_Sub":["pago_id","fecha","ot_id","proyecto_id","sub_id","concepto","monto","metodo","referencia","registrado_por","timestamp","estado"],"Checklist_Calidad":["hito","orden","punto","requiere_foto"],"Calidad":["calidad_id","fecha","proyecto_id","hito","partida","resultado","puntos_ok","puntos_total","defectos","fotos_url","inspeccionado_por","timestamp","area_id","no_aplica"],"Pruebas_Agua":["prueba_id","proyecto_id","fecha_inicio","foto_inicio","fecha_fin","foto_fin","horas","resultado","registrado_por","area_id"],"Punch_List":["punch_id","proyecto_id","fecha","item","origen","responsable","fecha_compromiso","estado","fecha_cierre","foto_url","registrado_por"],"Entrega":["entrega_id","proyecto_id","fecha_entrega","garantia_meses","garantia_vence","autoriza_fotos","resena_pedida","resena_recibida","referido_pedido","visita_11m","notas","entregado_por","timestamp"],"Presupuesto":["presupuesto_id","proyecto_id","etapa","monto_presupuestado","notas","cantidad","unidad","area_id","nivel"],"Cobros":["cobro_id","fecha","proyecto_id","concepto","monto","metodo","referencia","registrado_por","timestamp","estado"],"Obras_Cerradas":["cierre_id","proyecto_id","cliente","tipo_obra","pm","fecha_inicio","fecha_fin_real","dias_ciclo","contrato_original","monto_oc","contrato_final","presupuestado","materiales","cuadrilla","subcontratos","costo_total","margen_bruto","desviacion_estimacion","cobrado","no_calidad","dias_reportados","cerrada_por","timestamp","pies2"],"Correcciones":["corr_id","fecha","usuario","hoja","registro_id","accion","campo","antes","despues","motivo"],"Partidas_Obra":["area_id","proyecto_id","orden","partida","hito_calidad","peso","estado","dias","quien","paralelo","espera","etapa"],"Plan_Semanal":["semana","proyecto_id","area_id","partida","fin_previsto"]};

// encabezados que cambiaron de nombre entre versiones: no son un problema
const ALIAS_ = { Presupuesto: { 2: ['partida'] }, Usuarios: { 0: ['email', 'correo'] } };

const EDITABLES_ = ['Config', 'Usuarios', 'Trabajadores', 'Subcontratistas', 'Partidas_Catalogo', 'Checklist_Calidad'];

const PROPS_ = () => PropertiesService.getScriptProperties();

// acciones que se pueden hacer con 'guardar y ver' en un solo viaje (generada al transformar las pantallas)
const HACER_ADMIN_ = ['duFotosCriticas', 'duActivarSub', 'duAgregarArea', 'duAgregarPartidaObra', 'duAnular', 'duBajaTrabajador', 'duBorrarPartida', 'duBorrarPunto', 'duCancelarOT', 'duCerrarGarantia', 'duCerrarObra', 'duCierreTardio', 'duClonarSecuencia', 'duCobro', 'duCosecha', 'duCrearOC', 'duCrearOT', 'duCrearTipo', 'duEntrega', 'duEstadoOC', 'duGarantia', 'duGasto', 'duGuardarPartida', 'duGuardarPresupuesto', 'duGuardarPunto', 'duGuardarSub', 'duGuardarTrabajador', 'duNoCalidad', 'duPagoSub', 'duQuitarPartidaObra', 'duReprogramarOT', 'duResponderBloqueo', 'duRevisarGasto', 'duSugerirDuraciones'];

// foto solo en lo critico: donde algo queda oculto despues o protege en una disputa o garantia
const FOTO_CRITICA_ = ["Estructura visible sin daño por agua ni termita", "Material de la plomería existente identificado (galvanizado, PEX, cobre)", "Prueba de presión de plomería sostenida", "FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir", "Refuerzo en esquinas, juntas y penetraciones", "Desagüe con brida y sello correctos", "Gabinetes nivelados, a plomo y anclados a blocking", "Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity", "Fotos finales para portafolio, misma toma que las del día 1"];

// los puntos que trae la plantilla: el boton de fotos criticas solo toca estos, nunca los que agrego el dueno
const PUNTOS_ESTANDAR_ = ["Estructura visible sin daño por agua ni termita", "Material de la plomería existente identificado (galvanizado, PEX, cobre)", "Cableado sin aluminio; GFCI presente donde aplica", "Subpiso nivelado, sin pudrición ni capas previas de tile", "El extractor existente descarga al exterior, no al ático", "Muros medidos a nivel y plomo", "Sin evidencia de moho ni humedad previa", "Hallazgos levantados como aviso el mismo día", "Prueba de presión de plomería sostenida", "Drenaje con pendiente y ventilación conectada", "Ubicaciones verificadas contra plano: regadera, desagües, salidas", "Blocking para barras, banco, nichos, toallero y vanity", "Circuitos dedicados y GFCI en su lugar", "Extractor con ducto aislado al exterior y damper", "Alturas de salidas verificadas contra el diseño de tile", "FOTO PANORÁMICA DE CADA MURO COMPLETO antes de cubrir", "Sistema aplicado según instrucciones del fabricante", "Refuerzo en esquinas, juntas y penetraciones", "Pre-pendiente y pendiente correctas hacia el desagüe", "Desagüe con brida y sello correctos", "PRUEBA DE INUNDACIÓN DE 24 HORAS documentada", "Sin perforaciones posteriores a la prueba", "Tile a nivel, a plomo y con juntas alineadas", "Sin piezas huecas (golpear con nudillo)", "Lechada uniforme, sin faltantes y curada", "Sellador en los cambios de plano, no lechada", "Gabinetes nivelados, a plomo y anclados a blocking", "Puertas y cajones con holgura pareja", "Superficie a nivel antes de tomar plantilla de countertop", "Plomería probada: llaves, desagües, sanitario, sin fugas bajo vanity", "Puerta de regadera alineada, sellada y sin roce", "Iluminación y extractor funcionando (extractor probado con papel)", "Tomacorrientes probados; GFCI disparado y reseteado", "Cajones y puertas ajustados", "Silicón parejo en todas las uniones", "Pintura sin marcas y tapas de registro colocadas", "Limpieza profunda hecha, incluye interior de gabinetes y vidrios", "Fotos finales para portafolio, misma toma que las del día 1"];

// comun/acceso.js — Sesiones firmadas y verificación de usuarios.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------------ sesiones firmadas
/*
 * CacheService no guarda nada mas de 6 horas y la jornada de un PM dura 9: la sesion
 * vencia justo en el cierre de dia. Ahora el pase lleva su propio vencimiento, firmado
 * con un secreto del proyecto, y no se guarda en ningun lado. En cada llamada se revisa
 * ademas que el usuario siga activo: darlo de baja le corta el acceso en ese momento.
 */
const HORAS_SESION = { pm_: 16, du_: 12 };

// comun/datos.js — Acceso al libro: hojas, lecturas con memoria, fechas.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

/**
 * IJM - CONTROL DE OBRA (app del dueno)
 * Procesos 3 (control diario) y 4 (ordenes de cambio).
 *
 * Esta app ve TODO: montos, margenes, costos y KPIs.
 * Se despliega como un proyecto de Apps Script SEPARADO del de campo.
 *
 * Instalacion: ver INSTALACION.md
 */

const SS_ID = 'PEGAR_AQUI_EL_ID_DEL_SPREADSHEET';

const _memo = {};

// ------------------------------------------------------------- correcciones
/*
 * Nada se borra. Un registro equivocado se ANULA (queda en la hoja, sale de
 * todos los calculos) o se EDITA campo por campo. Las dos cosas dejan rastro
 * en la hoja Correcciones, con motivo obligatorio.
 */

// hoja -> indice (base 0) de la columna de estado
const ANULABLE = { 'Gastos': 13, 'Avance': 7, 'Bitacora': 9, 'Mano_Obra': 8,
                   'Cobros': 9, 'Pagos_Sub': 11 };

// comun/utilidades.js — Funciones compartidas de uso general.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

let _ss = null;

// hoja -> campos editables con su columna (base 1)
const EDITABLE = {
  'Gastos':    { monto: 7, partida: 13, categoria: 4, proveedor: 5, descripcion: 6, proyecto_id: 3 },
  'Mano_Obra': { horas: 6, partida: 5, proyecto_id: 3 },
  'Bitacora':  { incidencia: 7, partidas: 5 },
  'Cobros':    { monto: 5, concepto: 4, referencia: 7 },
  'Pagos_Sub': { monto: 7, concepto: 6, referencia: 9 },
  'Avance':    {}
};

// hoja -> indices (base 0) de quien lo capturo, cuando, y de que obra es
const META = {
  'Gastos':    { usuario: 10, fecha: 1, obra: 2 },
  'Mano_Obra': { usuario: 6,  fecha: 1, obra: 2 },
  'Avance':    { usuario: 5,  fecha: 1, obra: 2 },
  'Bitacora':  { usuario: 3,  fecha: 1, obra: 2 },
  'Cobros':    { usuario: 7,  fecha: 1, obra: 2 },
  'Pagos_Sub': { usuario: 9,  fecha: 1, obra: 3 }
};

// ------------------------------------------------------------------- areas
/*
 * El proyecto es la unidad comercial (cliente, contrato, entrega).
 * El area es la unidad tecnica (secuencia, pies2, costos, calidad).
 * Toda partida se identifica por AREA + nombre: "Rough de plomería" del bano
 * y la de la cocina son trabajos distintos y nunca se mezclan.
 */

// indice (base 0) de area_id en cada hoja
const COL_AREA = { 'Presupuesto': 7, 'Avance': 8, 'Gastos': 14, 'Mano_Obra': 9,
                   'Ordenes_Trabajo': 14, 'Calidad': 12, 'Pruebas_Agua': 9 };

// ------------------------------------------------------------------- acceso
/*
 * El usuario puede ser un nombre ("carlos") o un correo: es solo el texto
 * con el que se entra. Los correos de aviso salen de la columna correo_avisos.
 *
 * Limite de intentos: 5 fallidos seguidos bloquean ese usuario 15 minutos.
 * Un PIN de 4 digitos son 10,000 combinaciones; sin limite, se adivina.
 * El mensaje de error es el mismo exista o no el usuario, para no revelar
 * quien esta dado de alta.
 */
const MAX_INTENTOS = 5;

const BLOQUEO_SEG = 900;

/*
 * Nombres sin importar acentos ni ñ: "Rough de plomeria" y "Rough de plomería" son la misma partida, y
 * "Bano" y "Baño" el mismo tipo. Los libros anteriores tienen los nombres sin acentos: siguen funcionando.
 * (Sin normalize(): una tabla explicita, igual en cualquier motor.)
 */
const SIN_ACENTOS_ = { 'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n','Á':'a','É':'e','Í':'i','Ó':'o','Ú':'u','Ü':'u','Ñ':'n' };

// la memoria del servidor acepta hasta 100 KB por valor: el Inicio se guarda en trozos
const CACHE_TROZO_ = 50000;

function secretoSesion_() {
  const pr = PropertiesService.getScriptProperties();
  let s = pr.getProperty('SECRETO_SESION');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('SECRETO_SESION', s); }
  return s;
}

function firmar_(texto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, secretoSesion_()));
}

function crearPase_(prefijo, usuario) {
  const cuerpo = Utilities.base64EncodeWebSafe(prefijo + '|' + usuario + '|' + (Date.now() + HORAS_SESION[prefijo] * 3600000));
  return cuerpo + '.' + firmar_(cuerpo);
}

function leerPase_(prefijo, token) {
  const t = String(token || ''), i = t.lastIndexOf('.');
  if (i < 1) return null;
  const cuerpo = t.slice(0, i);
  if (firmar_(cuerpo) !== t.slice(i + 1)) return null;
  let partes;
  try { partes = Utilities.newBlob(Utilities.base64DecodeWebSafe(cuerpo)).getDataAsString().split('|'); }
  catch (e) { return null; }
  if (partes.length < 3 || partes[0] !== prefijo || Number(partes[partes.length - 1]) < Date.now()) return null;
  return partes.slice(1, -1).join('|');
}

function auth_(token) {
  // pase firmado; o una sesion de antes del cambio, que sigue valida hasta vencer
  const usuario = leerPase_(PREFIJO_SESION_, token) || CacheService.getScriptCache().get(PREFIJO_SESION_ + token);
  if (!usuario || !usuarioActivo_(usuario)) throw new Error('Sesion expirada. Vuelve a entrar.');
  return usuario;
}

// comun/cronograma.js — El motor del cronograma: plan y previsión.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------------------ cronograma
/*
 * El cronograma se calcula, no se dibuja. Cada partida trae duracion (dias habiles), quien la
 * hace, si arranca junto con la anterior y los dias de espera antes (fabricacion del countertop,
 * del vidrio). Con eso y la fecha de inicio sale el PLAN; con lo que el PM reporta cada dia sale
 * la PREVISION: si algo se atrasa, todo lo que sigue se recorre y la entrega prevista se mueve
 * antes de que pase. Los espacios corren en paralelo; la ultima partida de Generales (limpieza
 * final) va despues de todos.
 */
function datosCrono_(c) {
  return { dias: Math.max(1, Number(c[5]) || 1), quien: String(c[6] || '').trim() || 'Cuadrilla',
           paralelo: String(c[7] || '').toUpperCase() === 'SI', espera: Math.max(0, Number(c[8]) || 0) };
}

function esSub_(quien) { return ['cuadrilla', 'pm', ''].indexOf(String(quien || '').trim().toLowerCase()) < 0; }

function hab0_(d) {                                   // mismo dia; si cae en fin de semana, el lunes
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
  return x;
}

function masHab_(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  let k = 0;
  while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) k++; }
  return x;
}

/** areas: [{id, nombre, generales, lista}] · real: {area|partida: {ini, fin}} · hoy: null = plan puro */
function calcularCrono_(inicio, areas, real, hoy) {
  const filas = [];
  const cadena = (ar, lista, arranque, todosParalelos) => {
    let base0 = arranque, finGrupo = null, fin = null;
    lista.forEach((c, i) => {
      const cr = datosCrono_(c);
      const paralelo = todosParalelos || (i > 0 && cr.paralelo);
      if (i > 0 && !paralelo) { base0 = masHab_(finGrupo, 1); finGrupo = null; }
      let ini = cr.espera ? masHab_(base0, cr.espera) : base0;
      fin = masHab_(ini, cr.dias - 1);
      const r = real[ar.id + '|' + c[2]];
      let estado = 'Sin iniciar';
      if (r && r.fin) { ini = hab0_(r.ini || r.fin); fin = hab0_(r.fin); estado = 'Terminada'; }
      else if (r && r.ini) { ini = hab0_(r.ini); fin = masHab_(ini, cr.dias - 1); if (hoy && fin < hoy) fin = hoy; estado = 'En progreso'; }
      else if (hoy && ini < hoy) { ini = hoy; fin = masHab_(ini, cr.dias - 1); }   // lo pendiente no arranca en el pasado
      finGrupo = (!finGrupo || fin > finGrupo) ? fin : finGrupo;
      filas.push({ area: ar.id, areaNombre: ar.nombre, partida: c[2], quien: cr.quien, dias: cr.dias,
                   espera: cr.espera, ini: ini, fin: fin, estado: estado });
    });
    return finGrupo;
  };
  let finEspacios = null;
  areas.filter(a => !a.generales).forEach(a => {
    const f = cadena(a, a.lista, inicio, false);
    if (f && (!finEspacios || f > finEspacios)) finEspacios = f;
  });
  areas.filter(a => a.generales).forEach(a => {
    if (!a.lista.length) return;
    const antes = a.lista.slice(0, -1), ultima = a.lista.slice(-1);
    const f = antes.length ? cadena(a, antes, inicio, true) : null;
    const tope = [finEspacios, f].filter(Boolean).sort((x, y) => y - x)[0];
    cadena(a, ultima, tope ? masHab_(tope, 1) : inicio, false);
  });
  const fin = filas.reduce((m, x) => (!m || x.fin > m) ? x.fin : m, null);
  return { filas: filas, fin: fin };
}

/*
 * Memoria dentro de una misma ejecucion: se reutiliza un calculo solo si los datos de los que depende son
 * EXACTAMENTE los mismos objetos que se leyeron. Si algo se escribio y se volvio a leer, son otros objetos y
 * se recalcula: la memoria nunca puede servir datos viejos.
 */
function memoPor_(clave, deps, calcular) {
  const m = _memo['__' + clave];
  if (m && m.deps.length === deps.length && m.deps.every((d, i) => d === deps[i])) return m.valor;
  const valor = calcular();
  _memo['__' + clave] = { deps: deps, valor: valor };
  return valor;
}

function realDeObra_(obraId) {
  return memoPor_('real|' + obraId, [datos_(SH.AVANCE), datos_(SH.AREAS)], function () {
  const real = {};
  datos_(SH.AVANCE).filter(r => r[2] === obraId).forEach(r => {
    const k = areaFila_('Avance', r, obraId, r[3]) + '|' + r[3];
    const x = real[k] || (real[k] = { ini: null, fin: null });
    const f = new Date(r[1]);
    if (!x.ini || f < x.ini) x.ini = f;
    if (r[4] === 'Terminada' && (!x.fin || f < x.fin)) x.fin = f;
  });
  return real;
  });
}

/** Plan y prevision de una obra: cada partida con sus fechas planeadas y previstas. */
function cronogramaObra_(obraId) {
  return memoPor_('crono|' + obraId, [datos_(SH.PROYECTOS), datos_(SH.AREAS), datos_(SH.AVANCE), datos_(SH.PARTIDAS), datos_(SH.PARTIDAS_OBRA)], function () {
  const p = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (!p || !p[6]) return null;
  const inicio = hab0_(new Date(p[6]));
  const areas = areasDe_(obraId).map(a => ({ id: a.id, nombre: a.nombre, generales: a.generales, lista: partidasDeArea_(a) }));
  const plan = calcularCrono_(inicio, areas, {}, null);
  const prev = calcularCrono_(inicio, areas, realDeObra_(obraId), hab0_(new Date()));
  prev.filas.forEach((f, i) => { f.planIni = plan.filas[i].ini; f.planFin = plan.filas[i].fin; });
  return { filas: prev.filas, planFin: plan.fin, prevFin: prev.fin };
  });
}

function ss_() {
  if (!_ss) _ss = SpreadsheetApp.openById(SS_ID);
  return _ss;
}

function hoja_(n) { return ss_().getSheetByName(n); }

/** Lee una hoja una sola vez por ejecucion y deja fuera lo anulado. */
function datos_(nombre) {
  if (_memo[nombre]) return _memo[nombre];
  const sh = hoja_(nombre);
  if (!sh) return (_memo[nombre] = []);            // hoja nueva que el libro todavia no tiene
  const v = sh.getDataRange().getValues();
  v.shift();
  let filas = v.filter(r => String(r[0]).trim() !== '');
  if (ANULABLE.hasOwnProperty(nombre)) {
    const col = ANULABLE[nombre];
    filas = filas.filter(r => String(r[col]) !== 'Anulado');
  }
  _memo[nombre] = filas;
  return filas;
}

function fecha_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  }
  return String(v);
}

// comun/errores.js — Registro de errores inesperados.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

// ------------------------------------------------------ registro de errores
/*
 * Los errores INESPERADOS (un TypeError, una falla de un servicio de Google, una cuota agotada) quedan
 * en la hoja Errores, y el administrador los ve en su app. Los mensajes de negocio ("Faltan: ...")
 * no se registran: son el sistema funcionando.
 */
function registrarError_(nombre, e, args) {
  try {
    if (!e || e.__registrado) return;
    const msg = String(e.message || e);
    const inesperado = e.name !== 'Error' || /Exception|Service|quota|timed out|timeout|Lock|limit/i.test(msg);
    if (!inesperado) return;
    e.__registrado = true;
    let sh = hoja_('Errores');
    if (!sh) { sh = ss_().insertSheet('Errores'); sh.appendRow(['fecha', 'app', 'funcion', 'usuario', 'mensaje', 'detalle']); }
    let quien = '';
    try { quien = args && args[0] ? auth_(args[0]) : ''; } catch (x) { quien = ''; }
    sh.appendRow([new Date(), APP_NOMBRE_, nombre, quien, msg.slice(0, 500), String(e.stack || '').slice(0, 1500)]);
    if (sh.getLastRow() > 1000) sh.deleteRows(2, 200);                  // se conservan los recientes
  } catch (x) { /* registrar nunca debe romper la respuesta */ }
}

function conRegistro_(nombre, fn) {
  return function () {
    try { return fn.apply(this, arguments); } catch (e) { registrarError_(nombre, e, arguments); throw e; }
  };
}

/** Envuelve cada funcion publica (du* / pm*) para que sus errores inesperados queden registrados. */
function envolverPublicas_(prefijo) {
  const g = (function () { return this; })() || globalThis;
  Object.keys(g).filter(k => k.indexOf(prefijo) === 0 && /^[a-z]{2}[A-Z]/.test(k) && typeof g[k] === 'function' && !g[k].__envuelta)
    .forEach(k => { const w = conRegistro_(k, g[k]); w.__envuelta = true; g[k] = w; });
}

// comun/obra.js — Espacios, partidas y avance de cada obra.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

function areasDe_(obraId) {
  return datos_('Areas').filter(a => a[1] === obraId)
    .sort((a, b) => (Number(a[6]) || 0) - (Number(b[6]) || 0))
    .map(a => ({ id: a[0], obra: a[1], tipo: a[2], nombre: a[3],
                 pies2: Number(a[4]) || 0, lineales: Number(a[5]) || 0,
                 generales: a[2] === 'Generales' }));
}

/** Deduce el area de una partida cuando el registro es anterior a las areas. */
function areaPorPartida_(obraId, partida) {
  const areas = areasDe_(obraId);
  if (!areas.length) return '';
  const cat = datos_('Partidas_Catalogo');
  const gen = areas.find(x => x.generales);
  if (gen && cat.some(c => c[0] === 'Generales' && c[2] === partida)) return gen.id;
  const esp = areas.find(x => !x.generales && cat.some(c => c[0] === x.tipo && c[2] === partida));
  if (esp) return esp.id;
  const primera = areas.find(x => !x.generales);
  return (primera || gen).id;
}

/** Area de una fila: la guardada o, si falta, la deducida. */
function areaFila_(hoja, fila, obraId, partida) {
  const a = fila[COL_AREA[hoja]];
  return a ? a : areaPorPartida_(obraId, partida);
}

/** Parte una clave "AR-0002|Tile de piso y muro" en {area, partida}. */
function partirClave_(clave, obraId) {
  const s = String(clave || '');
  const i = s.indexOf('|');
  if (i < 0) return { area: s ? areaPorPartida_(obraId, s) : '', partida: s };
  return { area: s.slice(0, i), partida: s.slice(i + 1) };
}

// ------------------------------------------------------------ avance ponderado
/*
 * Cada partida pesa segun su complejidad (columna "peso" del catalogo), no
 * segun cuantas son: "Proteccion" y "Tile de piso y muro" no valen lo mismo.
 *
 * Solo cuentan las TERMINADAS. Una partida a medias no es avance que se le
 * pueda mostrar al cliente ni cobrarle; las que van en curso se reportan
 * aparte, como la parte clara de la barra.
 *
 * Los pesos son de esfuerzo, no de dinero: por eso el PM ve el mismo
 * porcentaje sin que se rompa la muralla financiera.
 */
function pesoDe_(filaCatalogo) {
  const p = Number(filaCatalogo && filaCatalogo[4]);
  return p > 0 ? p : 1;
}

function avanceDe_(partidas) {
  const total = partidas.reduce((a, p) => a + (p.peso || 0), 0);
  if (!total) return { pct: 0, curso: 0 };
  const hecho = partidas.filter(p => p.estado === 'Terminada').reduce((a, p) => a + p.peso, 0);
  const curso = partidas.filter(p => p.estado === 'En progreso').reduce((a, p) => a + p.peso, 0);
  return { pct: hecho / total, curso: curso / total };
}

/*
 * Partidas propias de cada espacio. Al crearse, el espacio copia las del catalogo; asi,
 * editar el catalogo solo afecta obras nuevas, y a una obra se le puede quitar o agregar
 * una partida (un bano sin puerta de vidrio). Los espacios anteriores a este cambio, sin
 * copia, siguen leyendo el catalogo.
 */
function partidasDeArea_(ar, cat) {
  const propias = datos_(SH.PARTIDAS_OBRA).filter(r => r[0] === ar.id);
  if (propias.length) {
    return propias.filter(r => String(r[6]) !== 'Quitada')
      .map(r => [ar.tipo, Number(r[2]) || 0, r[3], r[4] || '', Number(r[5]) || 1, r[7], r[8], r[9], r[10], r[11]])
      .sort((a, b) => a[1] - b[1]);
  }
  return (cat || datos_(SH.PARTIDAS)).filter(c => c[0] === ar.tipo).sort((a, b) => a[1] - b[1]);
}

function datosTodos_(nombre) {
  const v = hoja_(nombre).getDataRange().getValues();
  v.shift();
  return v.filter(r => String(r[0]).trim() !== '');
}

function config_() {
  const c = CacheService.getScriptCache().get('cfg');
  if (c) return JSON.parse(c);
  const o = {};
  datos_(SH.CONFIG).forEach(r => { o[r[0]] = r[1]; });
  CacheService.getScriptCache().put('cfg', JSON.stringify(o), 600);
  return o;
}

function buscarFila_(hoja, id) {
  const v = hoja_(hoja).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === id) return { fila: i + 1, datos: v[i] };
  throw new Error('No se encontro ' + id + ' en ' + hoja + '.');
}

function obraCerrada_(obraId) {
  return datos_('Obras_Cerradas').some(r => r[1] === obraId);
}

function bitacoraCorreccion_(email, hoja, id, accion, campo, antes, despues, motivo) {
  // ID por sello de tiempo: esta hoja la escriben las dos apps, y el candado
  // no cruza entre proyectos de Apps Script distintos.
  hoja_('Correcciones').appendRow(['COR-' + sello_(), new Date(), email, hoja, id,
                accion, campo || '', String(antes === undefined ? '' : antes),
                String(despues === undefined ? '' : despues), motivo]);
}

/** Valida y aplica. limiteHoras = 0 significa sin limite (dueno). */
function aplicarCorreccion_(email, hoja, id, cambios, motivo, limiteHoras, soloPropios) {
  if (!motivo || motivo.length < 5) throw new Error('Escribe el motivo de la correccion.');
  if (!ANULABLE.hasOwnProperty(hoja)) throw new Error('Esa hoja no admite correcciones.');
  const r = buscarFila_(hoja, id);
  const m = META[hoja];

  if (soloPropios && String(r.datos[m.usuario]).toLowerCase() !== email) {
    throw new Error('Ese registro lo capturo otra persona. Pidele al administrador que lo corrija.');
  }
  if (limiteHoras) {
    const h = (new Date() - r.datos[m.fecha]) / 3600000;
    if (h > limiteHoras) {
      throw new Error('Ese registro tiene mas de ' + limiteHoras + ' horas. ' +
        'Pidele al administrador que lo corrija.');
    }
  }
  if (obraCerrada_(r.datos[m.obra])) {
    throw new Error('Esa obra ya esta cerrada. Su historico no se puede cambiar.');
  }
  if (String(r.datos[ANULABLE[hoja]]) === 'Anulado') {
    throw new Error('Ese registro ya esta anulado.');
  }

  const sh = hoja_(hoja);
  const campos = EDITABLE[hoja] || {};
  let n = 0;
  Object.keys(cambios || {}).forEach(k => {
    if (!campos[k]) return;
    const col = campos[k];
    const antes = r.datos[col - 1];
    let despues = (k === 'monto' || k === 'horas') ? Number(cambios[k]) || 0 : cambios[k];
    // una partida puede venir como "AR-0002|Tile": mover tambien el area
    if (k === 'partida' && String(despues).indexOf('|') >= 0 && COL_AREA[hoja] !== undefined) {
      const i = String(despues).indexOf('|');
      const areaNueva = String(despues).slice(0, i);
      despues = String(despues).slice(i + 1);
      const areaAntes = r.datos[COL_AREA[hoja]];
      if (areaNueva && areaNueva !== areaAntes) {
        sh.getRange(r.fila, COL_AREA[hoja] + 1).setValue(areaNueva);
        bitacoraCorreccion_(email, hoja, id, 'Editar', 'area_id', areaAntes, areaNueva, motivo);
        n++;
      }
    }
    if (String(antes) === String(despues)) return;
    sh.getRange(r.fila, col).setValue(despues);
    bitacoraCorreccion_(email, hoja, id, 'Editar', k, antes, despues, motivo);
    n++;
  });
  if (!n) throw new Error('No cambiaste ningun valor.');
  return { ok: true, cambios: n };
}

function aplicarAnulacion_(email, hoja, id, motivo, limiteHoras, soloPropios) {
  if (!motivo || motivo.length < 5) throw new Error('Escribe el motivo de la anulacion.');
  if (!ANULABLE.hasOwnProperty(hoja)) throw new Error('Esa hoja no admite anulaciones.');
  const r = buscarFila_(hoja, id);
  const m = META[hoja];

  if (soloPropios && String(r.datos[m.usuario]).toLowerCase() !== email) {
    throw new Error('Ese registro lo capturo otra persona. Pidele al administrador que lo anule.');
  }
  if (limiteHoras) {
    const h = (new Date() - r.datos[m.fecha]) / 3600000;
    if (h > limiteHoras) {
      throw new Error('Ese registro tiene mas de ' + limiteHoras + ' horas. ' +
        'Pidele al administrador que lo anule.');
    }
  }
  if (obraCerrada_(r.datos[m.obra])) {
    throw new Error('Esa obra ya esta cerrada. Su historico no se puede cambiar.');
  }
  if (String(r.datos[ANULABLE[hoja]]) === 'Anulado') return { ok: true, yaEstaba: true };

  hoja_(hoja).getRange(r.fila, ANULABLE[hoja] + 1).setValue('Anulado');
  bitacoraCorreccion_(email, hoja, id, 'Anular', '', 'Vigente', 'Anulado', motivo);

  // un pago anulado devuelve la orden a Aprobada
  if (hoja === 'Pagos_Sub') {
    try {
      const ot = buscarFila_('Ordenes_Trabajo', r.datos[2]);
      if (ot.datos[8] === 'Pagada') hoja_('Ordenes_Trabajo').getRange(ot.fila, 9).setValue('Aprobada');
    } catch (e) {}
  }
  return { ok: true };
}

/** Etiqueta del proyecto a partir de sus areas: "Baño + Closet". */
function etiquetaTipo_(obraId) {
  const t = areasDe_(obraId).filter(a => !a.generales).map(a => a.tipo)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return t.length ? t.join(' + ') : 'Sin areas';
}

// ----------------------------------------------------------- datos en vivo
/*
 * Apps Script no puede empujarle datos al navegador: la app tiene que preguntar.
 * Para que preguntar sea barato, cada registro marca una sola celda de Config
 * (ULTIMO_CAMBIO). Cada app pregunta cada 30 s por esa celda y solo si cambio
 * descarga los datos completos. La celda vive en el libro porque las dos apps
 * son proyectos distintos y no comparten cache.
 *
 * Se marca DESPUES de escribir: si se marcara antes, la otra app podria ver el
 * aviso, descargar los datos todavia viejos y quedarse con ellos.
 */
function filaSello_() {
  const sh = hoja_(SH.CONFIG);
  const v = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues();
  for (let i = 0; i < v.length; i++) if (v[i][0] === 'ULTIMO_CAMBIO') return i + 1;
  sh.appendRow(['ULTIMO_CAMBIO', '', 'Lo actualiza el sistema en cada registro. No se edita a mano.']);
  return sh.getLastRow();
}

function selloActual_() {
  return String(hoja_(SH.CONFIG).getRange(filaSello_(), 2).getValue() || '');
}

function marcarCambio_() {
  try {
    // con letras, para que Sheets nunca lo convierta en numero y pierda digitos
    hoja_(SH.CONFIG).getRange(filaSello_(), 2)
      .setValue(Date.now() + '-' + Utilities.getUuid().slice(0, 4));
  } catch (e) { /* nunca bloquea el registro que ya se guardo */ }
}

/** Sello de tiempo para nombrar fotos antes de tener el ID. */
function sello_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') +
         '-' + Utilities.getUuid().slice(0, 4);
}

/*
 * Rol del administrador. Se acepta "admin" o "administrador", y tambien "dueno"
 * para que las hojas creadas antes de este cambio sigan entrando sin tocar nada.
 */
function esAdmin_(rol) {
  return ['admin', 'administrador', 'dueno'].indexOf(sinAcentos_(rol)) >= 0;      // "dueño" con ñ tambien
}

// ------------------------------------------------------------------- idioma
/*
 * Cada persona guarda su idioma en la columna "idioma" de Usuarios, asi la sigue en
 * cualquier telefono (el almacenamiento del navegador a veces lo bloquea Safari).
 * Las pantallas se traducen en el navegador; aqui solo se traduce lo que genera el
 * servidor: el texto de la orden de cambio y los correos de aviso.
 */
function guardarIdioma_(usuario, lang) {
  const l = lang === 'en' ? 'en' : 'es';
  const sh = hoja_(SH.USUARIOS);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === usuario) {
      if (v[0].length < 9 || String(v[0][8] || '') === '') sh.getRange(1, 9).setValue('idioma');
      sh.getRange(i + 1, 9).setValue(l);
      return { ok: true, idioma: l };
    }
  }
  return { ok: false };
}

function idiomaAdmin_() {
  const d = datos_(SH.USUARIOS).find(r => esAdmin_(r[3]) && String(r[6]).toUpperCase() === 'SI');
  return d && String(d[8] || '').toLowerCase() === 'en' ? 'en' : 'es';
}

function usuarioActivo_(usuario) {
  return datos_(SH.USUARIOS).some(r => String(r[0]).trim().toLowerCase() === usuario && String(r[6]).toUpperCase() === 'SI');
}

function intentarAcceso_(usuario, pin, rolRequerido, prefijo, msgRol) {
  usuario = String(usuario || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const clave = 'int_' + prefijo + usuario;
  const fallos = Number(cache.get(clave)) || 0;
  if (fallos >= MAX_INTENTOS) {
    return { ok: false, bloqueado: true,
      msg: 'Demasiados intentos. Esta cuenta queda bloqueada 15 minutos.' };
  }
  const u = datos_(SH.USUARIOS).find(r =>
    String(r[0]).trim().toLowerCase() === usuario &&
    String(r[1]).trim() === String(pin || '').trim() &&
    String(r[6]).toUpperCase() === 'SI');
  if (!u) {
    cache.put(clave, String(fallos + 1), BLOQUEO_SEG);
    const quedan = MAX_INTENTOS - fallos - 1;
    return { ok: false, msg: 'Usuario o PIN incorrectos.' +
      (quedan > 0 && quedan <= 2
        ? ' Te queda' + (quedan > 1 ? 'n ' : ' ') + quedan + ' intento' + (quedan > 1 ? 's' : '') + '.' : '') };
  }
  cache.remove(clave);
  const rolOk = rolRequerido === 'admin' ? esAdmin_(u[3]) : String(u[3]).trim().toLowerCase() === rolRequerido;
  if (!rolOk) return { ok: false, msg: msgRol };
  const token = crearPase_(prefijo, usuario);
  return { ok: true, token: token, nombre: u[2], idioma: String(u[8] || '').toLowerCase() };
}

/** Correo a donde llegan los avisos del dueno. Vacio si no hay uno valido. */
function correoDueno_() {
  const d = datos_(SH.USUARIOS).find(r => esAdmin_(r[3]) &&
                                        String(r[6]).toUpperCase() === 'SI');
  if (!d) return '';
  const avisos = String(d[7] || '').trim();
  if (avisos.indexOf('@') > 0) return avisos;
  const usuario = String(d[0] || '').trim();
  return usuario.indexOf('@') > 0 ? usuario : '';
}

function sinAcentos_(s) {
  return String(s == null ? '' : s).replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, c => SIN_ACENTOS_[c]).toLowerCase().trim();
}

function esBano_(tipo) { return sinAcentos_(tipo) === 'bano'; }

function enLista_(lista, valor) { const k = sinAcentos_(valor); return lista.some(x => sinAcentos_(x) === k); }

function porNombre_(mapa, clave) {
  if (!mapa) return undefined;
  if (Object.prototype.hasOwnProperty.call(mapa, clave)) return mapa[clave];
  const k = sinAcentos_(clave);
  for (const x in mapa) if (sinAcentos_(x) === k) return mapa[x];
  return undefined;
}

// comun/validaciones.js — Datos obligatorios, horas de cuadrilla y numeración de registros.
// Compartido por las dos apps. Edita aquí y corre construir.py: nunca edites App_Dueno.gs ni App_PM.gs.

/*
 * Un trabajador por dia se registra como dia completo o medio dia, y la suma de todas las
 * obras en la misma fecha no puede pasar de un dia (ni de 16 horas si cobra por hora).
 * Sin esto, anotarlo completo en las dos obras de un PM lo cobraba doble.
 * excluirId: al corregir, el registro que se esta cambiando no cuenta contra si mismo.
 */
function validarHoras_(trabajadorId, fecha, horasNuevas, excluirId) {
  const t = datos_(SH.TRABAJADORES).find(x => x[0] === trabajadorId);
  if (!t) return;
  const porDia = String(t[3]) === 'Por dia';
  const h = Number(horasNuevas) || 0;
  if (porDia && h !== 0.5 && h !== 1) {
    throw new Error(t[1] + ' cobra por dia: se registra como dia completo o medio dia.');
  }
  const dia = fecha_(fecha);
  const previos = datos_(SH.MANO_OBRA).filter(r => r[3] === trabajadorId && r[0] !== excluirId && fecha_(r[1]) === dia);
  const ya = previos.reduce((a, r) => a + (Number(r[5]) || 0), 0);
  const obras = previos.map(r => r[2]).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  if (porDia && ya + h > 1) {
    throw new Error(t[1] + ' ya tiene ' + (ya === 1 ? 'un dia completo' : 'medio dia') + ' registrado el ' + dia +
      (obras ? ' en ' + obras : '') + '. Un trabajador por dia no puede pasar de un dia sumando todas las obras.');
  }
  if (!porDia && ya + h > 16) {
    throw new Error(t[1] + ' ya tiene ' + ya + ' h registradas el ' + dia + (obras ? ' en ' + obras : '') +
      '; con estas serian ' + (ya + h) + ' h. El maximo es 16 al dia.');
  }
}

function validarCuadrilla_(lista, fecha) {
  const suma = {};                                    // el mismo trabajador dos veces en la misma captura
  (lista || []).forEach(t => {
    if (!t.trabajador || !(Number(t.horas) > 0)) return;
    suma[t.trabajador] = (suma[t.trabajador] || 0) + Number(t.horas);
  });
  Object.keys(suma).forEach(id => validarHoras_(id, fecha, suma[id], null));
}

/** Junta TODOS los datos que faltan en un solo mensaje: "Faltan: cliente, fecha de entrega." */
function exigir_(pares) {
  const faltan = pares.filter(x => x[0] === undefined || x[0] === null || String(x[0]).trim() === '').map(x => x[1]);
  if (faltan.length) throw new Error('Faltan: ' + faltan.join(', ') + '.');
}

/*
 * El numero mas alto de la columna A (PRE-0012 -> 12). NO se lee el ultimo renglon: en Google Sheets
 * el ultimo renglon incluye notas sin ID (como las que trae la plantilla debajo de los ejemplos), y
 * leerlo reiniciaba la numeracion en 1 y repetia IDs existentes.
 */
function maxNum_(sh, ultima) {
  const ult = ultima === undefined ? sh.getLastRow() : ultima;      // quien ya la conoce, la pasa: una consulta menos
  if (ult < 2) return 0;
  let n = 0;
  sh.getRange(1, 1, ult, 1).getValues().forEach(r => {
    const m = String(r[0]).trim().match(/^[A-Z]+-(\d+)$/);
    if (m) n = Math.max(n, parseInt(m[1], 10));
  });
  return n;
}

// admin/servidor.js
// Solo de la app del administrador. Lo compartido está en comun/. Después de editar, corre construir.py.

// ---------------------------------------------------------------- utilidades

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dueno')
    .setTitle('IJM - Control de Obra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Siguiente ID leyendo solo la ultima celda, no la hoja entera. */
function nuevoId_(nombre, prefijo, largo) {
  // el numero mas alto se lee una vez por viaje; los siguientes se cuentan en memoria (siempre dentro del candado)
  const k = '__max|' + nombre;
  if (!(k in _memo)) _memo[k] = { n: maxNum_(hoja_(nombre)) };
  _memo[k].n++;
  return prefijo + '-' + String(_memo[k].n).padStart(largo || 4, '0');
}

function dias_(v) {
  if (!v || Object.prototype.toString.call(v) !== '[object Date]') return null;
  return Math.floor((new Date() - v) / 86400000);
}

function fila_(nombre, id) {
  const v = hoja_(nombre).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === id) return i + 1;
  throw new Error('No se encontro ' + id + ' en ' + nombre);
}

/** Mapa trabajador_id -> tarifa. La tarifa vive solo en esta app. */
function tarifas_() {
  const m = {};
  datos_(SH.TRABAJADORES).forEach(t => {
    m[t[0]] = { tarifa: Number(t[4]) || 0, nombre: t[1], puesto: t[2], porDia: String(t[3]) === 'Por dia' };
  });
  return m;
}

/** Costo de cuadrilla propia: horas (o dias) por tarifa. */
function costoMO_(filas, tar) {
  return filas.reduce((a, r) => a + (Number(r[5]) || 0) * ((tar[r[3]] || {}).tarifa || 0), 0);
}

/** Avance ponderado de una obra, total y por area. */
function avanceObra_(obraId) {
  const cat = datos_(SH.PARTIDAS);
  const av = datos_(SH.AVANCE).filter(r => r[2] === obraId)
    .map(r => ({ fila: r, area: areaFila_('Avance', r, obraId, r[3]) }));
  const todas = [], porArea = [];
  areasDe_(obraId).forEach(ar => {
    const ps = partidasDeArea_(ar, cat).map(c => {
      const regs = av.filter(x => x.area === ar.id && x.fila[3] === c[2]).map(x => x.fila);
      const estado = regs.some(a => a[4] === 'Terminada') ? 'Terminada'
                   : (regs.some(a => a[4] === 'En progreso') ? 'En progreso' : 'Sin iniciar');
      return { peso: pesoDe_(c), estado: estado };
    });
    const a = avanceDe_(ps);
    porArea.push({ nombre: ar.nombre, generales: ar.generales, pct: a.pct, curso: a.curso });
    ps.forEach(x => todas.push(x));
  });
  const t = avanceDe_(todas);
  return { pct: t.pct, curso: t.curso, porArea: porArea };
}

// ------------------------------------------------------ candado de escritura
/*
 * Evita IDs duplicados. Sin esto, dos PMs cerrando el dia en el mismo segundo
 * leen el mismo ultimo ID y guardan dos registros con el mismo numero.
 *
 * Dos detalles que hacen que funcione:
 *  1. SpreadsheetApp.flush() ANTES de soltar el candado. Apps Script junta las
 *     escrituras y las manda despues; sin flush, la siguiente ejecucion puede
 *     leer la hoja antes de que llegue la fila y sacar el mismo ID.
 *  2. Las fotos se suben FUERA del candado. Subir seis fotos tarda 10 a 20 s;
 *     si se hace adentro, todos los demas se quedan esperando.
 */
function conCandado_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('El sistema esta ocupado con otra captura. Intenta de nuevo en unos segundos.');
  }
  try {
    const r = fn();
    SpreadsheetApp.flush();
    marcarCambio_();                 // ya guardado: ahora si se avisa
    return r;
  } finally {
    lock.releaseLock();
  }
}

/*
 * Una fecha capturada ("2026-10-30") se interpreta al mediodia LOCAL. new Date("2026-10-30") la toma
 * como medianoche en Londres, que en Austin es el dia anterior a las 7 pm: toda fecha del alta de obra
 * y de las ordenes de trabajo se guardaba un dia antes.
 */
function fechaLocal_(s) {
  if (s instanceof Date) return s;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? new Date(s + 'T12:00:00') : new Date(s);
}

// ------------------------------------------------------ cronograma: esta semana, PPC y propuestas
/** Subs a programar (proximos 5 dias habiles, sin orden), confirmaciones faltantes y choques. */
function estaSemana_(obrasActivas, ots, subs) {
  const hoy = hab0_(new Date()), tope = masHab_(hoy, 5), en2 = masHab_(hoy, 2);
  const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const vivas = ots.filter(o => ['Cancelada', 'Pagada'].indexOf(o[8]) < 0);
  const porProgramar = [];
  obrasActivas.forEach(r => {
    const cr = cronogramaObra_(r[0]);
    if (!cr) return;
    cr.filas.filter(f => esSub_(f.quien) && f.estado !== 'Terminada' && f.ini <= tope).forEach(f => {
      if (vivas.some(o => o[1] === r[0] && o[13] === f.partida && (o[14] || f.area) === f.area)) return;
      const sub = subs.find(s => String(s[5]).toUpperCase() === 'SI' && (norm(s[2]).indexOf(norm(f.quien)) >= 0 || norm(f.quien).indexOf(norm(s[2])) >= 0));
      porProgramar.push({ obra: r[0], cliente: r[1], areaId: f.area, areaNombre: f.areaNombre, partida: f.partida, quien: f.quien,
        inicio: fecha_(f.ini), fin: fecha_(f.fin), iniISO: Utilities.formatDate(f.ini, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        finISO: Utilities.formatDate(f.fin, Session.getScriptTimeZone(), 'yyyy-MM-dd'), sub: sub ? sub[0] : '' });
    });
  });
  porProgramar.sort((a, b) => a.iniISO < b.iniISO ? -1 : 1);
  const nombreSub = id => (subs.find(s => s[0] === id) || [])[1] || id;
  const sinConfirmar = vivas.filter(o => o[8] === 'Emitida' && o[6] && hab0_(new Date(o[6])) >= hoy && hab0_(new Date(o[6])) <= en2)
    .map(o => ({ ot: o[0], obra: o[1], sub: nombreSub(o[2]), inicio: fecha_(o[6]), partida: o[13] || '' }));
  // el mismo sub en dos obras con fechas que se enciman
  const choques = [], activas = vivas.filter(o => ['Emitida', 'Confirmada'].indexOf(o[8]) >= 0 && o[6] && hab0_(new Date(o[7] || o[6])) >= hoy);
  activas.forEach((a, i) => activas.slice(i + 1).forEach(b => {
    if (a[2] !== b[2] || a[1] === b[1]) return;
    const ini = new Date(Math.max(new Date(a[6]), new Date(b[6]))), fin = new Date(Math.min(new Date(a[7] || a[6]), new Date(b[7] || b[6])));
    if (hab0_(ini) <= hab0_(fin)) choques.push({ sub: nombreSub(a[2]), obras: a[1] + ' y ' + b[1], dia: fecha_(ini) });
  }));
  return { porProgramar: porProgramar, sinConfirmar: sinConfirmar, choques: choques };
}

/*
 * Cumplimiento semanal del plan (PPC). El lunes —o la primera vez que abres la app en la semana—
 * se congela lo que estaba previsto terminar esa semana. La semana siguiente se compara contra
 * lo que de verdad se termino. No hay que capturar nada: sale de los cierres de dia.
 */
function lunes_(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

function hojaPlanSemanal_() {
  let sh = hoja_(SH.PLAN_SEMANAL);
  if (!sh) { sh = ss_().insertSheet(SH.PLAN_SEMANAL); sh.appendRow(['semana', 'proyecto_id', 'area_id', 'partida', 'fin_previsto']); }
  return sh;
}

function congelarSemana_(obrasActivas) {
  const lun = lunes_(new Date()), vie = masHab_(lun, 4), clave = fecha_(lun);
  if (datos_(SH.PLAN_SEMANAL).some(r => fecha_(r[0]) === clave)) return;
  const filas = [];
  obrasActivas.forEach(r => {
    const cr = cronogramaObra_(r[0]);
    if (cr) cr.filas.filter(f => f.fin >= lun && f.fin <= vie && !(f.estado === 'Terminada' && f.fin < hab0_(new Date())))
      .forEach(f => filas.push([lun, r[0], f.area, f.partida, f.fin]));
  });
  if (!filas.length) return;
  const sh = hojaPlanSemanal_();
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, 5).setValues(filas);
  delete _memo[SH.PLAN_SEMANAL];
}

function ppcSemanaPasada_(obraId) {
  const lun = lunes_(new Date()); lun.setDate(lun.getDate() - 7);
  const vie = masHab_(lun, 4), clave = fecha_(lun);
  const plan = datos_(SH.PLAN_SEMANAL).filter(r => fecha_(r[0]) === clave && (!obraId || r[1] === obraId));
  if (!plan.length) return null;
  const hecho = plan.filter(r => { const x = realDeObra_(r[1])[r[2] + '|' + r[3]]; return x && x.fin && hab0_(x.fin) <= vie; }).length;
  return { plan: plan.length, hecho: hecho, ppc: hecho / plan.length };
}

/** Al dar de alta: la fecha de entrega que sale de las plantillas de los espacios elegidos. */
function duProponerEntrega(token, inicio, tipos) {
  auth_(token);
  if (!inicio) return null;
  const cat = datos_(SH.PARTIDAS);
  const lista = t => cat.filter(c => c[0] === t).sort((a, b) => a[1] - b[1]);
  const areas = (tipos || []).filter(Boolean).map((t, i) => ({ id: 'A' + i, nombre: t, generales: false, lista: lista(t) }))
    .concat([{ id: 'G', nombre: 'Generales', generales: true, lista: lista('Generales') }]);
  const ini = hab0_(new Date(inicio + 'T12:00:00'));
  const r = calcularCrono_(ini, areas, {}, null);
  if (!r.fin) return null;
  return { fecha: Utilities.formatDate(r.fin, Session.getScriptTimeZone(), 'yyyy-MM-dd'), dias: habilesEntre_(ini, r.fin) + 1 };
}

function duSugerirDuraciones(token) {
  auth_(token);
  let n = 0;
  [[SH.PARTIDAS, 2, 6], [SH.PARTIDAS_OBRA, 3, 8]].forEach(([hoja, colP, colD]) => {
    const sh = hoja === SH.PARTIDAS_OBRA ? hojaPartidasObra_() : hoja_(hoja);
    const v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      const s = porNombre_(CRONO_SUGERIDO, v[i][colP]);
      if (s && !(Number(v[i][colD - 1]) > 0)) { sh.getRange(i + 1, colD, 1, 4).setValues([s]); n++; }
    }
  });
  // etapas, una por tipo de trabajo. Se llenan las vacias y se cambian las de la agrupacion anterior (por fase)
  // que nadie modifico. Lo que capturaste tu no se toca, ni las obras que ya tienen presupuesto guardado:
  // cambiarles la agrupacion dejaria montos huerfanos.
  const tipoArea = {}, obraArea = {}, conPresupuesto = {};
  datos_(SH.AREAS).forEach(a => { tipoArea[a[0]] = a[2]; obraArea[a[0]] = a[1]; });
  datos_(SH.PRESUPUESTO).forEach(x => { conPresupuesto[x[1]] = true; });
  [[SH.PARTIDAS, r => r[0], 2, 10, () => true], [SH.PARTIDAS_OBRA, r => tipoArea[r[0]], 3, 12, r => !conPresupuesto[obraArea[r[0]]]]]
    .forEach(([hoja, tipoDe, colP, colE, puede]) => {
      const sh = hoja === SH.PARTIDAS_OBRA ? hojaPartidasObra_() : hoja_(hoja);
      const v = sh.getDataRange().getValues();
      for (let i = 1; i < v.length; i++) {
        const tipo = tipoDe(v[i]), partida = v[i][colP], actual = String(v[i][colE - 1] || '').trim();
        const e = porNombre_(porNombre_(ETAPA_SUGERIDA, tipo) || {}, partida);
        const sinTocar = !actual || actual === porNombre_(porNombre_(ETAPA_POR_FASE_, tipo) || {}, partida);
        if (e && sinTocar && actual !== e && puede(v[i])) { sh.getRange(i + 1, colE).setValue(e); n++; }
      }
    });
  marcarCambio_();
  return { ok: true, n: n };
}

// ------------------------------------------------------ dia olvidado, registrado por el administrador
/*
 * Respaldo para dias mas viejos que la ventana del PM (2 dias habiles). Queda marcado "tarde",
 * con motivo obligatorio y su rastro en Correcciones. Sin fotos: esas las tiene el PM.
 */
function duCierreTardio(token, obraId, p) {
  const email = auth_(token);
  if (obraCerrada_(obraId)) throw new Error('Esa obra ya esta cerrada.');
  if (!String(p.motivo || '').trim()) throw new Error('Escribe por que lo registras tu y no el PM.');
  if (!p.fecha) throw new Error('Elige el dia.');
  const dia = fechaLocal_(p.fecha); dia.setHours(16);
  if (fecha_(dia) === fecha_(new Date()) || dia > new Date()) throw new Error('Solo dias anteriores a hoy.');
  const pr = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (pr && pr[6] && fecha_(dia) !== fecha_(pr[6]) && dia < new Date(pr[6])) throw new Error('Ese dia es antes del inicio de la obra.');
  if (datos_(SH.BITACORA).some(x => x[2] === obraId && fecha_(x[1]) === fecha_(dia))) throw new Error('Ese dia ya tiene cierre en esta obra.');
  const partidas = p.partidas || [], terminadas = p.terminadas || [];
  if (!partidas.length) throw new Error('Marca en que partida se trabajo ese dia.');
  // una partida con punto de control no se termina sin su inspeccion aprobada, igual que en el campo
  const cal = datos_(SH.CALIDAD).filter(c => c[2] === obraId);
  terminadas.forEach(key => {
    const k = partirClave_(key, obraId), ar = areasDe_(obraId).find(a => a.id === k.area);
    const def = ar ? partidasDeArea_(ar).find(c => c[2] === k.partida) : null;
    if (!def || !def[3]) return;
    const ult = cal.filter(c => c[3] === def[3] && (c[12] || k.area) === k.area).slice(-1)[0];
    if (!ult || ult[5] !== 'Aprobado') throw new Error('Antes de terminar "' + k.partida + '" hay que aprobar la inspeccion ' + def[3] + '.');
  });
  validarCuadrilla_(p.cuadrilla, dia);
  const id = conCandado_(function () {
    // prefijos propios: el PM escribe BIT/AV/MO, y el candado de cada app no cruza a la otra
    const nuevo = nuevoId_(SH.BITACORA, 'BIA', 4);
    hoja_(SH.BITACORA).appendRow([nuevo, dia, obraId, email, partidas.map(k => partirClave_(k, obraId).partida).join('; '), '',
      'Registrado por el administrador: ' + p.motivo, '', new Date(), 'Vigente', 'SI']);
    partidas.forEach(key => {
      const k = partirClave_(key, obraId);
      hoja_(SH.AVANCE).appendRow([nuevoId_(SH.AVANCE, 'AVA', 4), dia, obraId, k.partida,
        terminadas.indexOf(key) >= 0 ? 'Terminada' : 'En progreso', email, new Date(), 'Vigente', k.area]);
    });
    (p.cuadrilla || []).filter(t => t.trabajador && Number(t.horas) > 0).forEach(t => {
      const k = partirClave_(t.partida || partidas[0], obraId);
      hoja_(SH.MANO_OBRA).appendRow([nuevoId_(SH.MANO_OBRA, 'MOA', 4), dia, obraId, t.trabajador, k.partida,
        Number(t.horas), email, new Date(), 'Vigente', k.area]);
    });
    return nuevo;
  });
  bitacoraCorreccion_(email, 'Bitacora', id, 'Dia olvidado', 'fecha', '', fecha_(dia), p.motivo);
  return { ok: true, id: id };
}

function etapaDeFila_(c) { return String(c[9] || '').trim() || SIN_ETAPA; }

/** Las etapas de un espacio, en orden de trabajo, con sus partidas. */
function etapasDeArea_(ar, cat) {
  const out = [];
  partidasDeArea_(ar, cat).forEach(c => {
    const e = etapaDeFila_(c);
    let x = out.find(y => y.etapa === e);
    if (!x) { x = { etapa: e, partidas: [] }; out.push(x); }
    x.partidas.push(c[2]);
  });
  return out;
}

/** area|partida -> etapa, para toda una obra */
function mapaEtapas_(obraId, cat) {
  const m = {};
  areasDe_(obraId).forEach(ar => etapasDeArea_(ar, cat).forEach(e => e.partidas.forEach(pp => { m[ar.id + '|' + pp] = e.etapa; })));
  return m;
}

/** Presupuesto de una obra por area|etapa. El formato anterior (por partida) se suma a su etapa. */
function presupuestoPorEtapa_(obraId, mapa) {
  const out = {};
  datos_(SH.PRESUPUESTO).filter(x => x[1] === obraId).forEach(x => {
    const area = x[7] || areaFila_('Presupuesto', x, obraId, x[2]);
    const etapa = String(x[8]) === 'Etapa' ? x[2] : (mapa[area + '|' + x[2]] || SIN_ETAPA);
    out[area + '|' + etapa] = (out[area + '|' + etapa] || 0) + (Number(x[3]) || 0);
  });
  return out;
}

/** Copia el libro completo a la carpeta IJM_Respaldos y conserva las ultimas 12 copias. */
function respaldar_() {
  const libro = DriveApp.getFileById(ss_().getId());
  const it = DriveApp.getFoldersByName('IJM_Respaldos');
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder('IJM_Respaldos');
  const nombre = 'Gestion_Obra_IJM respaldo ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm');
  libro.makeCopy(nombre, carpeta);
  const copias = [], f = carpeta.getFiles();
  while (f.hasNext()) { const x = f.next(); if (String(x.getName()).indexOf('Gestion_Obra_IJM respaldo') === 0) copias.push(x); }
  copias.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(12).forEach(x => x.setTrashed(true));
  PROPS_().setProperty('RESPALDO_ULTIMO', new Date().toISOString());
  return { nombre: nombre, copias: Math.min(copias.length, 12) };
}

/** Lo que corre solo cada domingo en la madrugada: respaldo y chequeo del libro. */
function respaldoSemanal() {
  try { respaldar_(); } catch (e) { registrarError_('respaldoSemanal', e, []); }
  try { guardarSalud_(revisarLibro_()); } catch (e) { registrarError_('revisarLibro', e, []); }
}

function duActivarRespaldo(token) {
  auth_(token);
  const ya = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'respaldoSemanal');
  if (!ya) ScriptApp.newTrigger('respaldoSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  const r = respaldar_();
  return { ok: true, nuevo: !ya, nombre: r.nombre };
}

function duRespaldarAhora(token) { auth_(token); return respaldar_(); }

/*
 * El codigo lee las columnas por posicion: una columna insertada a mano, una fila vacia entre datos o
 * un ID repetido rompen calculos sin avisar. Esto lo detecta.
 */
function revisarLibro_() {
  const problemas = [];
  Object.keys(ESQUEMA_).forEach(nombre => {
    const sh = hoja_(nombre);
    if (!sh) {
      if (['Errores', 'Plan_Semanal', 'Partidas_Obra'].indexOf(nombre) < 0) problemas.push({ hoja: nombre, detalle: 'No existe la hoja.' });
      return;
    }
    const v = sh.getDataRange().getValues();
    const enc = (v[0] || []).map(x => String(x).trim()), esp = ESQUEMA_[nombre], alias = ALIAS_[nombre] || {};
    for (let i = 0; i < esp.length && i < enc.length; i++) {
      if (!enc[i] || enc[i].toLowerCase() === String(esp[i]).toLowerCase() || (alias[i] || []).indexOf(enc[i].toLowerCase()) >= 0) continue;
      const igual = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
      const movida = igual(enc[i + 1], esp[i]) || igual(enc[i], esp[i + 1]) || igual(enc[i], esp[i - 1]);   // insertada, borrada o movida
      problemas.push({ hoja: nombre, detalle: 'La columna ' + (i + 1) + ' debería ser "' + esp[i] + '" y dice "' + enc[i] + '"' +
        (movida ? ': parece que se insertó, borró o movió una columna.' : '.') });
      break;                                                            // lo demas se corre igual: basta con el primero
    }
    // las filas vacias y las notas (sin ID) el sistema las ignora; lo grave es un renglon CON datos y SIN ID:
    // el sistema no lo ve y esos datos se pierden en silencio
    const ids = {}, dup = [];
    const conIdUnico = EDITABLES_.indexOf(nombre) < 0 && /_id$/.test(String(esp[0])) && nombre !== 'Partidas_Obra';
    for (let r = 1; r < v.length; r++) {
      const id = String(v[r][0] || '').trim();
      const llenas = v[r].filter(c => c !== '' && c !== null).length;
      if (!id && llenas >= 3) problemas.push({ hoja: nombre, detalle: 'La fila ' + (r + 1) + ' tiene datos pero no tiene ID: el sistema no la ve.' });
      if (id && conIdUnico) { if (ids[id]) dup.push(id); else ids[id] = true; }
    }
    if (dup.length) problemas.push({ hoja: nombre, detalle: 'IDs repetidos: ' + dup.slice(0, 5).join(', ') + (dup.length > 5 ? '…' : '') + '.' });
  });
  return problemas;
}

function guardarSalud_(p) {
  PROPS_().setProperty('SALUD', JSON.stringify({ fecha: new Date().toISOString(), problemas: p.slice(0, 30) }));
  return p;
}

function duRevisarLibro(token) { auth_(token); return { problemas: guardarSalud_(revisarLibro_()) }; }

/** Proteccion con ADVERTENCIA: al editar a mano, Google pregunta primero. El sistema escribe igual. */
function duProtegerHojas(token) {
  auth_(token);
  let n = 0;
  ss_().getSheets().forEach(sh => {
    sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).concat(sh.getProtections(SpreadsheetApp.ProtectionType.RANGE))
      .filter(p => p.getDescription() === 'IJM').forEach(p => p.remove());
    const pr = EDITABLES_.indexOf(sh.getName()) >= 0 || sh.getName() === 'Instrucciones'
      ? sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).protect()          // en las editables, solo los encabezados
      : sh.protect();
    pr.setDescription('IJM'); pr.setWarningOnly(true); n++;
  });
  PROPS_().setProperty('PROTEGIDO', new Date().toISOString());
  return { ok: true, hojas: n };
}

/** Estado del sistema para tu app: respaldo, salud, proteccion y errores recientes. */
function estadoSistema_() {
  const p = PROPS_();
  let activo = null;
  try { activo = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'respaldoSemanal'); } catch (e) { activo = null; }
  const ult = p.getProperty('RESPALDO_ULTIMO');
  const salud = JSON.parse(p.getProperty('SALUD') || 'null');
  const hace7 = new Date(Date.now() - 7 * 86400000);
  const errores = (hoja_('Errores') ? datos_('Errores') : []).filter(r => r[0] && new Date(r[0]) >= hace7).reverse().slice(0, 20)
    .map(r => ({ fecha: fecha_(r[0]), hora: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), 'HH:mm'), app: r[1], funcion: r[2], usuario: r[3], mensaje: r[4] }));
  const diasRespaldo = ult ? Math.floor((Date.now() - new Date(ult)) / 86400000) : null;
  return { respaldoActivo: activo, respaldoUltimo: ult ? fecha_(new Date(ult)) : '', diasRespaldo: diasRespaldo,
           salud: salud ? { fecha: fecha_(new Date(salud.fecha)), problemas: salud.problemas } : null,
           protegido: p.getProperty('PROTEGIDO') ? fecha_(new Date(p.getProperty('PROTEGIDO'))) : '', errores: errores };
}

function duSistema(token) { auth_(token); return estadoSistema_(); }

// ------------------------------------------------------ partidas de cada obra
function hojaPartidasObra_() {
  let sh = hoja_(SH.PARTIDAS_OBRA);
  if (!sh) {                                        // libros anteriores a este cambio: se crea sola
    sh = ss_().insertSheet(SH.PARTIDAS_OBRA);
    sh.appendRow(['area_id', 'proyecto_id', 'orden', 'partida', 'hito_calidad', 'peso', 'estado', 'dias', 'quien', 'paralelo', 'espera', 'etapa']);
  }
  return sh;
}

function copiarPartidasAArea_(areaId, obraId, tipo) {
  const filas = datos_(SH.PARTIDAS).filter(c => c[0] === tipo).sort((a, b) => a[1] - b[1])
    .map(c => [areaId, obraId, Number(c[1]) || 0, c[2], c[3] || '', pesoDe_(c), '',
               Number(c[5]) || 1, c[6] || 'Cuadrilla', c[7] || '', Number(c[8]) || 0, c[9] || '']);
  if (!filas.length) return;
  const sh = hojaPartidasObra_();
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, 12).setValues(filas);
  delete _memo[SH.PARTIDAS_OBRA];
}

/** Obras en curso de ese tipo sin copia propia: se congelan con el catalogo de hoy. */
function congelarAreasDeTipo_(tipo) {
  if (!tipo) return;
  const cerradas = datos_(SH.PROYECTOS).filter(r => r[9] === 'Entregada').map(r => r[0]);
  const conCopia = {};
  datos_(SH.PARTIDAS_OBRA).forEach(r => { conCopia[r[0]] = true; });
  datos_(SH.AREAS).filter(a => a[2] === tipo && !conCopia[a[0]] && cerradas.indexOf(a[1]) < 0)
    .forEach(a => copiarPartidasAArea_(a[0], a[1], tipo));
}

function asegurarCopiaArea_(obraId, areaId) {
  const ar = areasDe_(obraId).find(a => a.id === areaId);
  if (!ar) throw new Error('Area no encontrada.');
  if (!datos_(SH.PARTIDAS_OBRA).some(r => r[0] === areaId)) copiarPartidasAArea_(areaId, obraId, ar.tipo);
  return ar;
}

/** "No se hizo en esta obra": un bano sin puerta de vidrio no tiene por que quedar sin terminar. */
function duQuitarPartidaObra(token, obraId, areaId, partida, motivo) {
  const email = auth_(token);
  if (obraCerrada_(obraId)) throw new Error('Esa obra ya esta cerrada.');
  if (!String(motivo || '').trim()) throw new Error('Escribe por que se quita.');
  const ar = asegurarCopiaArea_(obraId, areaId);
  const usada = datos_(SH.AVANCE).some(r => r[2] === obraId && r[3] === partida && areaFila_('Avance', r, obraId, r[3]) === areaId) ||
    datos_(SH.MANO_OBRA).some(r => r[2] === obraId && r[4] === partida && (r[9] || areaId) === areaId) ||
    datos_(SH.OT).some(r => r[1] === obraId && r[8] !== 'Cancelada' && r[13] === partida && (r[14] || areaId) === areaId);
  if (usada) throw new Error('Esa partida ya tiene avance, horas u ordenes de trabajo. Terminala en lugar de quitarla.');
  const sh = hojaPartidasObra_(), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === areaId && v[i][3] === partida && String(v[i][6]) !== 'Quitada') {
      sh.getRange(i + 1, 7).setValue('Quitada');
      bitacoraCorreccion_(email, 'Partidas_Obra', areaId + '|' + partida, 'Quitar', 'partida', partida, '', motivo);
      marcarCambio_();
      return { ok: true };
    }
  }
  throw new Error('Esa partida no esta en ' + ar.nombre + '.');
}

/** Una partida solo para esta obra: el nicho que pidio este cliente. */
function duAgregarPartidaObra(token, obraId, areaId, p) {
  const email = auth_(token);
  if (obraCerrada_(obraId)) throw new Error('Esa obra ya esta cerrada.');
  const nombre = String(p.partida || '').trim();
  if (!nombre) throw new Error('Escribe el nombre de la partida.');
  if (p.hito && !datos_(SH.CHECKLIST).some(r => r[0] === p.hito)) {
    throw new Error('Ese punto de control no existe. Crealo primero en Puntos de control de calidad.');
  }
  const ar = asegurarCopiaArea_(obraId, areaId);
  delete _memo[SH.PARTIDAS_OBRA];
  const propias = datos_(SH.PARTIDAS_OBRA).filter(r => r[0] === areaId);
  if (propias.some(r => String(r[3]).toLowerCase() === nombre.toLowerCase() && String(r[6]) !== 'Quitada')) {
    throw new Error('Esa partida ya esta en ' + ar.nombre + '.');
  }
  const orden = propias.reduce((m, r) => Math.max(m, Number(r[2]) || 0), 0) + 1;
  hojaPartidasObra_().appendRow([areaId, obraId, orden, nombre, p.hito || '', Number(p.peso) > 0 ? Number(p.peso) : 1, '',
    Number(p.dias) > 0 ? Number(p.dias) : 1, p.quien || 'Cuadrilla', p.paralelo ? 'SI' : '', Number(p.espera) || 0, p.etapa || '']);
  bitacoraCorreccion_(email, 'Partidas_Obra', areaId + '|' + nombre, 'Agregar', 'partida', '', nombre, p.motivo || 'Partida solo para esta obra');
  marcarCambio_();
  return { ok: true };
}

// ------------------------------------------------------ estados de la obra
/*
 * "Lista para arranque" → "En obra" con el primer dia de trabajo; → "En cierre" al
 * registrar la entrega; → "Entregada" al cerrar. Antes ninguna obra pasaba a "En obra"
 * y la tasa de cierre, que solo cuenta esas, marcaba "sin datos" siempre. Esto tambien
 * compone las obras que ya estaban trabajando antes del cambio.
 */
function sanarEstados_() {
  const sh = hoja_(SH.PROYECTOS), v = sh.getDataRange().getValues();
  const trabajo = {}, entregadas = {};
  datos_(SH.BITACORA).forEach(b => { if (String(b[4] || '') !== '') trabajo[b[2]] = true; });
  datos_(SH.ENTREGA).forEach(e => { entregadas[e[1]] = true; });
  let cambio = false;
  for (let i = 1; i < v.length; i++) {
    const est = String(v[i][9]), id = v[i][0];
    let nuevo = est;
    if (entregadas[id] && ['En obra', 'Lista para arranque', 'Sin presupuesto'].indexOf(est) >= 0) nuevo = 'En cierre';
    else if ((est === 'Lista para arranque' || est === 'Sin presupuesto') && trabajo[id]) nuevo = 'En obra';
    else if (est === 'Lista para arranque' && !presupuestoCompleto_(id).ok) nuevo = 'Sin presupuesto';
    else if (est === 'Sin presupuesto' && presupuestoCompleto_(id).ok) nuevo = 'Lista para arranque';
    if (nuevo !== est) { sh.getRange(i + 1, 10).setValue(nuevo); cambio = true; }
  }
  if (cambio) delete _memo[SH.PROYECTOS];
}

function habilesEntre_(a, b) {               // dias habiles despues de a, hasta b inclusive
  let n = 0;
  const d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const fin = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  while (d < fin) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; }
  return n;
}

function sumarHabiles_(fecha, n) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  let k = 0;
  while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; }
  return d;
}

// ------------------------------------------------------ compras de la oficina
/** Gabinetes, appliances: lo que compra la oficina tambien es costo de la obra. */
function duGasto(token, p) {
  const email = auth_(token);
  exigir_([[p.proveedor, 'proveedor'], [p.descripcion, 'qué se compró']]);
  const monto = Number(p.monto) || 0;
  if (monto <= 0) throw new Error('Captura un monto valido.');
  if (!p.obra) throw new Error('Todo gasto debe asignarse a una obra.');
  if (obraCerrada_(p.obra)) throw new Error('Esa obra ya esta cerrada.');
  const id = conCandado_(function () {
    // prefijo propio: la app del PM usa GTO, y el candado de cada app no cruza a la otra
    const nuevo = nuevoId_(SH.GASTOS, 'GOF', 4);
    const k = partirClave_(p.partida, p.obra);
    const area = k.area || ((areasDe_(p.obra).find(a => a.generales) || {}).id || '');
    hoja_(SH.GASTOS).appendRow([nuevo, p.fecha ? new Date(p.fecha + 'T12:00:00') : new Date(), p.obra,
      p.categoria || 'Material', p.proveedor || '', p.descripcion || '', monto, p.metodo || 'Transferencia', '',
      p.factura ? 'Factura: ' + p.factura : '', email, new Date(), k.partida || '', 'Vigente', area, '']);
    return nuevo;
  });
  return { ok: true, id: id };
}

/** Compra del PM arriba de su limite: el administrador la ve y la marca como revisada. */
function duRevisarGasto(token, gastoId) {
  const email = auth_(token);
  const f = fila_(SH.GASTOS, gastoId);
  if (!f) throw new Error('No se encontro el gasto ' + gastoId);
  hoja_(SH.GASTOS).getRange(f, 16).setValue('Revisada ' + fecha_(new Date()) + ' por ' + email);
  marcarCambio_();
  return { ok: true };
}

// ------------------------------------------------------ reprogramar una orden de trabajo
/*
 * Cuando un sub no llega, antes la unica salida era cancelar y emitir otra orden. Ahora se
 * mueve la fecha: la falta queda contada (alimenta la tasa de presentacion), la asistencia
 * vuelve a quedar en blanco para que el PM marque cuando si llegue, y la nueva fecha pide
 * una nueva confirmacion por escrito.
 */
function duReprogramarOT(token, otId, p) {
  const email = auth_(token);
  if (!p.inicio) throw new Error('Pon la nueva fecha de inicio.');
  const f = fila_(SH.OT, otId);
  if (!f) throw new Error('Orden de trabajo no encontrada.');
  const sh = hoja_(SH.OT);
  const ot = sh.getRange(f, 1, 1, 16).getValues()[0];
  if (['Aprobada', 'Pagada', 'Cancelada'].indexOf(ot[8]) >= 0) throw new Error('Esa orden ya esta ' + String(ot[8]).toLowerCase() + '.');
  if (obraCerrada_(ot[1])) throw new Error('Esa obra ya esta cerrada.');
  const falto = String(ot[10]).toUpperCase() === 'NO';
  const ini = new Date(p.inicio + 'T12:00:00'), fin = p.fin ? new Date(p.fin + 'T12:00:00') : ini;
  if (fin < ini) throw new Error('La fecha de fin no puede ser antes del inicio.');
  sh.getRange(f, 7, 1, 2).setValues([[ini, fin]]);
  sh.getRange(f, 9, 1, 3).setValues([['Emitida', '', '']]);
  const faltas = (Number(ot[15]) || 0) + (falto ? 1 : 0);
  sh.getRange(f, 16).setValue(faltas);
  bitacoraCorreccion_(email, 'Ordenes_Trabajo', otId, 'Reprogramar', 'fecha_inicio_prog', fecha_(ot[6]), fecha_(ini),
    (p.motivo || '') + (falto ? ' (el sub no llego)' : ''));
  marcarCambio_();
  return { ok: true, faltas: faltas };
}

// ------------------------------------------------------------------- sesion

function duLogin(usuario, pin, lang) {
  return intentarAcceso_(usuario, pin, 'admin', 'du_', 'Esta app es solo para administradores. Los PM usan Bitacora de Campo.');
}

// ------------------------------------------------------------ carga inicial

/** El idioma elegido queda en su usuario. */
function duIdioma(token, lang) {
  return guardarIdioma_(auth_(token), lang);
}

/** La pregunta barata: una celda. */
function duSello(token) {
  auth_(token);
  return selloActual_();
}

function calcularDatos_(token) {
  auth_(token);
  sanarEstados_();
  // duraciones reales por partida: igual que los costos reales corrigen tus cotizaciones
  var duracionesReales = (function () {
    const acc = {}, tipos = {};
    datos_(SH.AREAS).forEach(a => { tipos[a[0]] = a[2]; });
    const vistos = {};
    datos_(SH.PROYECTOS).forEach(p => { const re = realDeObra_(p[0]);
      Object.keys(re).forEach(k => { const x = re[k]; if (!x.ini || !x.fin || vistos[p[0] + k]) return; vistos[p[0] + k] = true;
        const i = k.indexOf('|'), t = tipos[k.slice(0, i)], clave = t + '|' + k.slice(i + 1);
        const dd = habilesEntre_(x.ini, x.fin) + 1; const e = acc[clave] || (acc[clave] = { s: 0, n: 0 }); e.s += dd; e.n++; }); });
    const out = {}; Object.keys(acc).forEach(k => { out[k] = { prom: acc[k].s / acc[k].n, n: acc[k].n }; });
    return out;
  })();                   // obras trabajando que no habian pasado a "En obra"
  const sello = selloActual_();      // antes de leer: si algo cambia en medio, se vuelve a pedir
  const cfg = config_();
  const proyectos = datos_(SH.PROYECTOS);
  const bitacora = datos_(SH.BITACORA);
  const gastos = datos_(SH.GASTOS);
  const bloqueos = datos_(SH.BLOQUEOS);
  const ocs = datos_(SH.OC);
  const ots = datos_(SH.OT);
  const nc = datos_(SH.NC);
  const manoObra = datos_(SH.MANO_OBRA);
  const pagos = datos_(SH.PAGOS);
  const cobros = datos_(SH.COBROS);
  const presu = datos_(SH.PRESUPUESTO);
  const calidad = datos_(SH.CALIDAD);
  const aguas = datos_(SH.AGUA);
  const partidasCat = datos_(SH.PARTIDAS);
  const punch = datos_(SH.PUNCH);
  const entregas = datos_(SH.ENTREGA);
  const tar = tarifas_();
  const nombreSub = {};
  datos_(SH.SUBS).forEach(x => { nombreSub[x[0]] = x[1]; });
  const usuarios = datos_(SH.USUARIOS);
  const nombrePM = {};
  usuarios.forEach(u => { nombrePM[String(u[0]).toLowerCase()] = u[2]; });

  const activas = proyectos.filter(r => ['En obra', 'Lista para arranque', 'Sin presupuesto', 'En cierre'].indexOf(String(r[9])) >= 0);

  const tablero = activas.map(r => {
    const id = r[0];
    const bits = bitacora.filter(b => b[2] === id);
    const ultima = bits.reduce((m, b) => (!m || b[1] > m) ? b[1] : m, null);   // la fecha mas reciente, no el ultimo renglon
    const sinReporte = ultima ? dias_(ultima) : null;
    const gastosObra = gastos.filter(g => g[2] === id);
    const ocAut = ocs.filter(o => o[1] === id && ['Autorizada', 'Facturada'].indexOf(o[9]) >= 0);
    const montoOC = ocAut.reduce((a, o) => a + (Number(o[6]) || 0), 0);
    const contrato = (Number(r[10]) || 0) + montoOC;
    const materiales = gastosObra.reduce((a, g) => a + (Number(g[6]) || 0), 0);
    const moObra = manoObra.filter(m => m[2] === id);
    const costoCuadrilla = costoMO_(moObra, tar);
    const horasCuadrilla = moObra.reduce((a, m) => a + (Number(m[5]) || 0), 0);
    const otsObra = ots.filter(o => o[1] === id && o[8] !== 'Cancelada');
    const comprometidoSub = otsObra.reduce((a, o) => a + (Number(o[5]) || 0), 0);
    const pagadoSub = pagos.filter(p => p[3] === id).reduce((a, p) => a + (Number(p[6]) || 0), 0);
    const gastado = materiales + costoCuadrilla + comprometidoSub;
    const cobrado = cobros.filter(c => c[2] === id).reduce((a, c) => a + (Number(c[4]) || 0), 0);
    const presupuestado = presu.filter(x => x[1] === id).reduce((a, x) => a + (Number(x[3]) || 0), 0);
    const blqAbiertos = bloqueos.filter(b => b[2] === id && b[8] === 'Abierto');
    const ocProp = ocs.filter(o => o[1] === id && o[9] === 'Propuesta');
    // fecha de entrega comprometida: la del contrato mas los dias de las OC autorizadas
    const diasOC = ocAut.reduce((a, o) => a + (Number(o[8]) || 0), 0);
    const compromiso = r[7] ? sumarHabiles_(new Date(r[7]), diasOC) : null;
    const hoyD = new Date();
    const entregada = entregas.some(e => e[1] === id);
    const atraso = (compromiso && !entregada && hoyD > compromiso) ? habilesEntre_(compromiso, hoyD) : 0;
    const av = avanceObra_(id);
    const cr = entregada ? null : cronogramaObra_(id);
    const atrasoPrev = (cr && compromiso && cr.prevFin > compromiso) ? habilesEntre_(compromiso, cr.prevFin) : 0;
    const iniD = r[6] ? new Date(r[6]) : null;
    const plan = (iniD && compromiso) ? habilesEntre_(iniD, compromiso) + 1 : 0;
    const esperado = (plan && iniD && hoyD >= iniD) ? Math.min(1, (habilesEntre_(iniD, hoyD) + 1) / plan) : 0;
    const hSin = (Number(cfg['HORAS_SIN_RECIBO']) || 72) * 3600000;
    const sinReciboViejo = gastosObra.filter(g => !g[9] && String(g[0]).indexOf('GOF') !== 0 && hoyD - new Date(g[1]) > hSin);
    let alerta = 'OK';
    if (r[9] === 'Sin presupuesto') alerta = 'Falta presupuesto';
    else
    if (blqAbiertos.some(b => (dias_(b[1]) || 0) * 24 >= (Number(cfg['SLA_BLOQUEO_HORAS']) || 24))) alerta = 'Bloqueo fuera de SLA';
    else if (blqAbiertos.length) alerta = 'Bloqueo abierto';
    else if (atraso > 0) alerta = 'Atrasada ' + atraso + (atraso === 1 ? ' dia' : ' dias');
    else if (r[9] === 'En obra' && sinReporte !== null && sinReporte > 2) alerta = 'Sin reporte ' + sinReporte + ' dias';
    else if (ocProp.length) alerta = 'OC sin autorizar';
    else if (sinReciboViejo.length) alerta = 'Cargos sin recibo';
    return {
      id: id, cliente: r[1], tipo: etiquetaTipo_(id), pm: nombrePM[String(r[5]).toLowerCase()] || r[5],
      estado: r[9], direccion: r[3],
      pies2: areasDe_(id).filter(a => !a.generales).reduce((s, a) => s + a.pies2, 0),
      inicio: fecha_(r[6]), finEst: fecha_(r[7]),
      diasEnObra: dias_(r[6]) !== null ? Math.max(0, dias_(r[6])) : 0,
      ultimoReporte: fecha_(ultima), diasSinReporte: sinReporte,
      diasReportados: bits.length,
      contratoOriginal: Number(r[10]) || 0, montoOC: montoOC, nOC: ocAut.length, contratoActual: contrato,
      gastado: gastado, materiales: materiales, manoObra: costoCuadrilla,
      subcontratos: comprometidoSub, pagadoSub: pagadoSub, saldoSub: comprometidoSub - pagadoSub,
      cobrado: cobrado, porCobrar: contrato - cobrado, presupuestado: presupuestado,
      avance: av,
      pctCobrado: contrato ? cobrado / contrato : 0,
      // contra el avance se compara el costo INCURRIDO, no el comprometido: una orden
      // de trabajo emitida hoy no es costo gastado hasta que el PM aprueba el trabajo
      pctCosto: presupuestado ? (materiales + costoCuadrilla +
        otsObra.filter(o => o[11]).reduce((a, o) => a + (Number(o[5]) || 0), 0)) / presupuestado : null,
      horasCuadrilla: horasCuadrilla,
      blqAbiertos: blqAbiertos.length, ocPropuestas: ocProp.length,
      sinRecibo: sinReciboViejo.length, alerta: alerta,
      compromiso: compromiso ? fecha_(compromiso) : '', atraso: atraso,
      esperado: esperado, detrasDelPlan: !entregada && plan > 0 && esperado - av.pct > 0.15,
      prevFin: cr && cr.prevFin ? fecha_(cr.prevFin) : '', atrasoPrevisto: atrasoPrev, ppc: ppcSemanaPasada_(id)
    };
  });

  const colaBloqueos = bloqueos.filter(b => b[8] === 'Abierto').map(b => {
    const horas = Math.round((new Date() - b[1]) / 3600000);
    return {
      id: b[0], fecha: fecha_(b[1]), obra: b[2], tipo: b[3], descripcion: b[4],
      foto: b[5], pm: nombrePM[String(b[6]).toLowerCase()] || b[6],
      detiene: b[7] === 'SI', horas: horas,
      fueraSLA: horas > (Number(cfg['SLA_BLOQUEO_HORAS']) || 24)
    };
  }).sort((a, b) => b.horas - a.horas);

  const listaOC = ocs.slice().reverse().map(o => {
    const precio = Number(o[6]) || 0, costo = Number(o[5]) || 0;
    return {
      id: o[0], obra: o[1], hallazgo: fecha_(o[2]), motivo: o[3], descripcion: o[4],
      costo: costo, precio: precio, margen: precio ? 1 - costo / precio : 0,
      dias: Number(o[8]) || 0, estado: o[9], emision: fecha_(o[10]),
      autorizacion: fecha_(o[11]), cobro: fecha_(o[12]), condicion: o[13],
      horasDesdeEmision: o[10] ? Math.round((new Date() - o[10]) / 3600000) : null
    };
  });

  const sinRecibo = gastos.filter(g => !g[9]).map(g => ({
    id: g[0], fecha: fecha_(g[1]), obra: g[2], proveedor: g[4], descripcion: g[5],
    monto: Number(g[6]) || 0, tarjeta: String(g[8] || ''),
    pm: nombrePM[String(g[10]).toLowerCase()] || g[10],
    horas: Math.round((new Date() - g[1]) / 3600000)
  })).sort((a, b) => b.horas - a.horas);

  return {
    tablero: tablero,
    bloqueos: colaBloqueos,
    oc: listaOC,
    sinRecibo: sinRecibo,
    kpis: kpis_(cfg, proyectos, bitacora, gastos, bloqueos, ocs, ots, nc, tablero, manoObra,
                pagos, calidad, aguas, partidasCat, activas, punch, entregas),
    calidadPendiente: (function () {
      const out = [];
      activas.forEach(p => {
        const hechas = calidad.filter(c => c[2] === p[0] && c[5] === 'Aprobado').map(c => c[3]);
        const conDefecto = calidad.filter(c => c[2] === p[0] && c[5] === 'Con defectos');
        conDefecto.forEach(c => {
          if (hechas.indexOf(c[3]) < 0) out.push({
            obra: p[0], cliente: p[1], hito: c[3], partida: c[4],
            fecha: fecha_(c[1]), defectos: c[8], pm: nombrePM[String(p[5]).toLowerCase()] || p[5]
          });
        });
      });
      return out;
    })(),
    punchVencido: punch.filter(x => x[7] === 'Abierto' && x[6] && x[6] < new Date())
      .map(x => ({ id: x[0], obra: x[1], item: x[3], origen: x[4],
                   responsable: x[5], compromiso: fecha_(x[6]) })),
    garantiaAbierta: nc.filter(x => x[3] === 'Garantia' && x[9] === 'Abierto')
      .map(x => ({ id: x[0], obra: x[2], fecha: fecha_(x[1]), causa: x[4],
                   descripcion: x[8], dias: Math.floor((new Date() - x[1]) / 86400000) })),
    cosecha: entregas.filter(e => {
      const v = e[4];
      const diasEntrega = Math.floor((new Date() - e[2]) / 86400000);
      const porVencer = v && (v - new Date()) / 86400000 < 40 && (v - new Date()) > 0
        && String(e[9]).toUpperCase() !== 'SI';
      const sinResena = diasEntrega >= 3 && String(e[7]).toUpperCase() !== 'SI';
      return porVencer || sinResena;
    }).map(e => {
      const proy = proyectos.find(p => p[0] === e[1]) || [];
      return { obra: e[1], cliente: proy[1] || e[1], entrega: fecha_(e[2]),
        vence: fecha_(e[4]),
        diasAVencer: e[4] ? Math.floor((e[4] - new Date()) / 86400000) : null,
        resena: String(e[7]).toUpperCase() === 'SI',
        referido: String(e[8]).toUpperCase() === 'SI',
        visita: String(e[9]).toUpperCase() === 'SI' };
    }),
    checklist: (function () {
      const g = {};
      datos_(SH.CHECKLIST).sort((a, b) => a[1] - b[1]).forEach(r => {
        (g[r[0]] = g[r[0]] || []).push({ n: Number(r[1]) || 0, punto: r[2],
          foto: String(r[3]).toUpperCase() === 'SI' });
      });
      return g;
    })(),
    ordenes: ots.slice().reverse().map(o => {
      const pg = pagos.filter(p => p[2] === o[0]);
      const pagado = pg.reduce((a, p) => a + (Number(p[6]) || 0), 0);
      const precio = Number(o[5]) || 0;
      return {
        id: o[0], obra: o[1], subId: o[2], sub: nombreSub[o[2]] || o[2], oficio: o[3],
        alcance: o[4], partida: o[13] || '', precio: precio,
        inicio: fecha_(o[6]), fin: fecha_(o[7]), estado: o[8],
        confirmada: fecha_(o[9]), sePresento: o[10], aprobada: fecha_(o[11]),
        pagado: pagado, saldo: precio - pagado,
        pagos: pg.map(p => ({ id: p[0], fecha: fecha_(p[1]), concepto: p[5],
          monto: Number(p[6]) || 0, metodo: p[7], referencia: p[8] }))
      };
    }),
    partidas: datos_(SH.PARTIDAS).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || a[1] - b[1])
      .map(p => ({ tipo: p[0], orden: Number(p[1]) || 0, partida: p[2], hito: p[3] || '',
                   peso: pesoDe_(p), dias: Number(p[5]) || 0, quien: p[6] || '', paralelo: String(p[7] || '').toUpperCase() === 'SI',
                   espera: Number(p[8]) || 0, etapa: String(p[9] || ''), real: (duracionesReales || {})[p[0] + '|' + p[2]] || null })),
    trabajadores: datos_(SH.TRABAJADORES).map(t => ({
      id: t[0], nombre: t[1], puesto: t[2], tipoPago: t[3],
      tarifa: Number(t[4]) || 0, telefono: String(t[5] || ''),
      activo: String(t[6]).toUpperCase() === 'SI'
    })),
    sello: sello,
    sistema: (function () { try { return estadoSistema_(); } catch (e) { return null; } })(),
    // para tu revision de la tarde: obras en curso que todavia no cierran hoy
    sinCierreHoy: (function () {
      const hoyTxt = fecha_(new Date());
      const cerradas = {};
      datos_(SH.BITACORA).forEach(b => { if (fecha_(b[1]) === hoyTxt) cerradas[b[2]] = true; });
      return datos_(SH.PROYECTOS).filter(r => r[9] === 'En obra' && !cerradas[r[0]])
        .map(r => ({ obra: r[0], cliente: r[1], pm: nombrePM[String(r[5]).toLowerCase()] || r[5] }));
    })(),
    semana: (function () {
      const act = datos_(SH.PROYECTOS).filter(r => ['En obra', 'Lista para arranque', 'Sin presupuesto'].indexOf(r[9]) >= 0);
      congelarSemana_(act.filter(r => r[9] === 'En obra'));
      return estaSemana_(act, datos_(SH.OT), datos_(SH.SUBS));
    })(),
    // compras del PM arriba de su limite, esperando que las revises
    comprasLimite: datos_(SH.GASTOS).filter(g => String(g[15]) === 'Pendiente').map(g => ({
      id: g[0], obra: g[2], fecha: fecha_(g[1]), proveedor: g[4], descripcion: g[5], monto: Number(g[6]) || 0,
      usuario: nombrePM[String(g[10]).toLowerCase()] || g[10] })),
    // subs que no llegaron el dia de su orden: hay que reprogramar
    subsNoLlegaron: datos_(SH.OT).filter(o => String(o[10]).toUpperCase() === 'NO' &&
      ['Cancelada', 'Pagada', 'Aprobada'].indexOf(o[8]) < 0).map(o => ({
      ot: o[0], obra: o[1], sub: (datos_(SH.SUBS).find(s => s[0] === o[2]) || [])[1] || o[2],
      inicio: fecha_(o[6]), partida: o[13] || '', faltas: Number(o[15]) || 0 })),
    sinCorreoAvisos: !correoDueno_(),
    tiposObra: datos_(SH.PARTIDAS).map(p => p[0]).filter((v, i, a) => a.indexOf(v) === i),
    tiposArea: datos_(SH.PARTIDAS).map(p => p[0])
      .filter((v, i, a) => a.indexOf(v) === i && v !== 'Generales'),
    areasPorObra: (function () {
      const m = {};
      datos_(SH.AREAS).forEach(a => {
        (m[a[1]] = m[a[1]] || []).push({ id: a[0], tipo: a[2], nombre: a[3], generales: a[2] === 'Generales' });
      });
      return m;
    })(),
    obras: proyectos.map(r => ({ id: r[0], cliente: r[1], estado: r[9] })),
    subsTodos: datos_(SH.SUBS).map(s => ({
      id: s[0], nombre: s[1], oficio: s[2], telefono: String(s[3] || ''),
      seguroVence: s[4] ? Utilities.formatDate(new Date(s[4]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      activo: String(s[5]).toUpperCase() === 'SI', contacto: s[6] || '', correo: s[7] || '',
      licencia: s[8] || '',
      licenciaVence: s[9] ? Utilities.formatDate(new Date(s[9]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      w9: String(s[10]).toUpperCase() === 'SI', requiereLicencia: requiereLicencia_(s[2]),
      pendientes: revisionSub_(s)
    })),
    subsCatalogo: datos_(SH.SUBS).map(s => {
      const iso = v => (v && Object.prototype.toString.call(v) === '[object Date]')
        ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      const suyas = ots.filter(o => o[2] === s[0] && o[10]);
      const llego = suyas.filter(o => String(o[10]).toUpperCase() === 'SI').length;
      return {
        id: s[0], nombre: s[1], oficio: s[2], telefono: String(s[3] || ''),
        seguroVence: iso(s[4]), activo: String(s[5]).toUpperCase() === 'SI',
        contacto: s[6] || '', correo: s[7] || '', licencia: s[8] || '',
        licenciaVence: iso(s[9]), w9: String(s[10]).toUpperCase() === 'SI',
        requiereLicencia: requiereLicencia_(s[2]),
        ordenes: suyas.length, puntualidad: suyas.length ? llego / suyas.length : null,
        defectos: nc.filter(x => x[5] === s[0]).length,
        costoDefectos: nc.filter(x => x[5] === s[0]).reduce((a, x) => a + (Number(x[6]) || 0), 0),
        abiertas: ots.filter(o => o[2] === s[0] && ['Emitida', 'Confirmada', 'Aprobada'].indexOf(o[8]) >= 0).length,
        avisos: revisionSub_(s)
      };
    }),
    subs: datos_(SH.SUBS).filter(s => String(s[5]).toUpperCase() === 'SI')
      .map(s => {
        // calificacion calculada: puntualidad menos defectos que le costaron dinero
        const suyas = ots.filter(o => o[2] === s[0] && o[10]);
        const llego = suyas.filter(o => String(o[10]).toUpperCase() === 'SI').length;
        const defectos = nc.filter(x => x[5] === s[0]).length;
        const costoDefectos = nc.filter(x => x[5] === s[0])
          .reduce((a, x) => a + (Number(x[6]) || 0), 0);
        return {
          id: s[0], nombre: s[1], oficio: s[2],
          seguroVence: fecha_(s[4]),
          seguroVencido: !!(s[4] && new Date(s[4]) < new Date()),
          ordenes: suyas.length,
          puntualidad: suyas.length ? llego / suyas.length : null,
          defectos: defectos, costoDefectos: costoDefectos
        };
      }),
    pms: usuarios.filter(u => String(u[3]).toLowerCase() === 'pm').map(u => ({ email: u[0], nombre: u[2] })),
    cfg: cfg
  };
}

function kpis_(cfg, proyectos, bitacora, gastos, bloqueos, ocs, ots, nc, tablero, manoObra, pagos,
               calidad, aguas, partidasCat, activas, punch, entregas) {
  const hace7 = new Date(Date.now() - 7 * 86400000);
  // Tasa de cierre: cuantos dias HABILES de la ultima semana tuvieron su cierre, por obra.
  // Antes dividia entre 7 dias naturales: una semana perfecta daba 71% y el KPI vivia en rojo.
  // Un dia cuenta una vez aunque se cierre dos veces, y una obra no se cuenta antes de arrancar.
  // Sin HOY: a las 8 am el cierre de hoy todavia no puede existir, y contarlo pintaba
  // rojo cada manana. Los dias sin trabajo se reportan como tales y si cuentan como cierre.
  const habiles = [];
  for (let i = 1; i <= 7; i++) {
    const f = new Date(Date.now() - i * 86400000);
    if (f.getDay() !== 0 && f.getDay() !== 6) habiles.push(f);
  }
  const cerrados = {}, primerDia = {};
  bitacora.forEach(b => {
    cerrados[b[2] + '|' + fecha_(b[1])] = true;
    if (String(b[4] || '') !== '' && (!primerDia[b[2]] || b[1] < primerDia[b[2]])) primerDia[b[2]] = b[1];
  });
  let esperados = 0, cumplidos = 0;
  proyectos.filter(r => r[9] === 'En obra').forEach(r => {
    const i0 = primerDia[r[0]] ? new Date(primerDia[r[0]]) : (r[6] ? new Date(r[6]) : null);   // arranque REAL
    const dia0 = i0 ? new Date(i0.getFullYear(), i0.getMonth(), i0.getDate()) : null;
    habiles.forEach(f => {
      if (dia0 && f < dia0) return;          // la obra todavia no arrancaba ese dia
      esperados++;
      if (cerrados[r[0] + '|' + fecha_(f)]) cumplidos++;
    });
  });

  const respondidos = bloqueos.filter(b => Number(b[11]) > 0);
  const promHoras = respondidos.length
    ? respondidos.reduce((a, b) => a + Number(b[11]), 0) / respondidos.length : 0;

  // denominador = ordenes cuyo dia de arranque ya se registro (llego o no llego).
  // Antes se dividia entre las que confirmaron por escrito: un sub que llegaba sin
  // confirmar contaba arriba y no abajo, y la tasa podia pasar de 100%.
  const conRegistro = ots.filter(o => ['SI', 'NO'].indexOf(String(o[10]).toUpperCase()) >= 0 || Number(o[15]) > 0);
  const presentados = conRegistro.filter(o => String(o[10]).toUpperCase() === 'SI').length;
  const oportunidades = ots.reduce((a, o) => a + (['SI', 'NO'].indexOf(String(o[10]).toUpperCase()) >= 0 ? 1 : 0) + (Number(o[15]) || 0), 0);
  const ocEmitidas = ocs.filter(o => o[10]);
  const autorizadas = ocs.filter(o => ['Autorizada', 'Facturada'].indexOf(o[9]) >= 0).length;
  const sumaPrecio = ocs.reduce((a, o) => a + (Number(o[6]) || 0), 0);
  const sumaCosto = ocs.reduce((a, o) => a + (Number(o[5]) || 0), 0);
  const sumaContratos = proyectos.reduce((a, r) => a + (Number(r[10]) || 0), 0);
  const costoNC = nc.reduce((a, r) => a + (Number(r[6]) || 0), 0);
  const slaB = Number(cfg['SLA_BLOQUEO_HORAS']) || 24;
  const slaOC = Number(cfg['SLA_OC_HORAS']) || 48;

  function k(proc, nombre, real, meta, dir, fmt, revela, sinDatos) {
    let sem = 'VERDE';
    if (sinDatos) return { proc: proc, nombre: nombre, real: 0, meta: meta, fmt: fmt, sem: 'INFO',
                           revela: 'Sin datos todavia. ' + revela, sinDatos: true };
    if (dir === 'info') sem = 'INFO';
    else if (dir === 'mayor') sem = real >= meta ? 'VERDE' : (real >= meta * 0.9 ? 'AMBAR' : 'ROJO');
    else sem = real <= meta ? 'VERDE' : (real <= meta * 1.25 + 0.5 ? 'AMBAR' : 'ROJO');
    return { proc: proc, nombre: nombre, real: real, meta: meta, fmt: fmt, sem: sem, revela: revela };
  }

  // calidad
  calidad = calidad || []; aguas = aguas || []; partidasCat = partidasCat || []; activas = activas || [];
  const hitoDe = {};
  partidasCat.forEach(r => { if (r[3]) hitoDe[r[2]] = r[3]; });
  const inspeccionadas = calidad.length;
  const conFoto = calidad.filter(c => String(c[9] || '') !== '').length;
  const conDefectos = calidad.filter(c => c[5] === 'Con defectos').length;
  const aguaOk = aguas.filter(a => a[7] === 'Sin fugas').length;
  const aguaFuga = aguas.filter(a => a[7] === 'Con fuga').length;
  punch = punch || []; entregas = entregas || [];
  const nEnt = entregas.length;
  const punchCerrado = punch.filter(x => x[7] === 'Cerrado');
  const enTiempo = punchCerrado.filter(x => x[8] && x[6] && x[8] <= x[6]).length;
  const garantias = nc.filter(x => x[3] === 'Garantia');
  const costoGarantia = garantias.reduce((a, x) => a + (Number(x[6]) || 0), 0);
  const facturado = proyectos.reduce((a, r) => a + (Number(r[10]) || 0), 0);

  const PRINCIPALES = [
    'Tasa de cierre de dia del PM (dias habiles)',
    'Bloqueos abiertos fuera de SLA (' + slaB + ' h)',
    'OC en Propuesta fuera de SLA (' + slaOC + ' h)',
    'Cargos de tarjeta sin recibo',
    'Saldo pendiente con subcontratistas',
    'Costo de no calidad sobre contratos'
  ];
  // "Puntos de control con defectos" NO va aqui: un defecto atrapado antes de cubrirse
  // es buena noticia, no una alarma. Sigue visible en "ver todos".
  const lista = [
    k('P3', 'Tasa de cierre de dia del PM (dias habiles)', esperados ? cumplidos / esperados : 0,
      Number(cfg['META_TASA_REPORTE']) || 0.95, 'mayor', 'pct',
      'Integridad de tus datos. Si cae, todo lo demas es ficcion', !esperados),
    (function () { const p = ppcSemanaPasada_(null);
      return k('P3', 'Cumplimiento semanal del plan (PPC)', p ? p.ppc : 0, 0.8, 'mayor', 'pct',
        'De lo que estaba previsto terminar la semana pasada, cuanto se termino', !p); })(),
    k('P3', 'Bloqueos abiertos fuera de SLA (' + slaB + ' h)',
      bloqueos.filter(b => b[8] === 'Abierto' && (new Date() - b[1]) / 3600000 > slaB).length, 0, 'menor', 'num',
      'Si tu fallas aqui, el PM deja de reportar'),
    k('P3', 'Horas promedio de respuesta a avisos', promHoras, slaB, 'menor', 'num1',
      'Tu compromiso con el PM, medido'),
    k('P3', 'Cargos de tarjeta sin recibo', gastos.filter(g => !g[9] && String(g[0]).indexOf('GOF') !== 0 &&
      Date.now() - new Date(g[1]).getTime() > (Number(cfg['HORAS_SIN_RECIBO']) || 72) * 3600000).length, 0, 'menor', 'num',
      'Control financiero de campo'),
    k('P3', 'Tasa de presentacion de subs', oportunidades ? presentados / oportunidades : 0,
      Number(cfg['META_PRESENTACION_SUBS']) || 0.9, 'mayor', 'pct',
      'Calidad real de tu banco de subs', !conRegistro.length),
    k('P3', 'Pagos a subs sin trabajo aprobado por el PM',
      (pagos || []).filter(p => {
        if (p[5] !== 'Liquidacion') return false;
        const ot = ots.find(o => o[0] === p[2]);
        return !ot || !ot[11];
      }).length, 0, 'menor', 'num',
      'Si pagas sin aprobacion, el control de calidad se cae solo'),
    k('P3', 'Saldo pendiente con subcontratistas',
      ots.filter(o => o[8] !== 'Cancelada').reduce((a, o) => a + (Number(o[5]) || 0), 0) -
      (pagos || []).reduce((a, p) => a + (Number(p[6]) || 0), 0),
      0, 'info', 'money', 'Lo que ya debes aunque no haya salido de tu cuenta'),
    k('P5', 'Puntos de control con defectos',
      conDefectos, 0, 'menor', 'num',
      'Encontrados a tiempo, antes de cubrirse. Esto es bueno que exista'),
    k('P5', 'Pruebas de inundacion con fuga',
      aguaFuga, 0, 'menor', 'num',
      'Cada una evitada es la reclamacion de garantia mas cara que existe'),
    k('P6', 'Detalles por obra en el punch list del cliente',
      nEnt ? punch.length / nEnt : 0, 5, 'menor', 'num1',
      'Arriba de 5: tu punto de control PC5 no se esta haciendo'),
    k('P6', 'Punch list cerrado dentro de los 7 dias',
      punchCerrado.length ? enTiempo / punchCerrado.length : 1, 0.9, 'mayor', 'pct',
      'Cerrar tarde es lo que arruina una entrega que salio bien'),
    k('P6', 'Reclamos de garantia por obra entregada',
      nEnt ? garantias.length / nEnt : 0, 1, 'menor', 'num1',
      'Lo que se te escapo. Es el espejo del KPI de calidad' + (costoGarantia ? ' · te han costado ' +
        '$' + Math.round(costoGarantia).toLocaleString('en-US') + (facturado ? ', ' + (costoGarantia / facturado * 100).toFixed(1) + '% de lo facturado' : '') : '')),
    k('P6', 'Resenas obtenidas',
      nEnt ? entregas.filter(e => String(e[7]).toUpperCase() === 'SI').length / nEnt : 0,
      0.6, 'mayor', 'pct', 'Tu costo de adquisicion baja directo con esto'),
    k('P4', 'OC en Propuesta fuera de SLA (' + slaOC + ' h)',
      ocs.filter(o => o[9] === 'Propuesta' && o[10] && (new Date() - o[10]) / 3600000 > slaOC).length,
      0, 'menor', 'num', 'Dias de obra que estas perdiendo en espera'),
    k('P4', '% de OC autorizadas', ocs.length ? autorizadas / ocs.length : 0,
      Number(cfg['META_OC_AUTORIZADAS']) || 0.7, 'mayor', 'pct',
      'Abajo de la meta: cotizas caro o comunicas mal'),
    k('P4', 'Margen promedio de las OC', sumaPrecio ? 1 - sumaCosto / sumaPrecio : 0,
      Number(cfg['MARGEN_MINIMO_OC']) || 0.35, 'mayor', 'pct',
      'Si es menor al contrato base, te estas regalando'),
    k('P4', 'Valor de OC sobre contratos', sumaContratos ? sumaPrecio / sumaContratos : 0,
      Number(cfg['MAX_OC_SOBRE_CONTRATO']) || 0.2, 'menor', 'pct',
      'Arriba de la meta el problema esta en tu estimacion'),
    k('P4', 'Costo de no calidad sobre contratos', sumaContratos ? costoNC / sumaContratos : 0,
      Number(cfg['MAX_NO_CALIDAD']) || 0.02, 'menor', 'pct',
      'El KPI que duele y que casi nadie mide' + (function () { const dd = nc.reduce((a, r) => a + (Number(r[7]) || 0), 0);
        return dd ? ' · ' + dd + (dd === 1 ? ' dia perdido' : ' dias perdidos') + ' por retrabajo' : ''; })())
  ];
  lista.forEach(x => { x.top = PRINCIPALES.indexOf(x.nombre) >= 0; });
  return lista;
}

// -------------------------------------------------------- proceso 3: avisos

function duResponderBloqueo(token, id, respuesta) {
  auth_(token);
  if (!respuesta || respuesta.length < 5) throw new Error('Escribe una respuesta util para el PM.');
  const sh = hoja_(SH.BLOQUEOS);
  const f = fila_(SH.BLOQUEOS, id);
  const abierto = sh.getRange(f, 2).getValue();
  const horas = Math.round((new Date() - abierto) / 3600000 * 10) / 10;
  sh.getRange(f, 9).setValue('Cerrado');
  sh.getRange(f, 10).setValue(respuesta);
  sh.getRange(f, 11).setValue(new Date());
  sh.getRange(f, 12).setValue(horas);
  marcarCambio_();
  return { ok: true, horas: horas };
}

// -------------------------------------------------------- subcontratistas
/*
 * En Texas, plomeria, electricidad y aire acondicionado requieren licencia estatal.
 * Tile, drywall, pintura, demolicion o countertops no. El sistema no te bloquea:
 * te avisa y te pide confirmar, igual que con el seguro vencido.
 */
function requiereLicencia_(oficio) {
  return /plomer|electric|aire|hvac|a\/c|clima/i.test(sinAcentos_(oficio));        // "Eléctrico" con acento tambien
}

/** Lo que le falta en papeles a un sub. Lista vacia = en regla. */
function revisionSub_(s) {
  const hoy = new Date(), out = [];
  if (!s) return out;
  if (s[4] && new Date(s[4]) < hoy) out.push('su seguro vencio el ' + fecha_(s[4]));
  if (!s[4]) out.push('no tienes registrada la fecha de su seguro');
  if (requiereLicencia_(s[2])) {
    if (!String(s[8] || '').trim()) out.push(s[2] + ' requiere licencia estatal en Texas y no tiene una registrada');
    else if (s[9] && new Date(s[9]) < hoy) out.push('su licencia vencio el ' + fecha_(s[9]));
  }
  return out;
}

/** Alta o edicion de un subcontratista. Nunca se borra: su historial vive en ordenes y pagos. */
function duGuardarSub(token, s) {
  auth_(token);
  const nombre = String(s.nombre || '').trim();
  const oficio = String(s.oficio || '').trim();
  exigir_([[nombre, 'nombre'], [oficio, 'oficio']].concat(s.activo === false ? [] : [[s.telefono, 'teléfono']]));
  const dup = datos_(SH.SUBS).find(x => x[0] !== s.id &&
    String(x[1]).trim().toLowerCase() === nombre.toLowerCase());
  if (dup) throw new Error('Ya existe un subcontratista con ese nombre (' + dup[0] + '). ' +
    'Editalo en vez de darlo de alta dos veces, o su historial se parte en dos.');
  const f = v => v ? new Date(v + 'T12:00:00') : '';
  return conCandado_(function () {
    const id = s.id || nuevoId_(SH.SUBS, 'SUB', 2);
    const valores = [id, nombre, oficio, s.telefono || '', f(s.seguroVence),
                     s.activo === false ? 'NO' : 'SI', s.contacto || '', s.correo || '',
                     s.licencia || '', f(s.licenciaVence), s.w9 ? 'SI' : 'NO'];
    if (s.id) hoja_(SH.SUBS).getRange(fila_(SH.SUBS, s.id), 1, 1, 11).setValues([valores]);
    else hoja_(SH.SUBS).appendRow(valores);
    return { ok: true, id: id, avisos: revisionSub_(valores) };
  });
}

/** Baja logica: sus ordenes y pagos siguen intactos; solo deja de ofrecerse en ordenes nuevas. */
function duActivarSub(token, id, activo) {
  auth_(token);
  hoja_(SH.SUBS).getRange(fila_(SH.SUBS, id), 6).setValue(activo ? 'SI' : 'NO');
  const abiertas = datos_(SH.OT).filter(o => o[2] === id &&
    ['Emitida', 'Confirmada', 'Aprobada'].indexOf(o[8]) >= 0).length;
  marcarCambio_();
  return { ok: true, abiertas: abiertas };
}

/**
 * Orden de trabajo a un sub. Es el compromiso de costo de esa partida:
 * el costo de obra se reconoce aqui, no cuando sale el dinero.
 */
function duCrearOT(token, p) {
  auth_(token);
  exigir_([[p.obra, 'obra'], [p.sub, 'subcontratista'], [p.alcance, 'alcance'], [p.inicio, 'fecha de inicio'], [p.fin, 'fecha de fin']]);
  if (fechaLocal_(p.fin) < fechaLocal_(p.inicio)) throw new Error('La fecha de fin no puede ser antes del inicio.');
  if (!p.partida) throw new Error('Asigna la partida que cubre esta orden. Sin partida no hay costeo.');
  if (!(Number(p.precio) > 0)) throw new Error('La orden va con precio cerrado, no abierta.');
  const sub = datos_(SH.SUBS).find(x => x[0] === p.sub);
  const faltan = revisionSub_(sub);
  if (faltan.length && !p.forzar) {
    return { ok: false, confirmar: true,
      msg: 'Antes de mandar a ' + (sub ? sub[1] : 'este sub') + ' a la obra: ' + faltan.join('; ') +
           '. Si algo sale mal sin estos papeles, la responsabilidad cae en ti. Emitir la orden de todos modos?' };
  }
  const k = partirClave_(p.partida, p.obra);
  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.OT, 'OT', 4);
    hoja_(SH.OT).appendRow([
      nuevo, p.obra, p.sub, p.oficio, p.alcance, Number(p.precio) || 0,
      fechaLocal_(p.inicio), fechaLocal_(p.fin), 'Emitida', '', '', '', '', k.partida, k.area
    ]);
    return nuevo;
  });
  return { ok: true, id: id };
}

/** Cancelar una orden: deja de contar como costo comprometido de la obra. */
function duCancelarOT(token, otId) {
  auth_(token);
  const pagado = datos_(SH.PAGOS).filter(x => x[2] === otId)
    .reduce((a, x) => a + (Number(x[6]) || 0), 0);
  if (pagado > 0) throw new Error('Esa orden ya tiene pagos. Ajusta el alcance en vez de cancelarla.');
  hoja_(SH.OT).getRange(fila_(SH.OT, otId), 9).setValue('Cancelada');
  marcarCambio_();
  return { ok: true };
}

/**
 * Pago a subcontratista. SIEMPRE contra una orden de trabajo, nunca como gasto suelto.
 * Reglas que aplica:
 *  - anticipo solo si el sub ya confirmo por escrito
 *  - liquidacion solo si el PM ya aprobo el trabajo
 *  - no deja pagar por encima del precio cerrado sin confirmarlo
 */
function duPagoSub(token, p) {
  const email = auth_(token);
  const ot = datos_(SH.OT).find(o => o[0] === p.otId);
  if (!ot) throw new Error('Orden de trabajo no encontrada.');
  const monto = Number(p.monto) || 0;
  if (monto <= 0) throw new Error('Captura el monto del pago.');

  // Cada advertencia tiene su codigo y se confirma por separado. Antes, "pagar de todos modos"
  // no se respetaba en estas dos y volvia a preguntar para siempre.
  const acepta = c => p.forzar === true || (p.confirmado || []).indexOf(c) >= 0;
  if (p.concepto === 'Anticipo' && !ot[9] && !acepta('sinConfirmar')) {
    return { ok: false, confirmar: true, codigo: 'sinConfirmar',
      msg: 'Este sub todavia no confirma por escrito la orden ' + ot[0] +
           '. Un anticipo antes de la confirmacion es dinero sin compromiso. Pagar de todos modos?' };
  }
  if (p.concepto === 'Liquidacion' && !ot[11] && !acepta('sinAprobar')) {
    return { ok: false, confirmar: true, codigo: 'sinAprobar',
      msg: 'El PM todavia no aprueba el trabajo de la orden ' + ot[0] +
           '. La regla es que el sub cobra contra trabajo aprobado. Pagar de todos modos?' };
  }
  const sub = datos_(SH.SUBS).find(x => x[0] === ot[2]);
  const papeles = revisionSub_(sub).filter(t => t.indexOf('no tienes registrada') < 0);
  if (papeles.length && !acepta('papeles')) {
    return { ok: false, confirmar: true, codigo: 'papeles',
      msg: 'Sobre ' + sub[1] + ': ' + papeles.join('; ') +
           '. Pagarle asi te deja expuesto. Continuar?' };
  }
  const pagado = datos_(SH.PAGOS).filter(x => x[2] === p.otId)
    .reduce((a, x) => a + (Number(x[6]) || 0), 0);
  const precio = Number(ot[5]) || 0;
  if (pagado + monto > precio + 0.01 && !acepta('sobrepago')) {
    return { ok: false, confirmar: true, codigo: 'sobrepago',
      msg: 'Con este pago llevarias $' + (pagado + monto).toLocaleString('en-US') +
           ' contra una orden de $' + precio.toLocaleString('en-US') +
           '. Si es trabajo extra, va en una orden de cambio, no aqui. Continuar?' };
  }

  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.PAGOS, 'PAG', 4);
    hoja_(SH.PAGOS).appendRow([
      nuevo, new Date(), p.otId, ot[1], ot[2], p.concepto || 'Parcial', monto,
      p.metodo || 'Transferencia', p.referencia || '', email, new Date()
    ]);
    return nuevo;
  });
  if (pagado + monto >= precio - 0.01) {
    hoja_(SH.OT).getRange(fila_(SH.OT, p.otId), 9).setValue('Pagada');
  }
  marcarCambio_();
  return { ok: true, id: id, saldo: precio - (pagado + monto) };
}

// ------------------------------------------------- proceso 4: cambios y OC

/**
 * Crea la orden de cambio. Valida el margen minimo antes de dejarla pasar:
 * las OC deben cobrarse con margen igual o mayor al del contrato base.
 */
function duCrearOC(token, p) {
  const email = auth_(token);
  exigir_([[p.obra, 'obra'], [p.motivo, 'motivo'], [p.descripcion, 'descripción'], [p.hallazgo, 'fecha del hallazgo'], [p.costo, 'costo']]);
  const cfg = config_();
  const costo = Number(p.costo) || 0;
  const precio = Number(p.precio) || 0;
  if (precio <= 0) throw new Error('Captura el precio al cliente.');
  const margen = 1 - costo / precio;
  const minimo = Number(cfg['MARGEN_MINIMO_OC']) || 0;
  if (margen < minimo && !p.forzar) {
    return {
      ok: false, confirmar: true,
      msg: 'Esta OC sale con ' + (margen * 100).toFixed(1) + '% de margen, abajo de tu minimo de ' +
           (minimo * 100).toFixed(0) + '%. Precio sugerido: $' +
           Math.ceil(costo / (1 - minimo)) + '. Quieres emitirla de todos modos?'
    };
  }
  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.OC, 'OC', 4);
    hoja_(SH.OC).appendRow([
      nuevo, p.obra, fechaLocal_(p.hallazgo), p.motivo, p.descripcion, costo, precio, margen,
      Number(p.dias) || 0, 'Propuesta', new Date(), '', '', p.condicion || 'Al autorizar',
      p.foto || '', p.bloqueoId || '', email
    ]);
    return nuevo;
  });
  if (p.bloqueoId) {
    try { hoja_(SH.BLOQUEOS).getRange(fila_(SH.BLOQUEOS, p.bloqueoId), 13).setValue('SI'); } catch (e) {}
  }
  return { ok: true, id: id, margen: margen };
}

/** Propuesta -> Autorizada / Rechazada / Facturada. Sin firma, no se ejecuta. */
function duEstadoOC(token, id, estado) {
  auth_(token);
  const sh = hoja_(SH.OC);
  const f = fila_(SH.OC, id);
  sh.getRange(f, 10).setValue(estado);
  if (estado === 'Autorizada') sh.getRange(f, 12).setValue(new Date());
  if (estado === 'Facturada') sh.getRange(f, 13).setValue(new Date());
  marcarCambio_();
  return { ok: true };
}

/** Error propio: no es OC, es costo de no calidad. */
function duNoCalidad(token, p) {
  const email = auth_(token);
  exigir_([[p.obra, 'obra'], [p.descripcion, 'descripción'], [p.costo, 'costo']]);
  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.NC, 'NC', 4);
    hoja_(SH.NC).appendRow([
      nuevo, new Date(), p.obra, p.tipo || 'Retrabajo', p.causa, p.sub || '',
      Number(p.costo) || 0, Number(p.dias) || 0, p.descripcion || '',
      p.tipo === 'Garantia' ? 'Abierto' : 'Cerrado',
      p.tipo === 'Garantia' ? '' : new Date(), email
    ]);
    return nuevo;
  });
  return { ok: true, id: id };
}

/** Texto de la OC listo para copiar y mandar al cliente. */
function duTextoOC(token, id, lang) {
  auth_(token);
  const cfg = config_();
  const o = datos_(SH.OC).find(r => r[0] === id);
  if (!o) throw new Error('OC no encontrada.');
  const p = datos_(SH.PROYECTOS).find(r => r[0] === o[1]) || [];
  const previas = datos_(SH.OC).filter(r => r[1] === o[1] && r[0] < id &&
    ['Autorizada', 'Facturada'].indexOf(r[9]) >= 0)
    .reduce((a, r) => a + (Number(r[6]) || 0), 0);
  const nuevoTotal = (Number(p[10]) || 0) + previas + (Number(o[6]) || 0);
  const $ = n => '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  // el documento es para el CLIENTE: sale en el idioma que se eligio al copiarlo
  const en = lang === 'en';
  const motivo = en ? (porNombre_({ 'Condición oculta': 'Hidden condition', 'Solicitud del cliente': 'Client request',
                         'Cambio de selección': 'Selection change' }, o[3]) || o[3]) : o[3];
  const cond = o[13] || 'Al autorizar';
  const condicion = en ? ({ 'Al autorizar': 'On approval', '50% al autorizar': '50% on approval',
                            'Al siguiente hito': 'At next milestone' }[cond] || cond) : cond;
  const L = en ? {
    t: 'CHANGE ORDER', obra: 'Job', cli: 'Client', fecha: 'Date', mot: 'REASON', trab: 'WORK TO BE DONE',
    precio: 'PRICE', imp: '(tax included)', dias: 'SCHEDULE IMPACT', habiles: 'business days', pago: 'PAYMENT TERMS',
    total: 'NEW CONTRACT TOTAL', orig: 'Original contract', prev: 'Previous change orders', esta: 'This order',
    l1: 'This work will be scheduled only upon receipt of your signed approval.',
    l2: 'The rest of the job continues unaffected in unrelated areas.',
    firma: 'Approved by', f: 'Date', c: 'Client'
  } : {
    t: 'ORDEN DE CAMBIO', obra: 'Obra', cli: 'Cliente', fecha: 'Fecha', mot: 'MOTIVO', trab: 'TRABAJO A REALIZAR',
    precio: 'PRECIO', imp: '(impuesto incluido)', dias: 'IMPACTO EN FECHA', habiles: 'dias habiles', pago: 'CONDICION DE PAGO',
    total: 'NUEVO TOTAL DE CONTRATO', orig: 'Contrato original', prev: 'Ordenes de cambio previas', esta: 'Esta orden',
    l1: 'Este trabajo se programara unicamente al recibir su autorizacion firmada.',
    l2: 'El resto de la obra continua sin afectacion en las areas no relacionadas.',
    firma: 'Autorizo', f: 'Fecha', c: 'Cliente'
  };
  return [
    (cfg['EMPRESA'] || 'IJM') + ' - ' + L.t + ' ' + o[0],
    L.obra + ': ' + o[1] + '  |  ' + L.cli + ': ' + (p[1] || '') + '  |  ' + (p[3] || ''),
    L.fecha + ': ' + fecha_(o[10] || new Date()),
    '',
    L.mot + ': ' + motivo,
    '',
    L.trab,
    o[4],
    '',
    L.precio + ': ' + $(o[6]) + ' ' + L.imp,
    L.dias + ': +' + (Number(o[8]) || 0) + ' ' + L.habiles,
    L.pago + ': ' + condicion,
    '',
    L.total + ': ' + $(nuevoTotal),
    '   ' + L.orig + ': ' + $(p[10]),
    '   ' + L.prev + ': ' + $(previas),
    '   ' + L.esta + ': ' + $(o[6]),
    '',
    L.l1,
    L.l2,
    '',
    L.firma + ': ______________________________   ' + L.f + ': ____________',
    (p[1] || L.c)
  ].join('\n');
}

// ------------------------------------------------------------ detalle obra

function duDetalleObra(token, obraId) {
  auth_(token);
  const p = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (!p) throw new Error('Obra no encontrada.');
  const areas = areasDe_(obraId);
  const nombreArea = {};
  areas.forEach(a => { nombreArea[a.id] = a.nombre; });
  const cat = datos_(SH.PARTIDAS);
  const avance = datos_(SH.AVANCE).filter(r => r[2] === obraId)
    .map(r => ({ fila: r, area: areaFila_('Avance', r, obraId, r[3]) }));
  const partidas = [];
  areas.forEach(ar => {
    partidasDeArea_(ar, cat).forEach(c => {
      const regs = avance.filter(x => x.area === ar.id && x.fila[3] === c[2]).map(x => x.fila);
      let estado = 'Sin iniciar';
      if (regs.some(a => a[4] === 'Terminada')) estado = 'Terminada';
      else if (regs.some(a => a[4] === 'En progreso')) estado = 'En progreso';
      partidas.push({ area: ar.nombre, areaId: ar.id, partida: c[2], hito: c[3] || '', estado: estado, peso: pesoDe_(c) });
    });
  });
  const gastos = datos_(SH.GASTOS).filter(r => r[2] === obraId);
  const porCat = {};
  gastos.forEach(g => { porCat[g[3]] = (porCat[g[3]] || 0) + (Number(g[6]) || 0); });
  const tar = tarifas_();
  const mo = datos_(SH.MANO_OBRA).filter(r => r[2] === obraId);
  const porTrab = {}, porPartida = {};
  mo.forEach(r => {
    const t = tar[r[3]] || { nombre: r[3], tarifa: 0, puesto: '' };
    const h = Number(r[5]) || 0;
    const c = h * t.tarifa;
    if (!porTrab[r[3]]) porTrab[r[3]] = { nombre: t.nombre, puesto: t.puesto, horas: 0, costo: 0, unidad: t.porDia ? 'dias' : 'h' };
    porTrab[r[3]].horas += h; porTrab[r[3]].costo += c;
    const p = r[4] || '(sin partida)';
    if (!porPartida[p]) porPartida[p] = { horas: 0, costo: 0 };
    porPartida[p].horas += h; porPartida[p].costo += c;
  });
  const costoCuadrilla = costoMO_(mo, tar);
  const ocAut = datos_(SH.OC).filter(o => o[1] === obraId && ['Autorizada', 'Facturada'].indexOf(o[9]) >= 0);
  const montoOC = ocAut.reduce((a, o) => a + (Number(o[6]) || 0), 0);
  const contrato = (Number(p[10]) || 0) + montoOC;
  const materiales = gastos.reduce((a, g) => a + (Number(g[6]) || 0), 0);
  const otsObra = datos_(SH.OT).filter(o => o[1] === obraId && o[8] !== 'Cancelada');
  const subcontratos = otsObra.reduce((a, o) => a + (Number(o[5]) || 0), 0);
  const pagadoSub = datos_(SH.PAGOS).filter(x => x[3] === obraId)
    .reduce((a, x) => a + (Number(x[6]) || 0), 0);
  const gastado = materiales + costoCuadrilla + subcontratos;

  // Costo real por partida: los tres cubos juntos. Esto es lo que corrige tu catalogo.
  // la clave es AREA + partida: "Rough de plomería" del bano no se mezcla con la de la cocina
  const costoPartida = {};
  function suma(area, nombre, campo, monto) {
    const k = (area || '') + '|' + (nombre || '(sin asignar)');
    if (!costoPartida[k]) costoPartida[k] = { area: nombreArea[area] || '', areaId: area || '',
      partida: nombre || '(sin asignar)', material: 0, cuadrilla: 0, sub: 0, presupuesto: 0 };
    costoPartida[k][campo] += monto;
  }
  gastos.forEach(g => suma(areaFila_('Gastos', g, obraId, g[12]), g[12], 'material', Number(g[6]) || 0));
  mo.forEach(r => suma(areaFila_('Mano_Obra', r, obraId, r[4]), r[4], 'cuadrilla',
    (Number(r[5]) || 0) * ((tar[r[3]] || {}).tarifa || 0)));
  otsObra.forEach(o => suma(areaFila_('Ordenes_Trabajo', o, obraId, o[13]), o[13], 'sub', Number(o[5]) || 0));
  const cantDe = {};
  const presuObra = datos_(SH.PRESUPUESTO).filter(x => x[1] === obraId);     // para el total presupuestado
  const mapaE = mapaEtapas_(obraId), presuE = presupuestoPorEtapa_(obraId, mapaE);
  const costoPorEtapa = (function () {
    const out = {};
    const nueva = (ar, etapa) => ({ areaId: ar.id, area: ar.nombre, generales: !!ar.generales, etapa: etapa,
      material: 0, cuadrilla: 0, sub: 0, total: 0, presupuesto: presuE[ar.id + '|' + etapa] || 0, partidas: [],
      cantidad: ar.generales ? 1 : (ar.pies2 || 0), unidad: ar.generales ? 'lote' : 'pie²' });
    areas.forEach(ar => etapasDeArea_(ar).forEach(e => { out[ar.id + '|' + e.etapa] = nueva(ar, e.etapa); }));
    Object.keys(costoPartida).forEach(k => {
      const x = costoPartida[k], e = mapaE[x.areaId + '|' + x.partida] || SIN_ETAPA;
      const y = out[x.areaId + '|' + e] || (out[x.areaId + '|' + e] = nueva(areas.find(a => a.id === x.areaId) || { id: x.areaId, nombre: x.area }, e));
      const t = x.material + x.cuadrilla + x.sub;
      y.material += x.material; y.cuadrilla += x.cuadrilla; y.sub += x.sub; y.total += t;
      if (t) y.partidas.push({ partida: x.partida, total: t });
    });
    return Object.keys(out).map(k => {
      const y = out[k];
      y.partidas.sort((a, b) => b.total - a.total);
      y.desvio = y.presupuesto ? (y.total - y.presupuesto) / y.presupuesto : null;
      y.unitario = !y.generales && y.cantidad ? y.total / y.cantidad : null;
      y.unitarioPresu = !y.generales && y.cantidad && y.presupuesto ? y.presupuesto / y.cantidad : null;
      return y;
    }).filter(y => y.total || y.presupuesto);
  })();
  const cobrosObra = datos_(SH.COBROS).filter(c => c[2] === obraId);

  return {
    materiales: materiales, manoObra: costoCuadrilla,
    subcontratos: subcontratos, pagadoSub: pagadoSub, saldoSub: subcontratos - pagadoSub,
    areas: areas.map(a => ({ id: a.id, tipo: a.tipo, nombre: a.nombre, generales: a.generales,
                             pies2: a.pies2, lineales: a.lineales })),
    avance: avanceObra_(obraId),
    cronograma: (function () { const cr = cronogramaObra_(obraId); if (!cr) return null;
      const f = x => Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      return { planFin: fecha_(cr.planFin), prevFin: fecha_(cr.prevFin), filas: cr.filas.map(x => ({ area: x.areaNombre, partida: x.partida,
        quien: x.quien, estado: x.estado, planIni: f(x.planIni), planFin: f(x.planFin), ini: f(x.ini), fin: f(x.fin) })) }; })(),
    calidad: datos_(SH.CALIDAD).filter(c => c[2] === obraId).reverse().map(c => ({
      id: c[0], fecha: fecha_(c[1]), hito: c[3], partida: c[4], resultado: c[5],
      area: nombreArea[areaFila_('Calidad', c, obraId, c[4])] || '',
      ok: Number(c[6]) || 0, total: Number(c[7]) || 0, defectos: c[8], fotos: c[9],
      por: c[10], noAplica: String(c[13] || '')
    })),
    pruebas: datos_(SH.AGUA).filter(a => a[1] === obraId).map(a => ({
      id: a[0], area: nombreArea[a[9]] || '', inicio: fecha_(a[2]), fin: a[4] ? fecha_(a[4]) : '',
      horas: Number(a[6]) || 0, resultado: a[7],
      fotoInicio: a[3], fotoFin: a[5]
    })),
    punch: datos_(SH.PUNCH).filter(x => x[1] === obraId).map(x => ({
      id: x[0], fecha: fecha_(x[2]), item: x[3], origen: x[4], responsable: x[5],
      compromiso: fecha_(x[6]), estado: x[7], cierre: fecha_(x[8]),
      vencido: x[7] === 'Abierto' && x[6] && x[6] < new Date()
    })),
    entrega: (function () {
      const e = datos_(SH.ENTREGA).find(x => x[1] === obraId);
      if (!e) return null;
      return { id: e[0], fecha: fecha_(e[2]), meses: Number(e[3]) || 0, vence: fecha_(e[4]),
        fotos: String(e[5]).toUpperCase() === 'SI',
        resenaPedida: String(e[6]).toUpperCase() === 'SI',
        resena: String(e[7]).toUpperCase() === 'SI',
        referido: String(e[8]).toUpperCase() === 'SI',
        visita: String(e[9]).toUpperCase() === 'SI' };
    })(),
    garantia: datos_(SH.NC).filter(x => x[2] === obraId && x[3] === 'Garantia').map(x => ({
      id: x[0], fecha: fecha_(x[1]), causa: x[4], sub: x[5], costo: Number(x[6]) || 0,
      descripcion: x[8], estado: x[9], cierre: fecha_(x[10])
    })),
    presupuestado: presuObra.reduce((a, x) => a + (Number(x[3]) || 0), 0),
    cobrado: cobrosObra.reduce((a, c) => a + (Number(c[4]) || 0), 0),
    cobros: cobrosObra.map(c => ({ id: c[0], fecha: fecha_(c[1]), concepto: c[3],
      monto: Number(c[4]) || 0, metodo: c[5], referencia: c[6] })),
    costoPorPartida: Object.keys(costoPartida).map(k => {
      const x = costoPartida[k];
      x.total = x.material + x.cuadrilla + x.sub;
      x.desvio = x.presupuesto ? (x.total - x.presupuesto) / x.presupuesto : null;
      const c = cantDe[x.areaId + '|' + x.partida];
      x.cantidad = c ? c.cantidad : 0;
      x.unidad = c ? c.unidad : '';
      x.unitario = x.cantidad ? x.total / x.cantidad : null;
      x.unitarioPresu = x.cantidad && x.presupuesto ? x.presupuesto / x.cantidad : null;
      return x;
    }).sort((a, b) => (a.area < b.area ? -1 : a.area > b.area ? 1 : b.total - a.total)),
    cuadrillaPorTrabajador: Object.keys(porTrab).map(k => porTrab[k]).sort((a, b) => b.costo - a.costo),
    cuadrillaPorPartida: Object.keys(porPartida).map(k => ({
      partida: k, horas: porPartida[k].horas, costo: porPartida[k].costo
    })).sort((a, b) => b.costo - a.costo),
    id: p[0], cliente: p[1], direccion: p[3], tipo: etiquetaTipo_(obraId), estado: p[9],
    pies2: areas.filter(a => !a.generales).reduce((s, a) => s + a.pies2, 0),
    lineales: areas.filter(a => !a.generales).reduce((s, a) => s + a.lineales, 0),
    inicio: fecha_(p[6]), finEst: fecha_(p[7]),
    contratoOriginal: Number(p[10]) || 0, montoOC: montoOC, nOC: ocAut.length, contratoActual: contrato,
    gastado: gastado, margenActual: contrato ? 1 - gastado / contrato : 0,
    diasExtraOC: ocAut.reduce((a, o) => a + (Number(o[8]) || 0), 0),
    partidas: partidas,
    costoPorEtapa: costoPorEtapa,
    gastosPorCategoria: Object.keys(porCat).map(k => ({ categoria: k, monto: porCat[k] })),
    bitacora: datos_(SH.BITACORA).filter(r => r[2] === obraId).slice(-15).reverse().map(r => ({
      fecha: fecha_(r[1]), partidas: r[4], subs: r[5], incidencia: r[6], fotos: r[7],
      tardio: String(r[10]) === 'SI', enviado: fecha_(r[8]),
      fotosPendientes: String(r[11] || '').split(',').filter(Boolean).length
    })),
    gastos: gastos.slice(-20).reverse().map(g => ({
      id: g[0], fecha: fecha_(g[1]), categoria: g[3], proveedor: g[4],
      descripcion: g[5], monto: Number(g[6]) || 0, recibo: g[9], partida: g[12] || ''
    }))
  };
}

// -------------------------------------------- catalogo de partidas y cuadrilla

function filaPartida_(tipo, partida) {
  const v = hoja_(SH.PARTIDAS).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === tipo && String(v[i][2]) === partida) return i + 1;
  }
  return 0;
}

/**
 * Alta o edicion de una partida del catalogo.
 * El orden define la secuencia que ve el PM para reportar avance.
 */
function duGuardarPartida(token, p) {
  auth_(token);
  // antes de tocar el catalogo, las obras en curso se quedan con su lista actual
  congelarAreasDeTipo_(p.tipoOriginal || p.tipo); if (p.tipo) congelarAreasDeTipo_(p.tipo);
  // un nombre mal tecleado amarraria la partida a una inspeccion sin preguntas
  if (p.hito && !datos_(SH.CHECKLIST).some(r => r[0] === p.hito)) {
    throw new Error('Ese punto de control no existe. Crealo primero en Puntos de control de calidad.');
  }
  const tipo = String(p.tipo || '').trim();
  const partida = String(p.partida || '').trim();
  if (!tipo || !partida) throw new Error('Tipo de obra y nombre de la partida son obligatorios.');
  const sh = hoja_(SH.PARTIDAS);
  const original = String(p.partidaOriginal || '').trim();
  let fila = original ? filaPartida_(String(p.tipoOriginal || tipo), original) : filaPartida_(tipo, partida);
  if (!original && fila) throw new Error('Esa partida ya existe en ' + tipo + '.');
  const valores = [tipo, Number(p.orden) || 99, partida, p.hito || '', Number(p.peso) > 0 ? Number(p.peso) : 1,
    Number(p.dias) > 0 ? Number(p.dias) : 1, String(p.quien || '').trim() || 'Cuadrilla', p.paralelo ? 'SI' : '', Math.max(0, Number(p.espera) || 0),
    String(p.etapa || '').trim()];
  if (fila) {
    sh.getRange(fila, 1, 1, 10).setValues([valores]);
    if (original && original !== partida) renombrarPartida_(original, partida);
  } else {
    sh.appendRow(valores);
  }
  marcarCambio_();
  return { ok: true, id: tipo + '|' + partida };
}

/** Si se renombra una partida, se arrastra el historico para no romper el costeo. */
function renombrarPartida_(viejo, nuevo) {
  [[SH.AVANCE, 4], [SH.MANO_OBRA, 5]].forEach(par => {
    const sh = hoja_(par[0]);
    const col = par[1];
    const v = sh.getRange(2, col, Math.max(1, sh.getLastRow() - 1), 1).getValues();
    let cambios = false;
    for (let i = 0; i < v.length; i++) {
      if (String(v[i][0]) === viejo) { v[i][0] = nuevo; cambios = true; }
    }
    if (cambios) sh.getRange(2, col, v.length, 1).setValues(v);
  });
}

function duBorrarPartida(token, tipo, partida) {
  auth_(token);
  congelarAreasDeTipo_(tipo);
  const usada = datos_(SH.AVANCE).some(r => r[3] === partida) ||
                datos_(SH.MANO_OBRA).some(r => r[4] === partida);
  if (usada) {
    throw new Error('Esa partida ya tiene avance o mano de obra registrada. ' +
      'Renombrala en vez de borrarla, para no romper el historico de costos.');
  }
  const fila = filaPartida_(tipo, partida);
  if (!fila) throw new Error('Partida no encontrada.');
  hoja_(SH.PARTIDAS).deleteRow(fila);
  marcarCambio_();
  return { ok: true };
}

/** Copia la secuencia completa de un tipo de obra a otro, para arrancar rapido. */
/**
 * Tipo de obra nuevo, empezando en blanco: un piso de cemento, una lavanderia.
 * Las partidas llegan una por renglon. El peso total dice cuanto pesa el tipo en
 * el avance de una obra combinada (un bano completo suma 90) y se reparte parejo;
 * despues se afina partida por partida.
 */
function duCrearTipo(token, p) {
  auth_(token);
  const nombre = String(p.nombre || '').trim();
  if (!nombre) throw new Error('Escribe el nombre del nuevo tipo de obra.');
  if (nombre.toLowerCase() === 'generales') {
    throw new Error('"Generales" es el tipo que se crea solo en cada obra. Usa otro nombre.');
  }
  if (datos_(SH.PARTIDAS).some(r => String(r[0]).trim().toLowerCase() === nombre.toLowerCase())) {
    throw new Error('Ya existe un tipo de obra llamado ' + nombre + '.');
  }
  const lista = [];
  (p.partidas || []).forEach(x => {
    const t = String(x || '').trim();
    if (t && !lista.some(y => y.toLowerCase() === t.toLowerCase())) lista.push(t);
  });
  if (!lista.length) throw new Error('Escribe al menos una partida, una por renglon.');
  const total = Number(p.pesoTotal) > 0 ? Number(p.pesoTotal) : 50;
  const peso = Math.max(1, Math.round(total / lista.length));
  conCandado_(function () {
    const sh = hoja_(SH.PARTIDAS);
    sh.getRange(sh.getLastRow() + 1, 1, lista.length, 10)
      .setValues(lista.map((t, i) => [nombre, i + 1, t, '', peso, 1, 'Cuadrilla', '', 0, '']));
  });
  return { ok: true, n: lista.length, peso: peso };
}

function duClonarSecuencia(token, desde, hacia) {
  auth_(token);
  if (!hacia) throw new Error('Escribe el nombre del nuevo tipo de obra.');
  const origen = datos_(SH.PARTIDAS).filter(r => r[0] === desde);
  if (!origen.length) throw new Error('El tipo de obra origen no tiene partidas.');
  if (datos_(SH.PARTIDAS).some(r => r[0] === hacia)) {
    throw new Error('Ya existe un tipo de obra llamado ' + hacia + '.');
  }
  const sh = hoja_(SH.PARTIDAS);
  const filas = origen.map(r => [hacia, r[1], r[2], r[3] || '', pesoDe_(r), Number(r[5]) || 1, r[6] || 'Cuadrilla', r[7] || '', Number(r[8]) || 0, r[9] || '']);
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, 10).setValues(filas);
  marcarCambio_();
  return { ok: true, n: filas.length };
}

/** Alta, edicion o baja de un punto del checklist de calidad. */
function duGuardarPunto(token, p) {
  auth_(token);
  if (!p.hito || !p.punto) throw new Error('Hito y punto son obligatorios.');
  const sh = hoja_(SH.CHECKLIST);
  const v = sh.getDataRange().getValues();
  // PC1 a PC5 son los de fabrica. Un PC3 inventado exigiria prueba de inundacion a un piso de cemento.
  const existe = v.some((r, i) => i > 0 && r[0] === p.hito);
  if (!existe && /^PC[1-5]\b/i.test(String(p.hito).trim())) {
    throw new Error('PC1 a PC5 ya son los puntos de control de baño y cocina. ' +
                    'Usa otro nombre, por ejemplo "PC6 Pre-sellado".');
  }
  const fila = p.puntoOriginal
    ? (function () {
        for (let i = 1; i < v.length; i++)
          if (v[i][0] === p.hito && v[i][2] === p.puntoOriginal) return i + 1;
        return 0;
      })() : 0;
  const valores = [p.hito, Number(p.orden) || 99, p.punto, p.foto ? 'SI' : 'NO'];
  if (fila) sh.getRange(fila, 1, 1, 4).setValues([valores]);
  else sh.appendRow(valores);
  marcarCambio_();
  return { ok: true };
}

function duBorrarPunto(token, hito, punto) {
  auth_(token);
  const sh = hoja_(SH.CHECKLIST);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === hito && v[i][2] === punto) { sh.deleteRow(i + 1); marcarCambio_(); return { ok: true }; }
  }
  throw new Error('Punto no encontrado.');
}

/** Alta o edicion de un trabajador de la cuadrilla propia. */
function duGuardarTrabajador(token, t) {
  auth_(token);
  exigir_([[t.nombre, 'nombre']].concat(t.activo === false ? [] :
    [[['Por hora', 'Por dia'].indexOf(t.tipoPago) >= 0 ? 1 : '', 'tipo de pago'], [Number(t.tarifa) > 0 ? 1 : '', 'tarifa']]));
  const sh = hoja_(SH.TRABAJADORES);
  return conCandado_(function () {
    const valores = [t.id || nuevoId_(SH.TRABAJADORES, 'TRB', 2), t.nombre, t.puesto || '',
                     t.tipoPago || 'Por hora', Number(t.tarifa) || 0, t.telefono || '',
                     t.activo === false ? 'NO' : 'SI'];
    if (t.id) {
      sh.getRange(fila_(SH.TRABAJADORES, t.id), 1, 1, 7).setValues([valores]);
    } else {
      sh.appendRow(valores);
    }
    return { ok: true, id: valores[0] };
  });
}

/** Baja logica: se conserva el historico de horas trabajadas. */
function duBajaTrabajador(token, id) {
  auth_(token);
  hoja_(SH.TRABAJADORES).getRange(fila_(SH.TRABAJADORES, id), 7).setValue('NO');
  marcarCambio_();
  return { ok: true };
}

// ------------------------------------------------ presupuesto y cobranza

/** Lo que cotizaste por partida. Se captura una vez, en el traspaso. */
function duPresupuesto(token, obraId) {
  auth_(token);
  const p = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (!p) throw new Error('Obra no encontrada.');
  const areas = areasDe_(obraId);
  if (!areas.length) throw new Error('Esta obra no tiene areas. Corre migrarAreas o dalas de alta.');
  const cat = datos_(SH.PARTIDAS);
  const presu = presupuestoPorEtapa_(obraId, mapaEtapas_(obraId, cat));
  const hist = costosUnitarios_();
  return {
    obra: obraId, cliente: p[1], tipo: etiquetaTipo_(obraId), contrato: Number(p[10]) || 0,
    pies2: areas.filter(a => !a.generales).reduce((s, a) => s + a.pies2, 0),
    areas: areas.map(ar => ({
      id: ar.id, nombre: ar.nombre, tipo: ar.tipo, generales: ar.generales, pies2: ar.pies2, lineales: ar.lineales,
      etapas: etapasDeArea_(ar, cat).map(e => {
        const h = ar.generales ? null : hist[ar.tipo + '|' + e.etapa];
        return { etapa: e.etapa, partidas: e.partidas, monto: presu[ar.id + '|' + e.etapa] || 0,
                 historico: h ? { unitario: h.prom, n: h.n, sugerido: ar.pies2 ? Math.round(h.prom * ar.pies2) : 0 } : null };
      })
    })),
    total: Object.keys(presu).reduce((a, k) => a + presu[k], 0)
  };
}

function duGuardarPresupuesto(token, obraId, lineas) {
  auth_(token);
  const r = conCandado_(function () { return guardarPresupuesto_(obraId, lineas); });
  // completo = cada espacio con al menos una partida presupuestada: solo entonces puede arrancar
  delete _memo[SH.PRESUPUESTO];
  const c = presupuestoCompleto_(obraId);
  const fp = fila_(SH.PROYECTOS, obraId), est = hoja_(SH.PROYECTOS).getRange(fp, 10).getValue();
  if (c.ok && est === 'Sin presupuesto') hoja_(SH.PROYECTOS).getRange(fp, 10).setValue('Lista para arranque');
  if (!c.ok && est === 'Lista para arranque') hoja_(SH.PROYECTOS).getRange(fp, 10).setValue('Sin presupuesto');
  marcarCambio_();
  r.completo = c.ok; r.faltan = c.faltan;
  return r;
}

/*
 * Presupuesto completo: cada espacio de la obra con al menos una partida presupuestada. Sin eso no
 * hay desvio de estimacion ni costos unitarios, que es de donde aprendes a cotizar. Una obra
 * "Sin presupuesto" no puede arrancar: el PM la ve, pero no puede registrar su primer dia de trabajo.
 */
function presupuestoCompleto_(obraId) {
  const lineas = datos_(SH.PRESUPUESTO).filter(r => r[1] === obraId && Number(r[3]) > 0);
  const faltan = areasDe_(obraId).filter(a => !a.generales && !lineas.some(l => (l[7] || '') === a.id)).map(a => a.nombre);
  return { ok: faltan.length === 0 && lineas.length > 0, faltan: faltan };
}

function guardarPresupuesto_(obraId, lineas) {
  const cat = datos_(SH.PARTIDAS);
  const validas = {};
  areasDe_(obraId).forEach(ar => etapasDeArea_(ar, cat).forEach(e => { validas[ar.id + '|' + e.etapa] = ar; }));
  const mapa = mapaEtapas_(obraId, cat);
  const suma = {};
  (lineas || []).forEach(l => {
    const m = Number(l.monto) || 0;
    if (m < 0) throw new Error('Un monto no puede ser negativo.');
    if (!m) return;
    // tambien acepta el formato anterior (una partida): se suma a su etapa
    const area = l.area || (l.partida ? areaPorPartida_(obraId, l.partida) : '');
    const etapa = l.etapa || (l.partida ? mapa[area + '|' + l.partida] : '');
    if (!etapa || !validas[area + '|' + etapa]) throw new Error('"' + (l.etapa || l.partida || '') + '" no es una etapa de este espacio.');
    suma[area + '|' + etapa] = (suma[area + '|' + etapa] || 0) + m;
  });
  const sh = hoja_(SH.PRESUPUESTO);
  const v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) {            // limpia y reescribe
    if (v[i][1] === obraId) sh.deleteRow(i + 1);
  }
  let n = 0;
  const ult = sh.getLastRow();
  n = maxNum_(sh);
  const filas = Object.keys(suma).map(k => {
    const cut = k.indexOf('|'), ar = validas[k];
    n++;
    return ['PRE-' + String(n).padStart(4, '0'), obraId, k.slice(cut + 1), suma[k], '',
            ar.generales ? 1 : (ar.pies2 || 0), ar.generales ? 'lote' : 'pie2', k.slice(0, cut), 'Etapa'];
  });
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, 9).setValues(filas);
  return { ok: true, n: filas.length, total: filas.reduce((a, f) => a + f[3], 0) };
}

/** Cobro al cliente. Sin esto no existe "cobrado contra ejecutado". */
function duCobro(token, p) {
  const email = auth_(token);
  exigir_([[p.obra, 'obra'], [Number(p.monto) > 0 ? 1 : '', 'monto'], [p.concepto, 'concepto'], [p.metodo, 'método de pago']]);
  const monto = Number(p.monto) || 0;
  if (monto <= 0) throw new Error('Captura el monto del cobro.');
  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.COBROS, 'COB', 4);
    hoja_(SH.COBROS).appendRow([
      nuevo, new Date(), p.obra, p.concepto || 'Hito', monto,
      p.metodo || 'Transferencia', p.referencia || '', email, new Date()
    ]);
    return nuevo;
  });
  return { ok: true, id: id };
}

// -------------------------------------------------------- entrega y garantia

/** Acta de entrega. Arranca el reloj de la garantia y la cosecha comercial. */
function duEntrega(token, p) {
  const email = auth_(token);
  if (datos_(SH.ENTREGA).some(e => e[1] === p.obra)) {
    throw new Error('Esta obra ya tiene entrega registrada.');
  }
  const meses = Number(p.meses) || 12;
  const f = p.fecha ? new Date(p.fecha + 'T12:00:00') : new Date();
  const vence = new Date(f.getTime());
  vence.setMonth(vence.getMonth() + meses);
  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.ENTREGA, 'ENT', 4);
    hoja_(SH.ENTREGA).appendRow([
      nuevo, p.obra, f, meses, vence, p.fotos ? 'SI' : 'NO',
      'NO', 'NO', 'NO', 'NO', p.notas || '', email, new Date()
    ]);
    const fp = fila_(SH.PROYECTOS, p.obra);
    const est = hoja_(SH.PROYECTOS).getRange(fp, 10).getValue();
    if (['En obra', 'Lista para arranque', 'Sin presupuesto'].indexOf(est) >= 0) hoja_(SH.PROYECTOS).getRange(fp, 10).setValue('En cierre');
    return nuevo;
  });
  return { ok: true, id: id, vence: fecha_(vence) };
}

/** Cosecha comercial: dia 1 fotos, dia 3 resena, dia 7 referido, mes 11 visita. */
function duCosecha(token, obraId, campo, valor) {
  auth_(token);
  const col = { resenaPedida: 7, resena: 8, referido: 9, visita: 10 }[campo];
  if (!col) throw new Error('Campo invalido.');
  const sh = hoja_(SH.ENTREGA);
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][1] === obraId) {
      sh.getRange(i + 1, col).setValue(valor ? 'SI' : 'NO');
      marcarCambio_();
      return { ok: true };
    }
  }
  throw new Error('Esta obra no tiene entrega registrada.');
}

/** Reclamo de garantia. Es no calidad, con ciclo de vida propio. */
function duGarantia(token, p) {
  const email = auth_(token);
  exigir_([[p.obra, 'obra'], [p.descripcion, 'descripción del reclamo']]);
  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.NC, 'NC', 4);
    hoja_(SH.NC).appendRow([
      nuevo, new Date(), p.obra, 'Garantia', p.causa, p.sub || '',
      Number(p.costo) || 0, 0, p.descripcion || '', 'Abierto', '', email
    ]);
    return nuevo;
  });
  return { ok: true, id: id };
}

function duCerrarGarantia(token, ncId, costo) {
  auth_(token);
  const sh = hoja_(SH.NC);
  const f = fila_(SH.NC, ncId);
  if (costo !== undefined && costo !== null && costo !== '') {
    sh.getRange(f, 7).setValue(Number(costo) || 0);
  }
  sh.getRange(f, 10).setValue('Cerrado');
  sh.getRange(f, 11).setValue(new Date());
  marcarCambio_();
  return { ok: true };
}

/** Clasificar un detalle del punch list que resulto ser cambio de alcance. */
function duReclasificarPunch(token, punchId, origen) {
  auth_(token);
  hoja_(SH.PUNCH).getRange(fila_(SH.PUNCH, punchId), 5).setValue(origen);
  marcarCambio_();
  return { ok: true };
}

/**
 * Costo real por unidad, partida por partida, con TUS obras.
 * Solo cuenta partidas ya terminadas: una en curso subestimaria el costo.
 * Devuelve un mapa "tipoObra|partida" -> {prom, min, max, n, unidad}.
 */
function costosUnitarios_() {
  const tar = tarifas_();
  const cerradas = {};
  datos_(SH.CERRADAS).forEach(c => { cerradas[c[1]] = true; });
  // una etapa entra cuando todas sus partidas estan terminadas en SU espacio, o la obra ya cerro
  const terminadas = {};
  datos_(SH.AVANCE).filter(a => a[4] === 'Terminada')
    .forEach(a => { terminadas[areaFila_('Avance', a, a[2], a[3]) + '|' + a[3]] = true; });
  const real = {};
  function sumar(area, partida, monto) { if (partida && area) real[area + '|' + partida] = (real[area + '|' + partida] || 0) + monto; }
  datos_(SH.GASTOS).forEach(g => sumar(areaFila_('Gastos', g, g[2], g[12]), g[12], Number(g[6]) || 0));
  datos_(SH.MANO_OBRA).forEach(m => sumar(areaFila_('Mano_Obra', m, m[2], m[4]), m[4],
    (Number(m[5]) || 0) * ((tar[m[3]] || {}).tarifa || 0)));
  datos_(SH.OT).filter(o => o[8] !== 'Cancelada')
    .forEach(o => sumar(areaFila_('Ordenes_Trabajo', o, o[1], o[13]), o[13], Number(o[5]) || 0));
  const cat = datos_(SH.PARTIDAS), acum = {}, obras = {};
  datos_(SH.PRESUPUESTO).forEach(x => { obras[x[1]] = true; });
  Object.keys(obras).forEach(obra => {
    const presu = presupuestoPorEtapa_(obra, mapaEtapas_(obra, cat));
    areasDe_(obra).filter(ar => !ar.generales && ar.pies2 > 0).forEach(ar => etapasDeArea_(ar, cat).forEach(e => {
      if (!cerradas[obra] && !e.partidas.every(pp => terminadas[ar.id + '|' + pp])) return;
      const costo = e.partidas.reduce((s, pp) => s + (real[ar.id + '|' + pp] || 0), 0);
      if (!costo) return;
      const k = ar.tipo + '|' + e.etapa;
      if (!acum[k]) acum[k] = { vals: [], etapa: e.etapa, tipo: ar.tipo };
      acum[k].vals.push({ u: costo / ar.pies2, obra: obra, cant: ar.pies2, costo: costo,
                          presupuesto: (presu[ar.id + '|' + e.etapa] || 0) / ar.pies2 });
    }));
  });
  const out = {};
  Object.keys(acum).forEach(k => {
    const v = acum[k].vals.map(x => x.u);
    out[k] = {
      partida: acum[k].etapa, etapa: acum[k].etapa, tipo: acum[k].tipo, unidad: 'pie²',
      n: v.length, prom: v.reduce((a, b) => a + b, 0) / v.length,
      min: Math.min.apply(null, v), max: Math.max.apply(null, v),
      promPresupuesto: acum[k].vals.reduce((a, x) => a + x.presupuesto, 0) / v.length,
      detalle: acum[k].vals
    };
  });
  return out;
}

/** El catalogo listo para leerse: tus precios unitarios reales. */
function duCostosUnitarios(token) {
  auth_(token);
  const m = costosUnitarios_();
  return Object.keys(m).map(k => {
    const x = m[k];
    return { tipo: x.tipo, partida: x.partida, unidad: x.unidad, n: x.n,
             prom: x.prom, min: x.min, max: x.max, promPresupuesto: x.promPresupuesto,
             desvio: x.promPresupuesto ? (x.prom - x.promPresupuesto) / x.promPresupuesto : null };
  }).sort((a, b) => (a.tipo + a.partida < b.tipo + b.partida ? -1 : 1));
}

// ---------------------------------------------------- cierre formal de obra

/** Revision previa al cierre: que no se cierre una obra con dinero en la mesa. */
function duPreCierre(token, obraId) {
  auth_(token);
  const p = datos_(SH.PROYECTOS).find(r => r[0] === obraId);
  if (!p) throw new Error('Obra no encontrada.');
  const tar = tarifas_();
  const gastos = datos_(SH.GASTOS).filter(g => g[2] === obraId);
  const mo = datos_(SH.MANO_OBRA).filter(m => m[2] === obraId);
  const ots = datos_(SH.OT).filter(o => o[1] === obraId && o[8] !== 'Cancelada');
  const pagos = datos_(SH.PAGOS).filter(x => x[3] === obraId);
  const ocs = datos_(SH.OC).filter(o => o[1] === obraId);
  const cobros = datos_(SH.COBROS).filter(c => c[2] === obraId);
  const nc = datos_(SH.NC).filter(x => x[2] === obraId);
  const presu = datos_(SH.PRESUPUESTO).filter(x => x[1] === obraId);

  const materiales = gastos.reduce((a, g) => a + (Number(g[6]) || 0), 0);
  const cuadrilla = costoMO_(mo, tar);
  const subs = ots.reduce((a, o) => a + (Number(o[5]) || 0), 0);
  const costo = materiales + cuadrilla + subs;
  const montoOC = ocs.filter(o => ['Autorizada', 'Facturada'].indexOf(o[9]) >= 0)
    .reduce((a, o) => a + (Number(o[6]) || 0), 0);
  const contratoFinal = (Number(p[10]) || 0) + montoOC;
  const cobrado = cobros.reduce((a, c) => a + (Number(c[4]) || 0), 0);
  const presupuestado = presu.reduce((a, x) => a + (Number(x[3]) || 0), 0);
  const pagadoSub = pagos.reduce((a, x) => a + (Number(x[6]) || 0), 0);

  const avisos = [];
  if (contratoFinal - cobrado > 1)
    avisos.push({ g: 'alto', t: 'Faltan ' + $$(contratoFinal - cobrado) + ' por cobrarle al cliente' });
  if (ocs.some(o => o[9] === 'Propuesta'))
    avisos.push({ g: 'alto', t: 'Hay órdenes de cambio sin autorizar' });
  if (ocs.some(o => o[9] === 'Autorizada'))
    avisos.push({ g: 'alto', t: 'Hay órdenes de cambio autorizadas sin facturar' });
  if (subs - pagadoSub > 1)
    avisos.push({ g: 'medio', t: 'Faltan ' + $$(subs - pagadoSub) + ' por pagarle a subs' });
  if (ots.some(o => !o[11]))
    avisos.push({ g: 'medio', t: 'Hay órdenes de trabajo que el PM nunca aprobó' });
  if (gastos.some(g => !g[9]))
    avisos.push({ g: 'medio', t: gastos.filter(g => !g[9]).length + ' cargos sin foto de recibo' });
  if (!presupuestado)
    avisos.push({ g: 'medio', t: 'Sin presupuesto por etapa: esta obra no va a poder medir precisión de estimación' });
  if (gastos.some(g => !g[12]) || mo.some(m => !m[4]))
    avisos.push({ g: 'bajo', t: 'Hay costos sin partida asignada' });
  const cal = datos_(SH.CALIDAD).filter(c => c[2] === obraId);
  const punchAb = datos_(SH.PUNCH).filter(x => x[1] === obraId && x[7] === 'Abierto');
  const entregada = datos_(SH.ENTREGA).some(e => e[1] === obraId);
  // cada area con sus hitos: aprobar PC2 del bano no aprueba PC2 de la cocina
  const catH = datos_(SH.PARTIDAS);
  const calA = cal.map(c => ({ area: areaFila_('Calidad', c, obraId, c[4]), hito: c[3], res: c[5] }));
  const faltan = [];
  areasDe_(obraId).forEach(ar => {
    partidasDeArea_(ar, catH).filter(x => x[3]).map(x => x[3])
      .filter((v, i, a) => a.indexOf(v) === i)
      .forEach(h => {
        const insp = calA.filter(c => c.area === ar.id && c.hito === h);
        const ult = insp.length ? insp[insp.length - 1] : null;
        if (!ult || ult.res !== 'Aprobado') faltan.push(ar.nombre + ' ' + h.split(' ')[0]);
      });
  });
  if (faltan.length)
    avisos.push({ g: 'medio', t: 'Puntos de control sin aprobar: ' + faltan.join(', ') });
  if (!entregada)
    avisos.push({ g: 'alto', t: 'La entrega al cliente no esta registrada' });
  if (punchAb.length)
    avisos.push({ g: 'medio', t: punchAb.length + ' pendientes del punch list sin cerrar' });
  // partidas sin terminar: antes una obra podia cerrarse al 93% sin ningun aviso
  const term = {};
  datos_(SH.AVANCE).filter(r => r[2] === obraId && r[4] === 'Terminada')
    .forEach(r => { term[areaFila_('Avance', r, obraId, r[3]) + '|' + r[3]] = true; });
  const sinTerminar = [];
  areasDe_(obraId).forEach(ar => partidasDeArea_(ar).forEach(c => {
    if (!term[ar.id + '|' + c[2]]) sinTerminar.push({ area: ar.id, areaNombre: ar.nombre, partida: c[2] });
  }));
  if (sinTerminar.length) avisos.push({ g: 'alto', t: sinTerminar.length + ' partida(s) sin terminar: ' +
    sinTerminar.slice(0, 4).map(x => x.areaNombre + ' · ' + x.partida).join(', ') + (sinTerminar.length > 4 ? '…' : '') +
    '. Termínalas, o quítalas si no se hicieron en esta obra.' });
  const aguasObra = datos_(SH.AGUA).filter(a => a[1] === obraId && a[7] === 'Sin fugas');
  areasDe_(obraId).filter(a => esBano_(a.tipo)).forEach(ar => {
    if (!aguasObra.some(a => (a[9] || ar.id) === ar.id))
      avisos.push({ g: 'alto', t: 'No hay prueba de inundacion documentada en ' + ar.nombre });
  });

  return {
    obra: obraId, cliente: p[1], tipo: etiquetaTipo_(obraId),
    inicio: fecha_(p[6]), sinTerminar: sinTerminar, avance: avanceObra_(obraId).pct,
    dias: p[6] ? Math.max(1, Math.round((new Date() - p[6]) / 86400000)) : 0,
    contratoOriginal: Number(p[10]) || 0, montoOC: montoOC, contratoFinal: contratoFinal,
    presupuestado: presupuestado, materiales: materiales, cuadrilla: cuadrilla, subcontratos: subs,
    costo: costo, cobrado: cobrado,
    margen: contratoFinal ? (contratoFinal - costo) / contratoFinal : 0,
    desviacion: presupuestado ? (costo - presupuestado) / presupuestado : null,
    noCalidad: nc.reduce((a, x) => a + (Number(x[5]) || 0), 0),
    diasReportados: datos_(SH.BITACORA).filter(b => b[2] === obraId).length,
    avisos: avisos
  };
}

function $$(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }

/** Congela la obra en el historico y la saca del tablero. */
function duCerrarObra(token, obraId, fechaFin) {
  const email = auth_(token);
  const r = duPreCierre(token, obraId);
  const ent = datos_(SH.ENTREGA).find(e => e[1] === obraId);
  // dias de ciclo = del arranque a la entrega (acta), no al dia del cobro final
  const fin = ent && ent[2] ? new Date(ent[2]) : (fechaFin ? new Date(fechaFin + 'T12:00:00') : new Date());
  const p = datos_(SH.PROYECTOS).find(x => x[0] === obraId);
  const ini = p[6];
  const dias = ini ? Math.max(1, Math.round((fin - ini) / 86400000)) : 0;
  const nombrePM = (datos_(SH.USUARIOS).find(u =>
    String(u[0]).toLowerCase() === String(p[5]).toLowerCase()) || [])[2] || p[5];

  const id = conCandado_(function () {
    const nuevo = nuevoId_(SH.CERRADAS, 'CIE', 4);
    hoja_(SH.CERRADAS).appendRow([
      nuevo, obraId, p[1], etiquetaTipo_(obraId), nombrePM, ini, fin, dias,
      r.contratoOriginal, r.montoOC, r.contratoFinal, r.presupuestado,
      r.materiales, r.cuadrilla, r.subcontratos, r.costo,
      r.margen, r.desviacion === null ? '' : r.desviacion,
      r.cobrado, r.noCalidad, r.diasReportados, email, new Date(),
      areasDe_(obraId).filter(a => !a.generales).reduce((s, a) => s + a.pies2, 0)
    ]);
    return nuevo;
  });
  const f = fila_(SH.PROYECTOS, obraId);
  hoja_(SH.PROYECTOS).getRange(f, 9).setValue(fin);
  hoja_(SH.PROYECTOS).getRange(f, 10).setValue('Entregada');
  marcarCambio_();
  return { ok: true, id: id, margen: r.margen, desviacion: r.desviacion, dias: dias };
}

// ------------------------------------------------------ historico y tendencia

function duHistorico(token) {
  auth_(token);
  const c = datos_(SH.CERRADAS);
  const obras = c.map(r => ({
    id: r[0], obra: r[1], cliente: r[2], tipo: r[3], pm: r[4],
    inicio: fecha_(r[5]), fin: fecha_(r[6]),
    mes: r[6] ? Utilities.formatDate(r[6], Session.getScriptTimeZone(), 'yyyy-MM') : '',
    dias: Number(r[7]) || 0,
    contrato: Number(r[10]) || 0, presupuestado: Number(r[11]) || 0,
    materiales: Number(r[12]) || 0, cuadrilla: Number(r[13]) || 0, subs: Number(r[14]) || 0,
    costo: Number(r[15]) || 0, margen: Number(r[16]) || 0,
    desviacion: r[17] === '' ? null : Number(r[17]),
    cobrado: Number(r[18]) || 0, noCalidad: Number(r[19]) || 0,
    pies2: Number(r[23]) || 0,
    costoPie: Number(r[23]) ? (Number(r[15]) || 0) / Number(r[23]) : null,
    ventaPie: Number(r[23]) ? (Number(r[10]) || 0) / Number(r[23]) : null
  })).sort((a, b) => (a.mes < b.mes ? 1 : -1));

  function prom(arr, campo) {
    const v = arr.map(x => x[campo]).filter(x => x !== null && isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  function agrupar(clave) {
    const g = {};
    obras.forEach(o => { (g[o[clave]] = g[o[clave]] || []).push(o); });
    return Object.keys(g).sort().map(k => ({
      k: k, n: g[k].length,
      margen: prom(g[k], 'margen'),
      desviacion: prom(g[k], 'desviacion'),
      dias: prom(g[k], 'dias'),
      costoPie: prom(g[k], 'costoPie'), ventaPie: prom(g[k], 'ventaPie'),
      contrato: g[k].reduce((a, x) => a + x.contrato, 0),
      costo: g[k].reduce((a, x) => a + x.costo, 0),
      noCalidad: g[k].reduce((a, x) => a + x.noCalidad, 0),
      cobrado: g[k].reduce((a, x) => a + x.cobrado, 0)
    }));
  }

  const mesesOrden = agrupar('mes');
  const ult3 = obras.slice(0, 3), prev3 = obras.slice(3, 6);
  function delta(campo) {
    const a = prom(ult3, campo), b = prom(prev3, campo);
    return (a === null || b === null) ? null : a - b;
  }

  const gar = datos_(SH.NC).filter(x => x[3] === 'Garantia');
  const ent = datos_(SH.ENTREGA);
  obras.forEach(o => {
    const g = gar.filter(x => x[2] === o.obra);
    const e = ent.find(x => x[1] === o.obra);
    o.reclamos = g.length;
    o.costoGarantia = g.reduce((a, x) => a + (Number(x[6]) || 0), 0);
    o.resena = e ? String(e[7]).toUpperCase() === 'SI' : false;
    o.garantiaVence = e ? fecha_(e[4]) : '';
  });

  return {
    obras: obras,
    garantiaAbierta: gar.filter(x => x[9] === 'Abierto').map(x => ({
      id: x[0], obra: x[2], fecha: fecha_(x[1]), causa: x[4], descripcion: x[8],
      costo: Number(x[6]) || 0, dias: Math.floor((new Date() - x[1]) / 86400000)
    })),
    resumen2: {
      reclamos: gar.length, costoGarantia: gar.reduce((a, x) => a + (Number(x[6]) || 0), 0),
      resenas: ent.filter(e => String(e[7]).toUpperCase() === 'SI').length,
      entregas: ent.length
    },
    meses: mesesOrden,
    tipos: agrupar('tipo'),
    total: obras.length,
    resumen: {
      margen: prom(obras, 'margen'), desviacion: prom(obras, 'desviacion'),
      dias: prom(obras, 'dias'),
      costoPie: prom(obras, 'costoPie'), ventaPie: prom(obras, 'ventaPie'),
      contrato: obras.reduce((a, x) => a + x.contrato, 0),
      noCalidad: obras.reduce((a, x) => a + x.noCalidad, 0),
      cobrado: obras.reduce((a, x) => a + x.cobrado, 0),
      dMargen: delta('margen'), dDesviacion: delta('desviacion'), dDias: delta('dias')
    }
  };
}

// --------------------------------------------- correcciones del dueno (sin limite)

function duCorregir(token, hoja, id, cambios, motivo) {
  const email = auth_(token);
  if (hoja === 'Mano_Obra' && cambios && 'horas' in cambios) {
    const m = datos_(SH.MANO_OBRA).find(r => r[0] === id);
    if (m) validarHoras_(m[3], m[1], cambios.horas, id);
  }
  const r = aplicarCorreccion_(email, hoja, id, cambios, motivo, 0, false);
  marcarCambio_();
  return r;
}

function duAnular(token, hoja, id, motivo) {
  const r = aplicarAnulacion_(auth_(token), hoja, id, motivo, 0, false);
  marcarCambio_();
  return r;
}

/** Rastro de auditoria: quien cambio que, cuando y por que. */
function duCorrecciones(token) {
  auth_(token);
  return datosTodos_('Correcciones').slice(-80).reverse().map(r => ({
    id: r[0], fecha: fecha_(r[1]), usuario: r[2], hoja: r[3], registro: r[4],
    accion: r[5], campo: r[6], antes: r[7], despues: r[8], motivo: r[9]
  }));
}

/**
 * Alta de obra con sus areas. Siempre nace con "Generales de obra" (permisos,
 * contenedor, proteccion, limpieza final: lo que es del proyecto y no de un
 * espacio) mas un area por cada espacio que se va a remodelar.
 */
function duNuevaObra(token, p) {
  auth_(token);
  const esp = (p.areas || []).filter(a => a.tipo && a.tipo !== 'Generales');
  // los datos sin los que la obra no funciona: sin PM nadie la ve, sin contrato no hay margen,
  // sin fechas no hay cronograma ni atraso, sin pies cuadrados no hay costos unitarios
  exigir_([[p.cliente, 'cliente'], [p.telefono, 'teléfono del cliente'], [p.direccion, 'dirección'], [p.pm, 'PM'],
           [p.inicio, 'fecha de inicio'], [p.finEst, 'fecha de entrega'], [Number(p.contrato) > 0 ? 1 : '', 'monto del contrato']]);
  if (String(p.telefono).replace(/\D/g, '').length < 10) throw new Error('El teléfono del cliente debe tener al menos 10 dígitos.');
  if (!datos_(SH.USUARIOS).some(u => String(u[0]).toLowerCase() === String(p.pm).toLowerCase() && String(u[3]) === 'pm' &&
      String(u[6]).toUpperCase() === 'SI')) throw new Error('Ese PM no existe o no está activo.');
  if (fechaLocal_(p.finEst) < fechaLocal_(p.inicio)) throw new Error('La fecha de entrega no puede ser antes del inicio.')
  if (!esp.length) throw new Error('Agrega al menos un espacio: baño, cocina, closet...');
  esp.forEach(a => { if (!String(a.nombre || '').trim()) a.nombre = a.tipo; });
  const sinPies = esp.filter(a => !(Number(a.pies2) > 0)).map(a => 'pies² de ' + a.nombre);
  if (sinPies.length) throw new Error('Faltan: ' + sinPies.join(', ') + '.');
  // el mismo cliente en la misma direccion: casi siempre es un doble clic
  const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dup = datos_(SH.PROYECTOS).find(r => r[9] !== 'Entregada' && norm(r[1]) === norm(p.cliente) && norm(r[3]) === norm(p.direccion));
  if (dup && (p.confirmado || []).indexOf('duplicada') < 0) {
    return { confirmar: true, codigo: 'duplicada', msg: 'Ya hay una obra activa de ' + dup[1] + ' en esa dirección (' + dup[0] + '). ¿Crear otra de todos modos?' };
  }
  const tipos = esp.map(a => a.tipo).filter((v, i, arr) => arr.indexOf(v) === i);

  return conCandado_(function () {
    const id = nuevoId_(SH.PROYECTOS, 'OB', 3);
    hoja_(SH.PROYECTOS).appendRow([
      id, p.cliente, p.telefono || '', p.direccion, tipos.join(' + '), p.pm,
      fechaLocal_(p.inicio), fechaLocal_(p.finEst), '', 'Sin presupuesto',      // arranca hasta tener presupuesto
      Number(p.contrato) || 0, p.notas || ''
    ]);
    const sh = hoja_(SH.AREAS);
    let n = 0;
    if (sh.getLastRow() > 1) {
      n = maxNum_(sh);
    }
    const filas = [['AR-' + String(++n).padStart(4, '0'), id, 'Generales', 'Generales de obra', 0, 0, 0]];
    esp.forEach((a, i) => filas.push(['AR-' + String(++n).padStart(4, '0'), id, a.tipo,
      a.nombre || a.tipo, Number(a.pies2) || 0, Number(a.lineales) || 0, i + 1]));
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, 7).setValues(filas);
    filas.forEach(f => copiarPartidasAArea_(f[0], id, f[2]));     // cada espacio con su propia lista
    return { ok: true, id: id, areas: filas.length };
  });
}

/** Agregar un espacio a una obra ya creada (el cliente decidio sumar el closet). */
function duAgregarArea(token, obraId, a) {
  auth_(token);
  if (!a.tipo || a.tipo === 'Generales') throw new Error('Elige el tipo del espacio.');
  if (obraCerrada_(obraId)) throw new Error('Esa obra ya esta cerrada.');
  return conCandado_(function () {
    const sh = hoja_(SH.AREAS);
    let n = 0;
    if (sh.getLastRow() > 1) {
      n = maxNum_(sh);
    }
    const orden = areasDe_(obraId).length;
    const id = 'AR-' + String(n + 1).padStart(4, '0');
    sh.appendRow([id, obraId, a.tipo, a.nombre || a.tipo, Number(a.pies2) || 0,
                  Number(a.lineales) || 0, orden]);
    copiarPartidasAArea_(id, obraId, a.tipo);
    delete _memo[SH.AREAS];
    const f = fila_(SH.PROYECTOS, obraId);
    hoja_(SH.PROYECTOS).getRange(f, 5).setValue(etiquetaTipo_(obraId));
    return { ok: true, id: id };
  });
}

/**
 * MIGRACION, se corre UNA vez desde el editor de Apps Script si ya tenias obras
 * antes de que existieran las areas. Crea Generales + un area del tipo de cada
 * obra, y asigna area a cada registro que no la tenga. Es idempotente: correrla
 * dos veces no duplica nada.
 */
function migrarAreas() {
  const sh = hoja_(SH.AREAS);
  const proys = datos_(SH.PROYECTOS);
  let n = 0;
  if (sh.getLastRow() > 1) {
    n = maxNum_(sh);
  }
  const nuevas = [];
  proys.forEach(p => {
    if (datos_(SH.AREAS).some(a => a[1] === p[0])) return;
    const tipo = enLista_(['Baño', 'Cocina', 'Closet'], p[4]) ? p[4] : 'Baño';
    nuevas.push(['AR-' + String(++n).padStart(4, '0'), p[0], 'Generales', 'Generales de obra', 0, 0, 0]);
    nuevas.push(['AR-' + String(++n).padStart(4, '0'), p[0], tipo, tipo, Number(p[12]) || 0,
                 Number(p[13]) || 0, 1]);
  });
  if (nuevas.length) sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, 7).setValues(nuevas);
  delete _memo[SH.AREAS];

  const hojas = { 'Presupuesto': [1, 2], 'Avance': [2, 3], 'Gastos': [2, 12], 'Mano_Obra': [2, 4],
                  'Ordenes_Trabajo': [1, 13], 'Calidad': [2, 4], 'Pruebas_Agua': [1, -1] };
  let asignados = 0;
  Object.keys(hojas).forEach(h => {
    const hs = hoja_(h);
    const v = hs.getDataRange().getValues();
    const col = COL_AREA[h];
    for (let i = 1; i < v.length; i++) {
      if (!v[i][0] || v[i][col]) continue;
      const obra = v[i][hojas[h][0]];
      const partida = hojas[h][1] >= 0 ? v[i][hojas[h][1]] : '';
      const area = h === 'Pruebas_Agua'
        ? ((areasDe_(obra).find(a => esBano_(a.tipo)) || {}).id || '')
        : areaPorPartida_(obra, partida);
      if (area) { hs.getRange(i + 1, col + 1).setValue(area); asignados++; }
    }
  });
  Logger.log('Areas creadas: ' + nuevas.length + ' · registros asignados: ' + asignados);
  return { areas: nuevas.length, registros: asignados };
}

// ------------------------------------------------------ velocidad: el Inicio en memoria, y guardar y ver en un viaje
/*
 * Tu Inicio lee unas 30 veces la hoja. Si nada cambio (mismo sello) y seguimos en la misma hora, se sirve
 * de la memoria del servidor. La hora cuenta porque hay indicadores que dependen del reloj (recibos a 72 h,
 * atrasos, "sin cierre hoy"). El sello se lee ANTES de calcular: si alguien guarda mientras tanto, la
 * siguiente carga ya ve otro sello y recalcula.
 */
function duDatos(token) {
  const email = auth_(token);
  const clave = 'dud_' + String(email).toLowerCase();
  const version = String(selloActual_()) + '|' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH');
  const c = leerCache_(clave);
  if (c && c.version === version) return c.d;
  const d = calcularDatos_(token);
  guardarCache_(clave, { version: version, d: d });
  return d;
}

function guardarCache_(clave, obj) {
  try {
    const s = JSON.stringify(obj), n = Math.ceil(s.length / CACHE_TROZO_), o = {};
    for (let i = 0; i < n; i++) o[clave + '_' + i] = s.slice(i * CACHE_TROZO_, (i + 1) * CACHE_TROZO_);
    o[clave + '_n'] = String(n);
    CacheService.getScriptCache().putAll(o, 900);
  } catch (e) { /* sin memoria solo es mas lento, nunca incorrecto */ }
}

function leerCache_(clave) {
  try {
    const c = CacheService.getScriptCache(), n = Number(c.get(clave + '_n'));
    if (!n) return null;
    const ks = [];
    for (let i = 0; i < n; i++) ks.push(clave + '_' + i);
    const t = c.getAll(ks);
    if (ks.some(k => t[k] === undefined || t[k] === null)) return null;
    return JSON.parse(ks.map(k => t[k]).join(''));
  } catch (e) { return null; }
}

/*
 * Guardar y ver en un solo viaje: ejecuta la accion (con sus validaciones y su registro de errores, igual que
 * si se llamara directo) y en el mismo viaje regresa lo que estas viendo: la obra, o tu Inicio. Solo acepta
 * las acciones de la lista: no abre ninguna puerta que no existiera.
 */
function duHacer(token, fn, args, verObra, verInicio) {
  auth_(token);
  if (HACER_ADMIN_.indexOf(fn) < 0) throw new Error('Esa acción no se puede hacer así.');
  const g = (function () { return this; })() || globalThis;
  const r = g[fn].apply(null, [token].concat(args || []));
  for (const k in _memo) delete _memo[k];                  // lo recien escrito se vuelve a leer
  const out = { r: r };
  if (verObra) { try { out.det = duDetalleObra(token, verObra); } catch (e) { out.det = null; } }
  if (verInicio) out.d = duDatos(token);
  return out;
}

/** Pide foto solo en los puntos criticos. Toca unicamente los puntos de la plantilla: los que agregaste tu no. */
function duFotosCriticas(token) {
  auth_(token);
  const sh = hoja_(SH.CHECKLIST), v = sh.getDataRange().getValues();
  let cambiados = 0, criticos = 0;
  for (let i = 1; i < v.length; i++) {
    const p = String(v[i][2] || '').trim();
    if (!enLista_(PUNTOS_ESTANDAR_, p)) continue;
    const f = enLista_(FOTO_CRITICA_, p) ? 'SI' : 'NO';
    if (f === 'SI') criticos++;
    if (String(v[i][3]).toUpperCase() !== f) { sh.getRange(i + 1, 4).setValue(f); cambiados++; }
  }
  marcarCambio_();
  return { ok: true, cambiados: cambiados, criticos: criticos };
}

// admin/final.js
// Solo de la app del administrador. Lo compartido está en comun/. Después de editar, corre construir.py.

// al final de todo: cada funcion publica registra sus errores inesperados
envolverPublicas_('du');
