// pm/config.js
// Solo de la app del PM. Lo compartido está en comun/. Después de editar, corre construir.py.

// lo que distingue a esta app en el código compartido
const APP_NOMBRE_ = 'PM';
const PREFIJO_SESION_ = 'pm_';

const SH = {
  CONFIG: 'Config', USUARIOS: 'Usuarios', PROYECTOS: 'Proyectos',
  PARTIDAS: 'Partidas_Catalogo', SUBS: 'Subcontratistas', BITACORA: 'Bitacora',
  AVANCE: 'Avance', GASTOS: 'Gastos', OT: 'Ordenes_Trabajo',
  BLOQUEOS: 'Bloqueos', TRABAJADORES: 'Trabajadores', MANO_OBRA: 'Mano_Obra',
  CHECKLIST: 'Checklist_Calidad', CALIDAD: 'Calidad', AGUA: 'Pruebas_Agua',
  PUNCH: 'Punch_List', ENTREGA: 'Entrega', AREAS: 'Areas', PARTIDAS_OBRA: 'Partidas_Obra', PLAN_SEMANAL: 'Plan_Semanal', OC: 'Ordenes_Cambio'
};

const MOTIVOS_SIN_TRABAJO = ['Esperando fabricación', 'Esperando a un sub', 'Esperando material',
  'Esperando inspección', 'Clima', 'Cliente no disponible', 'Otro'];


// acciones que se pueden hacer con 'guardar y ver' en un solo viaje (generada al transformar las pantallas)
const HACER_PM_ = ['pmAnular', 'pmAnularCierre', 'pmAprobarOT', 'pmCerrarDia', 'pmCerrarPunch', 'pmConfirmarOT', 'pmCorregir', 'pmInspeccion', 'pmMedida', 'pmPruebaFin', 'pmPruebaInicio', 'pmPunch', 'pmSubirRecibo'];
