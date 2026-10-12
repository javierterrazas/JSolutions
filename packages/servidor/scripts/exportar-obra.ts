// Exporta lo que se capturó de una obra a un libro de Excel, con las hojas y columnas del libro del sistema actual
// (Bitacora, Avance, Mano_Obra, Gastos, Bloqueos/Avisos, Calidad…), para compararlo con él en el piloto (fase 2,
// paso 7c). Más una hoja "Dias" con cada día desde el inicio: si se cerró, cuándo llegó y si fue tardío. Solo lee. Lo
// corre quien administra la plataforma, con la conexión a la base en un .env que nunca se sube al repositorio:
//
//   pnpm exec tsx --env-file=.env.nube packages/servidor/scripts/exportar-obra.ts \
//     --empresa "IJM Construction" --obra OB-001 [--salida piloto-OB-001.xlsx]
//
// Las fechas y horas van en la zona de la empresa. Lleva dinero (los gastos): es para el dueño.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import postgres from 'postgres';
import { escribirLibro, type HojaParaEscribir, type Valor } from '../src/importar/escribir-xlsx';

const { values: a } = parseArgs({
  options: { empresa: { type: 'string' }, obra: { type: 'string' }, salida: { type: 'string' } },
});
const base = process.env.DATABASE_URL;
if (!a.empresa || !a.obra || !base) {
  console.error(
    !a.empresa || !a.obra ? 'Faltan --empresa o --obra' : 'Falta DATABASE_URL en el archivo .env',
  );
  process.exit(1);
}
// la base de la nube pide SSL; la local no lo tiene
const sql = postgres(base, {
  max: 1,
  prepare: false,
  onnotice: () => {},
  ssl: /@(127\.0\.0\.1|localhost)[:/]/.test(base) ? false : 'require',
});

type Fila = Record<string, Valor | boolean>;
/** Una hoja: sus encabezados (las columnas del libro actual, con nombres legibles) y sus renglones. */
function hoja(
  nombre: string,
  columnas: readonly [string, string, number][],
  filas: readonly Fila[],
): HojaParaEscribir {
  const valor = (v: Valor | boolean | undefined): Valor =>
    v === true ? 'sí' : v === false ? 'no' : v === undefined ? null : v;
  return {
    nombre,
    anchos: columnas.map(([, , ancho]) => ancho),
    congelar: true,
    filas: [
      columnas.map(([, titulo]) => ({ v: titulo, estilo: 'encabezado' as const })),
      ...filas.map((f) => columnas.map(([clave]) => valor(f[clave]))),
    ],
  };
}

try {
  const [obra] = await sql<
    { id: string; folio: string; cliente: string; pm: string | null; inicio: string | null; zona: string }[]
  >`
    select o.id, o.folio, o.cliente, m.nombre as pm, to_char(o.fecha_inicio, 'YYYY-MM-DD') as inicio,
           e.zona_horaria as zona
    from obras o join empresas e on e.id = o.empresa_id left join miembros m on m.id = o.pm_id
    where e.nombre = ${a.empresa} and o.folio = ${a.obra}`;
  if (!obra) {
    console.error(`No hay una obra ${a.obra} en "${a.empresa}" (escríbelos igual que en la app).`);
    process.exitCode = 1;
  } else {
    const z = obra.zona;
    const hora = (c: string) =>
      sql.unsafe(`to_char((${c}) at time zone '${z.replace(/'/g, "''")}', 'YYYY-MM-DD HH24:MI')`);

    const dias = await sql<Fila[]>`
      with d as (select generate_series(${obra.inicio ?? '2000-01-01'}::date,
                                        (now() at time zone ${z})::date, '1 day')::date as dia)
      select to_char(d.dia, 'YYYY-MM-DD') as fecha, (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from d.dia)::int] as dia_semana,
             b.folio as bitacora, b.id is not null as cerrado, b.tardio, b.sin_trabajo,
             ${hora('b.enviado_en')} as enviado
      from d left join bitacora b on b.obra_id = ${obra.id} and b.dia = d.dia and b.estado = 'vigente'
      order by d.dia`;

    const bitacora = await sql<Fila[]>`
      select b.folio, to_char(b.dia, 'YYYY-MM-DD') as fecha, u.nombre as usuario,
             (select string_agg(e.nombre || ' · ' || p.nombre_es, ' | ' order by e.orden, p.orden)
                from bitacora_partidas bp join partidas_obra p on p.id = bp.partida_obra_id
                join espacios e on e.id = p.espacio_id where bp.bitacora_id = b.id) as partidas,
             (select string_agg(e.nombre || ' · ' || p.nombre_es, ' | ' order by e.orden, p.orden)
                from avance av join partidas_obra p on p.id = av.partida_obra_id
                join espacios e on e.id = p.espacio_id
                where av.bitacora_id = b.id and av.estado = 'terminada') as terminadas,
             (select string_agg(s.nombre || (case when bs.llego then ': llegó' else ': no llegó' end), ' | ')
                from bitacora_subs bs join ordenes_trabajo ot on ot.id = bs.orden_trabajo_id
                join subcontratistas s on s.id = ot.subcontratista_id where bs.bitacora_id = b.id) as subs,
             b.incidencia, b.sin_trabajo, b.motivo_sin_trabajo::text as motivo,
             (select count(*)::int from fotos f where f.ref_tipo = 'bitacora' and f.ref_id = b.id) as fotos,
             b.fotos_comprometidas as fotos_comprometidas, b.tardio, b.estado::text as estado,
             ${hora('b.enviado_en')} as enviado
      from bitacora b left join miembros u on u.id = b.creado_por
      where b.obra_id = ${obra.id} order by b.dia, b.creado_en`;

    const avance = await sql<Fila[]>`
      select to_char(av.dia, 'YYYY-MM-DD') as fecha, e.nombre as espacio, p.nombre_es as partida,
             av.estado::text as estado, av.estado_registro::text as registro, u.nombre as usuario
      from avance av join partidas_obra p on p.id = av.partida_obra_id join espacios e on e.id = p.espacio_id
      left join miembros u on u.id = av.creado_por
      where av.obra_id = ${obra.id} order by av.dia, e.orden, p.orden`;

    const manoObra = await sql<Fila[]>`
      select to_char(mo.dia, 'YYYY-MM-DD') as fecha, t.nombre as trabajador, t.tipo_pago::text as tipo_pago,
             mo.cantidad::float as cantidad, e.nombre as espacio, p.nombre_es as partida,
             mo.estado::text as estado
      from mano_obra mo join trabajadores t on t.id = mo.trabajador_id
      left join espacios e on e.id = mo.espacio_id left join partidas_obra p on p.id = mo.partida_obra_id
      where mo.obra_id = ${obra.id} order by mo.dia, t.nombre`;

    const gastos = await sql<Fila[]>`
      select g.folio, to_char(g.dia, 'YYYY-MM-DD') as fecha, g.categoria::text as categoria, g.proveedor,
             g.descripcion, g.monto::float as monto, g.metodo_pago::text as metodo, e.nombre as espacio,
             p.nombre_es as partida, g.origen::text as origen, g.revision::text as revision,
             g.estado::text as estado,
             exists (select 1 from fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id) as recibo,
             u.nombre as usuario, ${hora('g.creado_en')} as capturado
      from gastos g left join espacios e on e.id = g.espacio_id
      left join partidas_obra p on p.id = g.partida_obra_id left join miembros u on u.id = g.creado_por
      where g.obra_id = ${obra.id} order by g.dia, g.creado_en`;

    const avisos = await sql<Fila[]>`
      select av.folio, ${hora('av.creado_en')} as fecha_hora, av.tipo::text as tipo, av.descripcion,
             av.detiene_avance, av.estado::text as estado, av.respuesta, ${hora('av.respondido_en')} as respondido,
             round((extract(epoch from (av.respondido_en - av.creado_en)) / 3600)::numeric, 1)::float as horas,
             u.nombre as usuario
      from avisos av left join miembros u on u.id = av.creado_por
      where av.obra_id = ${obra.id} order by av.creado_en`;

    const calidad = await sql<Fila[]>`
      select ${hora('i.realizada_en')} as fecha, e.nombre as espacio, h.clave || ' ' || h.nombre_es as punto,
             i.resultado::text as resultado, i.puntos_ok, i.puntos_total, u.nombre as usuario
      from inspecciones i join espacios e on e.id = i.espacio_id join hitos_calidad h on h.id = i.hito_id
      left join miembros u on u.id = i.creado_por
      where i.obra_id = ${obra.id} order by i.realizada_en`;

    const pruebas = await sql<Fila[]>`
      select e.nombre as espacio, ${hora('pa.inicio')} as inicio, ${hora('pa.fin')} as fin,
             round((extract(epoch from (pa.fin - pa.inicio)) / 3600)::numeric, 1)::float as horas,
             pa.resultado::text as resultado
      from pruebas_agua pa join espacios e on e.id = pa.espacio_id
      where pa.obra_id = ${obra.id} order by pa.inicio`;

    const punch = await sql<Fila[]>`
      select pl.folio, ${hora('pl.creado_en')} as fecha, pl.item, pl.origen::text as origen, pl.responsable,
             to_char(pl.fecha_compromiso, 'YYYY-MM-DD') as compromiso, pl.estado::text as estado,
             ${hora('pl.cerrado_en')} as cerrado
      from punch_list pl where pl.obra_id = ${obra.id} order by pl.creado_en`;

    const ordenes = await sql<Fila[]>`
      select ot.folio, s.nombre as sub, ot.alcance, to_char(ot.inicio_programado, 'YYYY-MM-DD') as inicio,
             to_char(ot.fin_programado, 'YYYY-MM-DD') as fin, ot.estado::text as estado,
             ${hora('ot.confirmada_en')} as confirmada, ot.se_presento, ${hora('ot.aprobada_en')} as aprobada,
             ot.faltas
      from ordenes_trabajo ot join subcontratistas s on s.id = ot.subcontratista_id
      where ot.obra_id = ${obra.id} order by ot.inicio_programado`;

    const libro = escribirLibro([
      hoja('Dias', [['fecha', 'fecha', 12], ['dia_semana', 'día', 11], ['cerrado', 'cerrado', 9], ['bitacora', 'bitacora_id', 12], ['tardio', 'tardío', 8], ['sin_trabajo', 'sin trabajo', 11], ['enviado', 'llegó', 17]], dias),
      hoja('Bitacora', [['folio', 'bitacora_id', 12], ['fecha', 'fecha', 12], ['usuario', 'usuario', 16], ['partidas', 'partidas', 50], ['terminadas', 'terminadas', 40], ['subs', 'subs_presentes', 30], ['incidencia', 'incidencia', 40], ['sin_trabajo', 'sin trabajo', 11], ['motivo', 'motivo', 18], ['fotos', 'fotos', 7], ['fotos_comprometidas', 'fotos comprometidas', 10], ['tardio', 'tardio', 8], ['estado', 'estado', 10], ['enviado', 'timestamp', 17]], bitacora),
      hoja('Avance', [['fecha', 'fecha', 12], ['espacio', 'área', 18], ['partida', 'partida', 34], ['estado', 'estado', 12], ['registro', 'vigencia', 10], ['usuario', 'usuario', 16]], avance),
      hoja('Mano_Obra', [['fecha', 'fecha', 12], ['trabajador', 'trabajador', 18], ['tipo_pago', 'tipo de pago', 11], ['cantidad', 'horas (o días)', 13], ['espacio', 'área', 18], ['partida', 'partida', 34], ['estado', 'estado', 10]], manoObra),
      hoja('Gastos', [['folio', 'gasto_id', 12], ['fecha', 'fecha', 12], ['categoria', 'categoria', 14], ['proveedor', 'proveedor', 20], ['descripcion', 'descripcion', 34], ['monto', 'monto', 11], ['metodo', 'metodo_pago', 15], ['espacio', 'área', 18], ['partida', 'partida', 30], ['origen', 'origen', 9], ['revision', 'revision', 11], ['estado', 'estado', 10], ['recibo', 'recibo', 8], ['usuario', 'usuario', 16], ['capturado', 'timestamp', 17]], gastos),
      hoja('Avisos', [['folio', 'bloqueo_id', 12], ['fecha_hora', 'fecha_hora', 17], ['tipo', 'tipo', 16], ['descripcion', 'descripcion', 40], ['detiene_avance', 'detiene_avance', 14], ['estado', 'estado', 12], ['respuesta', 'respuesta', 34], ['respondido', 'fecha_respuesta', 17], ['horas', 'horas_respuesta', 14], ['usuario', 'levantado_por', 16]], avisos),
      hoja('Calidad', [['fecha', 'fecha', 17], ['espacio', 'área', 18], ['punto', 'hito', 26], ['resultado', 'resultado', 13], ['puntos_ok', 'puntos_ok', 10], ['puntos_total', 'puntos_total', 12], ['usuario', 'inspeccionado_por', 16]], calidad),
      hoja('Pruebas_Agua', [['espacio', 'área', 18], ['inicio', 'fecha_inicio', 17], ['fin', 'fecha_fin', 17], ['horas', 'horas', 8], ['resultado', 'resultado', 12]], pruebas),
      hoja('Punch_List', [['folio', 'punch_id', 12], ['fecha', 'fecha', 17], ['item', 'item', 40], ['origen', 'origen', 15], ['responsable', 'responsable', 18], ['compromiso', 'fecha_compromiso', 15], ['estado', 'estado', 10], ['cerrado', 'fecha_cierre', 17]], punch),
      hoja('Ordenes_Trabajo', [['folio', 'ot_id', 12], ['sub', 'sub', 20], ['alcance', 'alcance', 34], ['inicio', 'fecha_inicio_prog', 15], ['fin', 'fecha_fin_prog', 15], ['estado', 'estado', 11], ['confirmada', 'fecha_confirmacion', 17], ['se_presento', 'se_presento', 11], ['aprobada', 'fecha_aprobacion', 17], ['faltas', 'faltas', 7]], ordenes),
    ]); // prettier-ignore

    const salida = a.salida ?? `piloto-${obra.folio}.xlsx`;
    writeFileSync(salida, libro);
    const cerrados = dias.filter((d) => d.cerrado).length;
    console.log(`${obra.folio} · ${obra.cliente} (PM: ${obra.pm ?? '—'}), desde ${obra.inicio ?? '—'}:`);
    console.log(
      `  ${dias.length} días, ${cerrados} cerrados (${dias.filter((d) => d.tardio).length} tardíos), ` +
        `${gastos.length} gastos, ${avisos.length} avisos, ${calidad.length} inspecciones.`,
    );
    console.log(`Guardado en ${salida}`);
  }
} finally {
  await sql.end();
}
