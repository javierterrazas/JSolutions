// Carga en una empresa su libro del sistema actual (D-039): catálogo, configuración, metas, subcontratistas y
// cuadrilla. Primero muestra lo que va a cargar; solo carga con --confirmar. Lo corre quien administra la
// plataforma, con la llave secreta en un archivo .env que nunca se sube al repositorio:
//
//   pnpm exec tsx --env-file=.env.nube packages/servidor/scripts/cargar-libro.ts \
//     --libro "C:\Users\...\Gestion_Obra_IJM.xlsx" --empresa "IJM Construction" [--confirmar]
//
// El libro se descarga de Google Sheets con Archivo → Descargar → Microsoft Excel (.xlsx).
import { parseArgs } from 'node:util';
import { esErrorDeNegocio } from '@ijm/core';
import { createClient } from '@supabase/supabase-js';
import { datosDelLibro, type DatosDelLibro } from '../src/importar/libro';
import { leerLibro } from '../src/importar/xlsx';

const { values: a } = parseArgs({
  options: {
    libro: { type: 'string' },
    empresa: { type: 'string' },
    confirmar: { type: 'boolean', default: false },
  },
});
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SECRET_KEY;
if (!a.libro || !a.empresa || !url || !llave) {
  console.error(
    !a.libro || !a.empresa
      ? 'Faltan --libro o --empresa'
      : 'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el archivo .env',
  );
  process.exit(1);
}

let datos: DatosDelLibro;
try {
  datos = datosDelLibro(leerLibro(a.libro));
} catch (e) {
  if (!esErrorDeNegocio(e)) throw e;
  if (e.codigo === 'libro_incompleto') console.error(`Al libro le falta la hoja ${String(e.datos?.hoja)}.`);
  else if (e.codigo === 'libro_sin_partidas')
    console.error('El libro no tiene partidas en Partidas_Catalogo (los renglones de EJEMPLO no cuentan).');
  else {
    console.error(
      'El libro tiene datos que no se pueden cargar. Corrígelos en Google Sheets y vuelve a descargarlo:',
    );
    for (const p of (e.datos?.problemas ?? []) as { hoja: string; renglon: number; problema: string }[])
      console.error(`  ${p.hoja}, renglón ${p.renglon}: ${p.problema}`);
  }
  process.exit(1);
}

const supabase = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: empresas, error } = await supabase
  .from('empresas')
  .select('id, nombre')
  .eq('nombre', a.empresa);
if (error) throw error;
if (empresas.length !== 1) {
  console.error(`No hay una empresa que se llame "${a.empresa}" (escríbelo igual que en el alta).`);
  process.exit(1);
}

const lista = (xs: readonly string[]) => xs.join(', ');
console.log(`Lo que se va a cargar en "${a.empresa}":`);
for (const t of datos.tipos)
  console.log(`  ${t.nombre_es}: ${datos.partidas.filter((p) => p.tipo === t.nombre_es).length} partidas`);
console.log(`  Etapas (${datos.etapas.length}): ${lista(datos.etapas.map((e) => e.nombre_es))}`);
console.log(
  `  Oficios (${datos.oficios.length}): ${lista(datos.oficios.map((o) => o.nombre_es + (o.requiere_licencia ? ' (licencia)' : '')))}`,
);
console.log(
  `  Puntos de control (${datos.hitos.length}, ${datos.puntos.length} preguntas): ${lista(datos.hitos.map((h) => `${h.clave} ${h.nombre_es}`))}`,
);
console.log(
  `  Subcontratistas (${datos.subcontratistas.length}): ${lista(datos.subcontratistas.map((s) => s.nombre))}`,
);
console.log(`  Cuadrilla (${datos.trabajadores.length}): ${lista(datos.trabajadores.map((t) => t.nombre))}`);
const DIAS = ['', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
console.log(
  `  Días laborables: ${datos.diasLaborables ? lista(datos.diasLaborables.map((d) => DIAS[d]!)) : 'los de siempre (lun a sab)'}`,
);
console.log(
  `  Feriados (${datos.feriados.length})${datos.feriados.length ? ': ' + lista(datos.feriados.map((f) => `${f.dia} ${f.nombre_es}${f.se_trabaja ? ' (se trabaja)' : ''}`)) : ''}`,
);
console.log(
  `  Configuración: ${lista(Object.entries(datos.configuracion).map(([k, v]) => `${k} ${v}`))}` +
    (datos.metas.length
      ? `; metas propias: ${lista(datos.metas.map((m) => `${m.indicador} ${m.meta}`))}`
      : ''),
);

if (!a.confirmar) {
  console.log('\nNo se cargó nada. Si todo está bien, vuelve a correrlo con --confirmar.');
  process.exit(0);
}

const carga = await supabase.rpc('cargar_libro', { p_empresa: empresas[0]!.id, p_datos: datos });
if (carga.error) {
  console.error(
    carga.error.message === 'empresa_con_catalogo'
      ? 'Esa empresa ya tiene catálogo: no se carga dos veces. Los cambios se harán desde las pantallas del dueño.'
      : `No se pudo cargar: ${carga.error.message}`,
  );
  process.exit(1);
}
console.log('\nCargado:', carga.data);
