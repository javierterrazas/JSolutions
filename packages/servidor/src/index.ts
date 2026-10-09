// La capa del servidor de IJM. Cada función recibe una transacción ya tomada a nombre del usuario (enNombreDe), lee
// con su identidad, valida con @ijm/core y escribe bajo RLS. Los errores de negocio son ErrorDeNegocio (D-015).

export * from './conexion';
export * from './sesion';
export * from './entrada';
export * from './obras';
export * from './presupuesto';
export * from './consultas-obra';
export * from './inicio-pm';
export * from './cierre';
export * from './fotos';
export * from './correcciones';
export * from './acceso';
export * from './auth';
export * from './importar/xlsx';
export * from './importar/libro';
export * from './importar/plantilla';
export * from './importar/escribir-xlsx';
