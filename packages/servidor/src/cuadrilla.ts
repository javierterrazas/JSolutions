// La cuadrilla de la empresa, para el dueño (D-061; legacy: duGuardarTrabajador, duBajaTrabajador): dar de alta a un
// trabajador, cambiar su nombre, su puesto (la profesión), su teléfono y cómo cobra, su salario, y darlo de baja o
// reactivarlo. El salario es dinero: solo el dueño o el administrador (RLS de tarifas_trabajador; el PM ve el nombre,
// el puesto y cómo cobra, para anotarlo en el cierre, nunca la tarifa).
//
// El salario tiene historial (D-031): cada día trabajado se cuesta con la tarifa vigente ese día. Cambiarlo agrega una
// tarifa desde una fecha; lo ya trabajado antes no cambia.
import { type Dia, ErrorDeNegocio, exigir } from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, textoCorto, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export type TipoPago = 'hora' | 'dia';

export interface TarifaTrabajador {
  readonly tarifa: number;
  readonly vigenteDesde: Dia;
}

export interface TrabajadorDeLaCuadrilla {
  readonly id: string;
  readonly nombre: string;
  readonly puesto: string | null;
  readonly tipoPago: TipoPago;
  readonly telefono: string | null;
  readonly activo: boolean;
  /** La tarifa de hoy (por hora o por día, según cobra); null si todavía no tiene. */
  readonly tarifa: number | null;
  /** Las tarifas que ha tenido, la más nueva primero. */
  readonly tarifas: readonly TarifaTrabajador[];
  /** La que empieza después de hoy, si ya se capturó. */
  readonly proxima: TarifaTrabajador | null;
  /** Cuántos días tiene anotados en cierres: con alguno, ya no cambia cómo cobra. */
  readonly diasTrabajados: number;
}

export interface Cuadrilla {
  /** Hoy en la zona de la empresa: desde cuándo vale un salario nuevo, si no se dice otra cosa. */
  readonly hoy: Dia;
  readonly trabajadores: readonly TrabajadorDeLaCuadrilla[];
}

/** La cuadrilla completa: los activos primero, por nombre. Solo el dueño o el administrador. */
export async function cuadrilla(tx: Tx, ahora = new Date()): Promise<Cuadrilla> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const trabajadores = await tx<
    {
      id: string;
      nombre: string;
      puesto: string | null;
      tipo_pago: TipoPago;
      telefono: string | null;
      activo: boolean;
      dias: number;
    }[]
  >`
    select t.id, t.nombre, t.puesto, t.tipo_pago, t.telefono, t.activo,
           (select count(distinct m.dia)::int from mano_obra m where m.trabajador_id = t.id and m.estado = 'vigente') as dias
    from trabajadores t order by t.activo desc, t.nombre`;
  const tarifas = await tx<{ trabajador_id: string; tarifa: string; desde: Dia }[]>`
    select trabajador_id, tarifa, to_char(vigente_desde, 'YYYY-MM-DD') as desde
    from tarifas_trabajador order by vigente_desde desc`;
  const lista = trabajadores.map((t) => {
    const suyas = tarifas
      .filter((x) => x.trabajador_id === t.id)
      .map((x) => ({ tarifa: Number(x.tarifa), vigenteDesde: x.desde }));
    return {
      id: t.id,
      nombre: t.nombre,
      puesto: t.puesto,
      tipoPago: t.tipo_pago,
      telefono: t.telefono,
      activo: t.activo,
      tarifa: suyas.find((x) => x.vigenteDesde <= s.hoy)?.tarifa ?? null,
      tarifas: suyas,
      proxima: suyas[0] && suyas[0].vigenteDesde > s.hoy ? suyas[0] : null,
      diasTrabajados: t.dias,
    };
  });
  return { hoy: s.hoy, trabajadores: lista };
}

const tarifa = z.coerce.number();
const telefono = z.string().max(40);

/** Una tarifa de verdad: más de cero, y menos de lo que nadie cobra por hora o por día. */
function validarTarifa(t: number): void {
  if (!(t > 0) || t >= 1e6) throw new ErrorDeNegocio('tarifa_invalida');
}

/** El nombre no se repite entre los activos: el PM los distingue por nombre en el cierre. */
async function exigirNombreLibre(tx: Tx, nombre: string, salvo: string | null): Promise<void> {
  const [otro] = await tx<{ id: string }[]>`
    select id from trabajadores
    where activo and lower(btrim(nombre)) = lower(${nombre}) and id is distinct from ${salvo}`;
  if (otro) throw new ErrorDeNegocio('trabajador_repetido', { nombre });
}

const EntradaAlta = z.object({
  nombre: textoCorto.nullish(),
  puesto: textoCorto.nullish(),
  tipoPago: z.enum(['hora', 'dia']).nullish(),
  tarifa: tarifa.nullish(),
  telefono: telefono.nullish(),
  /** Desde cuándo vale su tarifa; hoy, si no se dice. */
  vigenteDesde: dia.nullish(),
});

/**
 * Da de alta a un trabajador con su tarifa. Errores: `faltan` (nombre, tipo de pago, tarifa), `tarifa_invalida`,
 * `trabajador_repetido`, `solo_dueno`.
 */
export async function altaTrabajador(
  tx: Tx,
  entrada: z.input<typeof EntradaAlta>,
  ahora = new Date(),
): Promise<{ trabajadorId: string }> {
  const e = validarEntrada(EntradaAlta, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([
    [e.nombre, 'nombre'],
    [e.tipoPago, 'tipo_pago'],
    [e.tarifa, 'tarifa'],
  ]);
  validarTarifa(e.tarifa!);
  const nombre = e.nombre!.trim();
  await exigirNombreLibre(tx, nombre, null);
  const [t] = await tx<{ id: string }[]>`
    insert into trabajadores (empresa_id, nombre, puesto, tipo_pago, telefono, creado_por)
    values (${s.empresaId}, ${nombre}, ${e.puesto?.trim() || null}, ${e.tipoPago!}, ${e.telefono?.trim() || null},
            ${s.miembroId})
    returning id`;
  await tx`
    insert into tarifas_trabajador (empresa_id, trabajador_id, tarifa, vigente_desde, creado_por)
    values (${s.empresaId}, ${t!.id}, ${e.tarifa!}, ${e.vigenteDesde ?? s.hoy}, ${s.miembroId})`;
  return { trabajadorId: t!.id };
}

const EntradaEdicion = z.object({
  trabajadorId: uuid,
  nombre: textoCorto.nullish(),
  puesto: textoCorto.nullish(),
  tipoPago: z.enum(['hora', 'dia']).nullish(),
  telefono: telefono.nullish(),
});

/**
 * Cambia el nombre, el puesto, el teléfono o cómo cobra. Cómo cobra no cambia si ya tiene días anotados: sus horas se
 * leerían como días, o al revés. Errores: `faltan` (nombre), `trabajador_repetido`, `tipo_pago_con_registros`,
 * `registro_no_encontrado`, `solo_dueno`.
 */
export async function editarTrabajador(
  tx: Tx,
  entrada: z.input<typeof EntradaEdicion>,
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(EntradaEdicion, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([[e.nombre, 'nombre']]);
  const [t] = await tx<{ tipo_pago: TipoPago; activo: boolean }[]>`
    select tipo_pago, activo from trabajadores where id = ${e.trabajadorId}`;
  if (!t) throw new ErrorDeNegocio('registro_no_encontrado');
  const nombre = e.nombre!.trim();
  if (t.activo) await exigirNombreLibre(tx, nombre, e.trabajadorId);
  const tipoPago = e.tipoPago ?? t.tipo_pago;
  if (tipoPago !== t.tipo_pago) {
    const [trabajo] = await tx`select 1 from mano_obra where trabajador_id = ${e.trabajadorId} limit 1`;
    if (trabajo) throw new ErrorDeNegocio('tipo_pago_con_registros');
  }
  await tx`
    update trabajadores
    set nombre = ${nombre}, puesto = ${e.puesto?.trim() || null}, telefono = ${e.telefono?.trim() || null},
        tipo_pago = ${tipoPago}
    where id = ${e.trabajadorId}`;
}

const EntradaTarifa = z.object({ trabajadorId: uuid, tarifa: tarifa.nullish(), vigenteDesde: dia.nullish() });

/**
 * Cambia el salario desde una fecha (hoy, si no se dice): lo trabajado antes se queda con la tarifa de entonces. No va
 * más atrás que la última tarifa; la del mismo día se corrige, y queda en el rastro de correcciones. Errores: `faltan`
 * (tarifa), `tarifa_invalida`, `tarifa_anterior`, `registro_no_encontrado`, `solo_dueno`.
 */
export async function cambiarTarifa(
  tx: Tx,
  entrada: z.input<typeof EntradaTarifa>,
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(EntradaTarifa, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  exigir([[e.tarifa, 'tarifa']]);
  validarTarifa(e.tarifa!);
  const [t] = await tx`select 1 from trabajadores where id = ${e.trabajadorId}`;
  if (!t) throw new ErrorDeNegocio('registro_no_encontrado');
  const desde = e.vigenteDesde ?? s.hoy;
  const [ultima] = await tx<{ id: string; tarifa: string; desde: Dia }[]>`
    select id, tarifa, to_char(vigente_desde, 'YYYY-MM-DD') as desde from tarifas_trabajador
    where trabajador_id = ${e.trabajadorId} order by vigente_desde desc limit 1`;
  if (ultima && desde < ultima.desde) throw new ErrorDeNegocio('tarifa_anterior', { desde: ultima.desde });
  if (ultima && desde === ultima.desde) {
    if (Number(ultima.tarifa) === e.tarifa) return;
    await tx`update tarifas_trabajador set tarifa = ${e.tarifa!} where id = ${ultima.id}`;
    await tx`
      insert into correcciones (empresa_id, tabla, registro_id, accion, campo, antes, despues, motivo)
      values (${s.empresaId}, 'tarifas_trabajador', ${ultima.id}, 'editar', 'tarifa', ${ultima.tarifa},
              ${String(e.tarifa)}, ${`Tarifa corregida el mismo día que empezaba (${desde})`})`;
    return;
  }
  await tx`
    insert into tarifas_trabajador (empresa_id, trabajador_id, tarifa, vigente_desde, creado_por)
    values (${s.empresaId}, ${e.trabajadorId}, ${e.tarifa!}, ${desde}, ${s.miembroId})`;
}

/**
 * Da de baja o reactiva a un trabajador. Dado de baja ya no aparece en el cierre del PM; lo que trabajó se queda.
 * Reactivarlo no deja repetir el nombre de otro activo. Errores: `registro_no_encontrado`, `trabajador_repetido`,
 * `solo_dueno`.
 */
export async function cambiarActivoTrabajador(
  tx: Tx,
  entrada: { trabajadorId: string; activo: boolean },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(z.object({ trabajadorId: uuid, activo: z.boolean() }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const [t] = await tx<{ nombre: string }[]>`select nombre from trabajadores where id = ${e.trabajadorId}`;
  if (!t) throw new ErrorDeNegocio('registro_no_encontrado');
  if (e.activo) await exigirNombreLibre(tx, t.nombre, e.trabajadorId);
  await tx`update trabajadores set activo = ${e.activo} where id = ${e.trabajadorId}`;
}
