// Corregir y anular, con rastro (legacy: comun/utilidades.js aplicarCorreccion_, aplicarAnulacion_;
// pm/servidor.js pmCorregir, pmAnular, pmAnularCierre). El PM, lo suyo dentro de 48 h; el dueño, sin límite salvo en
// obras cerradas. Siempre con motivo, y cada cambio queda en correcciones: quién, qué, cuándo, antes, después y por
// qué.
import {
  type Cambio,
  cambiosAplicables,
  ErrorDeNegocio,
  type TablaCorregible,
  validarCorreccion,
  validarHoras,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { uuid, validarEntrada } from './entrada';
import { leerSesion, type Sesion } from './sesion';

/** La columna de estado de cada tabla anulable. */
const COLUMNA_ESTADO: Record<TablaCorregible, string> = {
  gastos: 'estado',
  mano_obra: 'estado',
  bitacora: 'estado',
  avance: 'estado_registro',
  cobros: 'estado',
  pagos_sub: 'estado',
};

interface Registro {
  [k: string]: unknown;
  id: string;
  obra_id: string;
  creado_por: string | null;
  creado_en: Date;
}

async function leerRegistro(
  tx: Tx,
  s: Sesion,
  tabla: string,
  id: string,
  motivo: string,
  accion: 'editar' | 'anular',
) {
  // primero lo que no necesita leer el registro: el motivo, y que la tabla le toque a este rol
  validarCorreccion({
    tabla,
    esPM: s.rol === 'pm',
    esPropio: true,
    creadoEn: s.ahora,
    ahora: s.ahora,
    obraCerrada: false,
    anulado: false,
    motivo,
    accion,
  });
  const t = tabla as TablaCorregible;
  const [r] = await tx<Registro[]>`select * from ${tx(t)} where id = ${id}`;
  if (!r) throw new ErrorDeNegocio('registro_no_encontrado');
  const [obra] = await tx<{ estado: string }[]>`select estado from obras where id = ${r.obra_id}`;
  const [cerrada] = await tx`select 1 from obras_cerradas where obra_id = ${r.obra_id}`;
  const anulado = r[COLUMNA_ESTADO[t]] === 'anulado';
  validarCorreccion({
    tabla: t,
    esPM: s.rol === 'pm',
    esPropio: r.creado_por === s.miembroId,
    creadoEn: r.creado_en,
    ahora: s.ahora,
    // una obra que el usuario ya no ve (entregada, para el PM) es una obra cerrada para él
    obraCerrada: !obra || obra.estado === 'entregada' || !!cerrada,
    anulado,
    motivo,
    accion,
  });
  return { t, r, anulado };
}

async function dejarRastro(
  tx: Tx,
  s: Sesion,
  tabla: string,
  id: string,
  accion: 'editar' | 'anular',
  cambios: Cambio[],
  motivo: string,
) {
  await tx`insert into correcciones ${tx(
    cambios.map((c) => ({
      empresa_id: s.empresaId,
      tabla,
      registro_id: id,
      accion,
      campo: c.campo,
      antes: c.antes === null || c.antes === undefined ? null : String(c.antes),
      despues: c.despues === null || c.despues === undefined ? null : String(c.despues),
      motivo: motivo.trim(),
    })),
  )}`;
}

const EntradaCorreccion = z.object({
  tabla: z.string(),
  registroId: uuid,
  cambios: z.record(z.string(), z.unknown()),
  motivo: z.string(),
});

/**
 * Edita campos de un registro. Si cambia la partida, el registro se mueve con ella a su espacio. Si cambian las horas
 * de un trabajador, se vuelve a revisar su tope del día sumando obras. Errores de validarCorreccion,
 * cambiosAplicables, validarHoras, y `registro_no_encontrado`.
 */
export async function corregir(
  tx: Tx,
  entrada: z.input<typeof EntradaCorreccion>,
  ahora = new Date(),
): Promise<{ cambios: number }> {
  const e = validarEntrada(EntradaCorreccion, entrada);
  const s = await leerSesion(tx, ahora);
  const { t, r } = await leerRegistro(tx, s, e.tabla, e.registroId, e.motivo, 'editar');
  const cambios = cambiosAplicables(t, r, e.cambios);
  const valores: Record<string, unknown> = Object.fromEntries(cambios.map((c) => [c.campo, c.despues]));

  if ('partida_obra_id' in valores) {
    const [p] = await tx<{ espacio_id: string }[]>`
      select espacio_id from partidas_obra where id = ${String(valores.partida_obra_id)} and obra_id = ${r.obra_id}`;
    if (!p) throw new ErrorDeNegocio('partida_de_otra_obra');
    if (p.espacio_id !== r.espacio_id) {
      valores.espacio_id = p.espacio_id;
      cambios.push({ campo: 'espacio_id', antes: r.espacio_id, despues: p.espacio_id });
    }
  }
  if (t === 'mano_obra' && 'cantidad' in valores) {
    const [trab] = await tx<{ id: string; tipo_pago: 'hora' | 'dia' }[]>`
      select id, tipo_pago from trabajadores where id = ${String(r.trabajador_id)}`;
    const delDia = await tx<{ id: string; trabajador_id: string; obra_id: string; cantidad: string }[]>`
      select * from public.cuadrilla_del_dia(${String(r.dia)})`;
    validarHoras(
      trab ? { id: trab.id, tipoPago: trab.tipo_pago } : undefined,
      String(r.dia),
      Number(valores.cantidad),
      delDia.map((x) => ({
        id: x.id,
        trabajadorId: x.trabajador_id,
        obraId: x.obra_id,
        dia: String(r.dia),
        cantidad: Number(x.cantidad),
      })),
      r.id,
    );
  }
  const actualizados = await tx`update ${tx(t)} set ${tx(valores)} where id = ${r.id} returning id`;
  if (!actualizados.length) throw new ErrorDeNegocio('sin_permiso');
  await dejarRastro(tx, s, t, r.id, 'editar', cambios, e.motivo);
  return { cambios: cambios.length };
}

const EntradaAnulacion = z.object({ tabla: z.string(), registroId: uuid, motivo: z.string() });

/**
 * Anula un registro: queda, pero sale de todos los cálculos. Anular lo ya anulado no hace nada. Un pago anulado
 * regresa su orden de "pagada" a "aprobada".
 */
export async function anular(
  tx: Tx,
  entrada: z.input<typeof EntradaAnulacion>,
  ahora = new Date(),
): Promise<{ yaEstaba: boolean }> {
  const e = validarEntrada(EntradaAnulacion, entrada);
  const s = await leerSesion(tx, ahora);
  const { t, r, anulado } = await leerRegistro(tx, s, e.tabla, e.registroId, e.motivo, 'anular');
  if (anulado) return { yaEstaba: true };
  const col = COLUMNA_ESTADO[t];
  const actualizados = await tx`update ${tx(t)} set ${tx(col)} = 'anulado' where id = ${r.id} returning id`;
  if (!actualizados.length) throw new ErrorDeNegocio('sin_permiso');
  await dejarRastro(
    tx,
    s,
    t,
    r.id,
    'anular',
    [{ campo: col, antes: 'vigente', despues: 'anulado' }],
    e.motivo,
  );
  if (t === 'pagos_sub') {
    await tx`update ordenes_trabajo set estado = 'aprobada' where id = ${String(r.orden_trabajo_id)} and estado = 'pagada'`;
  }
  return { yaEstaba: false };
}

/** Anula un cierre completo: la bitácora y el avance y la cuadrilla que se registraron con ella. */
export async function anularCierre(
  tx: Tx,
  entrada: { bitacoraId: string; motivo: string },
  ahora = new Date(),
): Promise<{ registros: number }> {
  const e = validarEntrada(z.object({ bitacoraId: uuid, motivo: z.string() }), entrada);
  await anular(tx, { tabla: 'bitacora', registroId: e.bitacoraId, motivo: e.motivo }, ahora);
  let n = 1;
  for (const tabla of ['mano_obra', 'avance'] as const) {
    const col = COLUMNA_ESTADO[tabla];
    const ids = await tx<{ id: string }[]>`
      select id from ${tx(tabla)} where bitacora_id = ${e.bitacoraId} and ${tx(col)} = 'vigente'`;
    for (const { id } of ids) {
      await anular(tx, { tabla, registroId: id, motivo: e.motivo }, ahora);
      n++;
    }
  }
  return { registros: n };
}
