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
