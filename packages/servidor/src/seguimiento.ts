// El seguimiento de una obra, para el dueño (D-062): cómo va (avance, en qué etapa va cada espacio, el plazo), cuánto
// del presupuesto se ha gastado por etapa, las horas de la cuadrilla y el día a día de lo que capturó el PM. Todo sale
// de las reglas de @ijm/core que ya tienen paridad con el legacy: avanceDeObra, cronogramaObra, costosPorEtapa (con
// la tarifa vigente de cada día, D-031). Lleva dinero: solo el dueño o el administrador.
import {
  atrasoPrevisto,
  avanceDeObra,
  type AvanceDia,
  type Cargo,
  claveEtapa,
  costosPorEtapa,
  cronogramaObra,
  type Dia,
  type EspacioCrono,
  esLaborable,
  estadoDePartida,
  fechaComprometida,
  margenDe,
  margenProyectado,
  type Responsable,
  sumarDias,
  tarifaDelDia,
} from '@ijm/core';
import { z } from 'zod';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion, type Sesion } from './sesion';

/** Cuántos días por página en el día a día. */
export const DIAS_POR_PAGINA = 14;

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

/**
 * El presupuesto contra lo gastado (D-062): rojo si ya se pasó; amarillo si se gasta más rápido de lo que avanza
 * (lo usado le lleva más de 10 puntos al avance); verde si va dentro.
 */
export function semaforoDePresupuesto(gastado: number, presupuesto: number, avance: number): Semaforo | null {
  if (!presupuesto) return null;
  const usado = gastado / presupuesto;
  if (usado > 1) return 'rojo';
  return usado - avance > 0.1 ? 'amarillo' : 'verde';
}

export interface EspacioDelSeguimiento {
  readonly id: string;
  readonly nombre: string;
  readonly generales: boolean;
  readonly pct: number;
  /** En qué va: sin iniciar, en curso o terminado. */
  readonly estado: 'sin_iniciar' | 'en_curso' | 'terminado';
  /** La etapa de lo que va en curso; si nada va en curso, la de lo que sigue. */
  readonly etapa: Nombre | null;
  readonly enCurso: readonly Nombre[];
}

export interface EtapaDelSeguimiento {
  readonly espacio: string;
  readonly etapa: Nombre | null;
  /** Lo que se espera gastar (su costo, D-084; si no lo tiene, su precio, como antes). */
  readonly presupuesto: number;
  /** Lo que se le cobra al cliente por la etapa. */
  readonly precio: number;
  readonly material: number;
  readonly cuadrilla: number;
  readonly sub: number;
  readonly total: number;
  /** Cuánto se pasó (o le falta) del presupuesto, como fracción; null sin presupuesto. */
  readonly desvio: number | null;
}

export interface DiaDelSeguimiento {
  readonly dia: Dia;
  /** Null si ese día laborable no se cerró. */
  readonly folio: string | null;
  readonly sinTrabajo: boolean;
  readonly motivo: string | null;
  readonly tardio: boolean;
  readonly incidencia: string | null;
  readonly partidas: readonly { espacio: string; partida: Nombre; terminada: boolean }[];
  readonly cuadrilla: readonly {
    nombre: string;
    tipoPago: 'hora' | 'dia';
    cantidad: number;
    costo: number;
  }[];
  readonly subs: readonly { sub: string; llego: boolean }[];
  readonly gastos: readonly { proveedor: string; monto: number; origen: string }[];
  readonly fotos: number;
}

export interface SeguimientoObra {
  readonly hoy: Dia;
  readonly obra: {
    readonly id: string;
    readonly folio: string;
    readonly cliente: string;
    readonly telefono: string;
    readonly direccion: string;
    readonly pm: string | null;
    readonly estado: string;
    readonly notas: string | null;
    /** El monto del contrato con el cliente, del alta (sin órdenes de cambio); null si no lo tiene. */
    readonly contrato: number | null;
    readonly inicio: Dia;
    /** La entrega del alta; la comprometida le suma los días de las órdenes de cambio autorizadas. */
    readonly entregaOriginal: Dia;
    readonly entregaComprometida: Dia;
    readonly entregaPrevista: Dia | null;
    readonly atraso: number;
  };
  readonly avance: { pct: number; curso: number; terminadas: number; total: number };
  readonly espacios: readonly EspacioDelSeguimiento[];
  readonly presupuesto: {
    /** Lo que se espera gastar en total (los costos, D-084). */
    readonly total: number;
    readonly gastado: number;
    readonly usado: number | null;
    readonly semaforo: Semaforo | null;
    /** El margen que deja el contrato con los costos presupuestados; null sin contrato. */
    readonly margenEsperado: number | null;
    /** El margen si lo que falta se gasta como se presupuestó (lo ya pasado cuenta como se gastó); null sin contrato. */
    readonly margenProyectado: number | null;
    readonly porEtapa: readonly EtapaDelSeguimiento[];
  };
  readonly cuadrilla: {
    readonly horas: number;
    readonly dias: number;
    readonly costo: number;
    readonly porTrabajador: readonly {
      nombre: string;
      tipoPago: 'hora' | 'dia';
      cantidad: number;
      costo: number;
      /** Sus horas o días por etapa, aproximados: las de cada día, repartidas entre las partidas de ese día (D-077). */
      porEtapa: readonly { etapa: Nombre | null; cantidad: number }[];
    }[];
  };
  readonly dias: readonly DiaDelSeguimiento[];
  readonly hayMasDias: boolean;
}

/** Un renglón de la cuadrilla, ya repartido a una partida: su espacio, su etapa y su parte de las horas o días. */
export interface CuadrillaRepartida {
  readonly obra_id: string;
  readonly espacio_id: string;
  readonly partida: string | null;
  readonly etapa: string | null;
  readonly trabajador_id: string;
  readonly cantidad: number;
  readonly dia: Dia;
}

/**
 * Reparte las horas (o días) de cada trabajador en un día entre las partidas que se trabajaron ese día, en partes
 * iguales (D-077): el PM anota cuánto trabajó cada uno, no en qué partida. Antes todo iba a la primera partida del
 * día. Sin cierre o sin partidas en el cierre, se queda en la partida con la que se guardó.
 */
export function repartirCuadrilla(
  manoObra: readonly {
    obra_id: string;
    espacio_id: string;
    partida: string | null;
    trabajador_id: string;
    cantidad: string | number;
    dia: Dia;
    bitacora_id: string | null;
  }[],
  delCierre: readonly { bitacora_id: string; partida: string }[],
  deLaPartida: ReadonlyMap<string, { espacio_id: string; etapa_id: string | null }>,
): CuadrillaRepartida[] {
  const porCierre = new Map<string, string[]>();
  for (const x of delCierre)
    porCierre.set(x.bitacora_id, [...(porCierre.get(x.bitacora_id) ?? []), x.partida]);
  return manoObra.flatMap((m) => {
    const partidas = (m.bitacora_id ? porCierre.get(m.bitacora_id) : undefined)?.filter((p) =>
      deLaPartida.has(p),
    );
    if (!partidas?.length)
      return [
        {
          obra_id: m.obra_id,
          espacio_id: m.espacio_id,
          partida: m.partida,
          etapa: m.partida ? (deLaPartida.get(m.partida)?.etapa_id ?? null) : null,
          trabajador_id: m.trabajador_id,
          cantidad: Number(m.cantidad),
          dia: m.dia,
        },
      ];
    const parte = Number(m.cantidad) / partidas.length;
    return partidas.map((p) => ({
      obra_id: m.obra_id,
      espacio_id: deLaPartida.get(p)!.espacio_id,
      partida: p,
      etapa: deLaPartida.get(p)!.etapa_id,
      trabajador_id: m.trabajador_id,
      cantidad: parte,
      dia: m.dia,
    }));
  });
}

/** Lo que el seguimiento necesita de la base para una o varias obras. */
async function leerObras(tx: Tx, s: Sesion, ids: readonly string[]) {
  const obras = await tx<
    {
      id: string;
      folio: string;
      cliente: string;
      telefono: string;
      direccion: string;
      pm: string | null;
      estado: string;
      notas: string | null;
      inicio: Dia;
      fin: Dia;
    }[]
  >`
    select o.id, o.folio, o.cliente, o.telefono_cliente as telefono, o.direccion, m.nombre as pm, o.estado, o.notas,
           to_char(o.fecha_inicio, 'YYYY-MM-DD') as inicio, to_char(o.fecha_fin_estimada, 'YYYY-MM-DD') as fin
    from obras o left join miembros m on m.id = o.pm_id where o.id = any(${ids})`;
  const espacios = await tx<
    { id: string; obra_id: string; nombre: string; generales: boolean; tipo: string; pies2: string }[]
  >`
    select e.id, e.obra_id, e.nombre, t.es_generales as generales, e.tipo_espacio_id as tipo,
           coalesce(e.pies2_verificados, e.pies2_cotizados) as pies2
    from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
    where e.obra_id = any(${ids}) order by e.orden`;
  const partidas = await tx<
    {
      id: string;
      obra_id: string;
      espacio_id: string;
      nombre_es: string;
      nombre_en: string | null;
      peso: string;
      dias: number;
      responsable: Responsable;
      oficio_id: string | null;
      paralelo: boolean;
      espera: number;
      etapa_id: string | null;
    }[]
  >`
    select id, obra_id, espacio_id, nombre_es, nombre_en, peso, dias, responsable, oficio_id, paralelo, espera, etapa_id
    from partidas_obra where obra_id = any(${ids}) and estado = 'activa' order by orden, nombre_es`;
  const avance = await tx<(AvanceDia & { obra_id: string })[]>`
    select obra_id, partida_obra_id as "partidaId", estado, to_char(dia, 'YYYY-MM-DD') as dia
    from avance where obra_id = any(${ids}) and estado_registro = 'vigente'`;
  const cambios = await tx<{ obra_id: string; dias: number }[]>`
    select obra_id, coalesce(dias_impacto, 0) as dias from ordenes_cambio
    where obra_id = any(${ids}) and estado in ('autorizada', 'facturada')`;
  const presupuesto = await tx<
    { obra_id: string; espacio_id: string; etapa_id: string | null; monto: string; costo: string | null }[]
  >`
    select obra_id, espacio_id, etapa_id, monto, costo from presupuesto_etapas where obra_id = any(${ids})`;
  const contratos = new Map(
    (
      await tx<{ obra_id: string; contrato: string }[]>`
        select obra_id, contrato_original as contrato from obras_finanzas where obra_id = any(${ids})`
    ).map((f) => [f.obra_id, Number(f.contrato)]),
  );
  const tarifas = (
    await tx<{ trabajador_id: string; tarifa: string; desde: Dia }[]>`
      select trabajador_id, tarifa, to_char(vigente_desde, 'YYYY-MM-DD') as desde from tarifas_trabajador`
  ).map((t) => ({ trabajadorId: t.trabajador_id, tarifa: Number(t.tarifa), vigenteDesde: t.desde }));
  const manoObra = await tx<
    {
      obra_id: string;
      espacio_id: string;
      partida: string | null;
      trabajador_id: string;
      nombre: string;
      tipo_pago: 'hora' | 'dia';
      cantidad: string;
      dia: Dia;
      bitacora_id: string | null;
    }[]
  >`
    select m.obra_id, m.espacio_id, m.partida_obra_id as partida, m.trabajador_id, t.nombre, t.tipo_pago, m.cantidad,
           to_char(m.dia, 'YYYY-MM-DD') as dia, m.bitacora_id
    from mano_obra m join trabajadores t on t.id = m.trabajador_id
    where m.obra_id = any(${ids}) and m.estado = 'vigente'`;
  // las partidas que se trabajaron en cada cierre, y de qué espacio y etapa es cada partida (también las de baja)
  const delCierre = await tx<{ bitacora_id: string; partida: string }[]>`
    select bitacora_id, partida_obra_id as partida from bitacora_partidas where obra_id = any(${ids})`;
  const deLaPartida = new Map(
    (
      await tx<{ id: string; espacio_id: string; etapa_id: string | null }[]>`
        select id, espacio_id, etapa_id from partidas_obra where obra_id = any(${ids})`
    ).map((p) => [p.id, p]),
  );
  const manoObraRepartida = repartirCuadrilla(manoObra, delCierre, deLaPartida);
  const gastos = await tx<
    {
      obra_id: string;
      espacio_id: string;
      partida: string | null;
      proveedor: string;
      monto: string;
      dia: Dia;
      origen: string;
    }[]
  >`
    select obra_id, espacio_id, partida_obra_id as partida, proveedor, monto, to_char(dia, 'YYYY-MM-DD') as dia, origen
    from gastos where obra_id = any(${ids}) and estado = 'vigente'`;
  const subs = await tx<{ obra_id: string; espacio_id: string; partida: string | null; precio: string }[]>`
    select o.obra_id, o.espacio_id, o.partida_obra_id as partida, coalesce(p.precio, 0) as precio
    from ordenes_trabajo o left join ordenes_trabajo_precios p on p.orden_trabajo_id = o.id
    where o.obra_id = any(${ids}) and o.estado <> 'cancelada'`;
  const etapas = new Map(
    (
      await tx<{ id: string; es: string; en: string | null }[]>`
        select id, nombre_es as es, nombre_en as en from etapas`
    ).map((e) => [e.id, { es: e.es, en: e.en }]),
  );
  return {
    obras,
    espacios,
    partidas,
    avance,
    cambios,
    presupuesto,
    contratos,
    tarifas,
    manoObra,
    manoObraRepartida,
    gastos,
    subs,
    etapas,
    s,
  };
}

type Lectura = Awaited<ReturnType<typeof leerObras>>;

/** Lo que hace falta para saber cómo va una obra, sin nada de dinero: lo comparten el dueño y el portal del cliente. */
export interface LecturaDeAvance {
  readonly s: Pick<Sesion, 'hoy' | 'calendario'>;
  readonly obras: readonly { id: string; inicio: Dia; fin: Dia }[];
  readonly espacios: readonly { id: string; obra_id: string; nombre: string; generales: boolean }[];
  readonly partidas: readonly {
    id: string;
    obra_id: string;
    espacio_id: string;
    nombre_es: string;
    nombre_en: string | null;
    peso: string | number;
    dias: number;
    responsable: Responsable;
    oficio_id: string | null;
    paralelo: boolean;
    espera: number;
    etapa_id: string | null;
  }[];
  readonly avance: readonly (AvanceDia & { obra_id: string })[];
  readonly cambios: readonly { obra_id: string; dias: number }[];
  readonly etapas: ReadonlyMap<string, Nombre>;
}

/** Cómo va una obra, sin dinero: el avance, el plazo y en qué va cada espacio. */
export function avanceDeLaObra(l: LecturaDeAvance, obraId: string) {
  const { s } = l;
  const o = l.obras.find((x) => x.id === obraId)!;
  const espacios = l.espacios.filter((e) => e.obra_id === obraId);
  const partidas = l.partidas.filter((p) => p.obra_id === obraId);
  const avance = l.avance.filter((a) => a.obra_id === obraId);
  const estadoDe = (id: string) => estadoDePartida(avance.filter((a) => a.partidaId === id));

  const av = avanceDeObra(
    espacios.map((e) => ({
      id: e.id,
      generales: e.generales,
      partidas: partidas
        .filter((p) => p.espacio_id === e.id)
        .map((p) => ({ id: p.id, peso: Number(p.peso) })),
    })),
    avance,
  );
  const crono: EspacioCrono[] = espacios.map((e) => ({
    id: e.id,
    generales: e.generales,
    partidas: partidas
      .filter((p) => p.espacio_id === e.id)
      .map((p) => ({
        id: p.id,
        dias: p.dias,
        paralelo: p.paralelo,
        espera: p.espera,
        responsable: p.responsable,
        oficioId: p.oficio_id,
      })),
  }));
  const cronograma = cronogramaObra(o.inicio, crono, avance, s.hoy, s.calendario);
  const comprometida = fechaComprometida(
    o.fin,
    l.cambios.filter((c) => c.obra_id === obraId).reduce((a, c) => a + c.dias, 0),
    s.calendario,
  );

  const nombre = (p: { nombre_es: string; nombre_en: string | null }): Nombre => ({
    es: p.nombre_es,
    en: p.nombre_en,
  });
  const espaciosSeg: EspacioDelSeguimiento[] = espacios.map((e) => {
    const suyas = partidas.filter((p) => p.espacio_id === e.id);
    const estados = suyas.map((p) => ({ p, estado: estadoDe(p.id) }));
    const enCurso = estados.filter((x) => x.estado === 'en_progreso').map((x) => x.p);
    const siguiente = estados.find((x) => x.estado === 'sin_iniciar')?.p;
    const terminado = suyas.length > 0 && estados.every((x) => x.estado === 'terminada');
    const etapaId = enCurso[0]?.etapa_id ?? (terminado ? null : siguiente?.etapa_id) ?? null;
    const peso = suyas.reduce((a, p) => a + Number(p.peso), 0);
    const hecho = estados.filter((x) => x.estado === 'terminada').reduce((a, x) => a + Number(x.p.peso), 0);
    return {
      id: e.id,
      nombre: e.nombre,
      generales: e.generales,
      pct: peso ? hecho / peso : 0,
      estado: terminado
        ? 'terminado'
        : enCurso.length || estados.some((x) => x.estado === 'terminada')
          ? 'en_curso'
          : 'sin_iniciar',
      etapa: etapaId ? (l.etapas.get(etapaId) ?? null) : null,
      enCurso: enCurso.map(nombre),
    };
  });

  return {
    o,
    av,
    terminadas: partidas.filter((p) => estadoDe(p.id) === 'terminada').length,
    total: partidas.length,
    entregaComprometida: comprometida,
    entregaPrevista: cronograma.prevFin,
    atraso: atrasoPrevisto(comprometida, cronograma.prevFin, s.calendario),
    espacios: espaciosSeg,
  };
}

/** Cómo va una obra: avance, plazo, espacios y presupuesto contra lo gastado. */
function calcular(l: Lectura, obraId: string) {
  const a = avanceDeLaObra(l, obraId);
  const o = l.obras.find((x) => x.id === obraId)!;
  const espacios = l.espacios.filter((e) => e.obra_id === obraId);
  const partidas = l.partidas.filter((p) => p.obra_id === obraId);

  const cargos: Cargo[] = [
    ...l.gastos
      .filter((g) => g.obra_id === obraId)
      .map((g) => ({
        espacioId: g.espacio_id,
        partidaId: g.partida,
        cubo: 'material' as const,
        monto: Number(g.monto),
      })),
    // las horas de cada día, repartidas entre las partidas que se trabajaron ese día (D-077)
    ...l.manoObraRepartida
      .filter((m) => m.obra_id === obraId)
      .map((m) => ({
        espacioId: m.espacio_id,
        partidaId: m.partida,
        cubo: 'cuadrilla' as const,
        monto: m.cantidad * tarifaDelDia(l.tarifas, m.trabajador_id, m.dia),
      })),
    ...l.subs
      .filter((x) => x.obra_id === obraId)
      .map((x) => ({
        espacioId: x.espacio_id,
        partidaId: x.partida,
        cubo: 'sub' as const,
        monto: Number(x.precio),
      })),
  ];
  const lineas = l.presupuesto.filter((x) => x.obra_id === obraId);
  const costos = costosPorEtapa(
    espacios.map((e) => ({
      id: e.id,
      generales: e.generales,
      tipoEspacioId: e.tipo,
      pies2: Number(e.pies2),
      partidas: partidas.filter((p) => p.espacio_id === e.id).map((p) => ({ id: p.id, etapaId: p.etapa_id })),
    })),
    cargos,
    // lo gastado se compara contra el costo de cada etapa (D-084); sin costo, contra su precio, como antes
    lineas.map((x) => ({
      espacioId: x.espacio_id,
      etapaId: x.etapa_id,
      monto: x.costo === null ? Number(x.monto) : Number(x.costo),
    })),
  );
  const precioDe = new Map(lineas.map((x) => [claveEtapa(x.espacio_id, x.etapa_id), Number(x.monto)]));
  const nombreEspacio = new Map(espacios.map((e) => [e.id, e.nombre]));
  const total = costos.reduce((a, c) => a + c.presupuesto, 0);
  const gastado = costos.reduce((a, c) => a + c.total, 0);
  const contrato = l.contratos.get(obraId) ?? 0;

  return {
    ...a,
    o,
    presupuesto: {
      total,
      gastado,
      usado: total ? gastado / total : null,
      semaforo: semaforoDePresupuesto(gastado, total, a.av.pct),
      margenEsperado: total ? margenDe(total, contrato) : null,
      margenProyectado: total
        ? margenProyectado(
            costos.map((c) => ({ costo: c.presupuesto, gastado: c.total })),
            contrato,
          )
        : null,
      porEtapa: costos.map((c) => ({
        espacio: nombreEspacio.get(c.espacioId) ?? '',
        etapa: c.etapaId ? (l.etapas.get(c.etapaId) ?? null) : null,
        presupuesto: c.presupuesto,
        precio: precioDe.get(claveEtapa(c.espacioId, c.etapaId)) ?? 0,
        material: c.material,
        cuadrilla: c.cuadrilla,
        sub: c.sub,
        total: c.total,
        desvio: c.desvio,
      })),
    },
  };
}

/**
 * El seguimiento completo de una obra de la empresa, con el día a día de `pagina` (desde 0, de 14 en 14 días, lo más
 * reciente primero). Null si la obra no existe. Error: `solo_dueno`.
 */
export async function seguimientoDeObra(
  tx: Tx,
  entrada: { obraId: string; pagina?: number },
  ahora = new Date(),
): Promise<SeguimientoObra | null> {
  const e = validarEntrada(
    z.object({ obraId: uuid, pagina: z.number().int().min(0).max(1000).default(0) }),
    entrada,
  );
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const l = await leerObras(tx, s, [e.obraId]);
  if (!l.obras.length) return null;
  const c = calcular(l, e.obraId);
  const [finanzas] = await tx<{ contrato: string }[]>`
    select contrato_original as contrato from obras_finanzas where obra_id = ${e.obraId}`;
  const manoObra = l.manoObra.filter((m) => m.obra_id === e.obraId);

  // la cuadrilla: horas y días, con su costo a la tarifa de cada día
  const porTrabajador = new Map<
    string,
    { nombre: string; tipoPago: 'hora' | 'dia'; cantidad: number; costo: number }
  >();
  for (const m of manoObra) {
    const x = porTrabajador.get(m.trabajador_id) ?? {
      nombre: m.nombre,
      tipoPago: m.tipo_pago,
      cantidad: 0,
      costo: 0,
    };
    x.cantidad += Number(m.cantidad);
    x.costo += Number(m.cantidad) * tarifaDelDia(l.tarifas, m.trabajador_id, m.dia);
    porTrabajador.set(m.trabajador_id, x);
  }
  // y por etapa, con las horas repartidas: aproximado, porque el PM anota las horas del día, no por partida
  const porEtapa = new Map<string, Map<string, number>>();
  for (const m of l.manoObraRepartida.filter((x) => x.obra_id === e.obraId)) {
    const suyo = porEtapa.get(m.trabajador_id) ?? new Map<string, number>();
    suyo.set(m.etapa ?? '', (suyo.get(m.etapa ?? '') ?? 0) + m.cantidad);
    porEtapa.set(m.trabajador_id, suyo);
  }
  const trabajadores = [...porTrabajador.entries()]
    .map(([id, x]) => ({
      ...x,
      porEtapa: [...(porEtapa.get(id) ?? new Map<string, number>()).entries()]
        .map(([etapa, cantidad]) => ({ etapa: etapa ? (l.etapas.get(etapa) ?? null) : null, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad),
    }))
    .sort((a, b) => b.costo - a.costo);

  // el día a día: los días cerrados, los laborables que faltaron desde el inicio hasta hoy (o la entrega), y los
  // días con gastos, también los de antes del arranque (el material se compra antes de empezar)
  const [entrega] = await tx<{ dia: Dia }[]>`
    select to_char(fecha_entrega, 'YYYY-MM-DD') as dia from entregas where obra_id = ${e.obraId}
    order by fecha_entrega desc limit 1`;
  const hasta = c.o.estado === 'entregada' && entrega && entrega.dia < s.hoy ? entrega.dia : s.hoy;
  const bitacora = await tx<
    {
      id: string;
      folio: string;
      dia: Dia;
      sin_trabajo: boolean;
      motivo: string | null;
      tardio: boolean;
      incidencia: string | null;
    }[]
  >`
    select id, folio, to_char(dia, 'YYYY-MM-DD') as dia, sin_trabajo, motivo_sin_trabajo as motivo, tardio, incidencia
    from bitacora where obra_id = ${e.obraId} and estado = 'vigente'`;
  const porDia = new Map(bitacora.map((b) => [b.dia, b]));
  const arranco = ['en_obra', 'en_cierre', 'entregada'].includes(c.o.estado);
  const todos: Dia[] = [];
  for (let d = hasta; d >= c.o.inicio; d = sumarDias(d, -1))
    if (porDia.has(d) || (arranco && esLaborable(d, s.calendario))) todos.push(d);
  const gastosObra = l.gastos.filter((g) => g.obra_id === e.obraId);
  for (const d of [...bitacora.map((b) => b.dia), ...gastosObra.map((g) => g.dia)])
    if (!todos.includes(d)) todos.push(d);
  todos.sort((a, b) => (a < b ? 1 : -1));
  const pagina = todos.slice(e.pagina * DIAS_POR_PAGINA, (e.pagina + 1) * DIAS_POR_PAGINA);
  const ids = pagina.map((d) => porDia.get(d)?.id).filter((x): x is string => !!x);

  const trabajadas = ids.length
    ? await tx<{ bitacora_id: string; espacio: string; es: string; en: string | null; terminada: boolean }[]>`
        select bp.bitacora_id, e.nombre as espacio, p.nombre_es as es, p.nombre_en as en,
               exists (select 1 from avance a where a.bitacora_id = bp.bitacora_id and a.partida_obra_id = p.id
                         and a.estado = 'terminada' and a.estado_registro = 'vigente') as terminada
        from bitacora_partidas bp join partidas_obra p on p.id = bp.partida_obra_id
        join espacios e on e.id = p.espacio_id
        where bp.bitacora_id = any(${ids}) order by e.orden, p.orden`
    : [];
  const llegaron = ids.length
    ? await tx<{ bitacora_id: string; sub: string; llego: boolean }[]>`
        select bs.bitacora_id, s.nombre as sub, bs.llego
        from bitacora_subs bs join ordenes_trabajo o on o.id = bs.orden_trabajo_id
        join subcontratistas s on s.id = o.subcontratista_id where bs.bitacora_id = any(${ids})`
    : [];
  const fotos = ids.length
    ? await tx<{ ref_id: string; n: number }[]>`
        select ref_id, count(*)::int as n from fotos where ref_tipo = 'bitacora' and ref_id = any(${ids})
        group by ref_id`
    : [];

  return {
    hoy: s.hoy,
    obra: {
      id: c.o.id,
      folio: c.o.folio,
      cliente: c.o.cliente,
      telefono: c.o.telefono,
      direccion: c.o.direccion,
      pm: c.o.pm,
      estado: c.o.estado,
      notas: c.o.notas,
      contrato: finanzas ? Number(finanzas.contrato) : null,
      inicio: c.o.inicio,
      entregaOriginal: c.o.fin,
      entregaComprometida: c.entregaComprometida,
      entregaPrevista: c.entregaPrevista,
      atraso: c.atraso,
    },
    avance: { pct: c.av.pct, curso: c.av.curso, terminadas: c.terminadas, total: c.total },
    espacios: c.espacios,
    presupuesto: c.presupuesto,
    cuadrilla: {
      horas: trabajadores.filter((t) => t.tipoPago === 'hora').reduce((a, t) => a + t.cantidad, 0),
      dias: trabajadores.filter((t) => t.tipoPago === 'dia').reduce((a, t) => a + t.cantidad, 0),
      costo: trabajadores.reduce((a, t) => a + t.costo, 0),
      porTrabajador: trabajadores,
    },
    dias: pagina.map((d) => {
      const b = porDia.get(d);
      return {
        dia: d,
        folio: b?.folio ?? null,
        sinTrabajo: b?.sin_trabajo ?? false,
        motivo: b?.motivo ?? null,
        tardio: b?.tardio ?? false,
        incidencia: b?.incidencia ?? null,
        partidas: b
          ? trabajadas
              .filter((x) => x.bitacora_id === b.id)
              .map((x) => ({ espacio: x.espacio, partida: { es: x.es, en: x.en }, terminada: x.terminada }))
          : [],
        cuadrilla: manoObra
          .filter((m) => (b ? m.bitacora_id === b.id : m.dia === d))
          .map((m) => ({
            nombre: m.nombre,
            tipoPago: m.tipo_pago,
            cantidad: Number(m.cantidad),
            costo: Number(m.cantidad) * tarifaDelDia(l.tarifas, m.trabajador_id, m.dia),
          })),
        subs: b
          ? llegaron.filter((x) => x.bitacora_id === b.id).map((x) => ({ sub: x.sub, llego: x.llego }))
          : [],
        gastos: gastosObra
          .filter((g) => g.dia === d)
          .map((g) => ({ proveedor: g.proveedor, monto: Number(g.monto), origen: g.origen })),
        fotos: b ? (fotos.find((f) => f.ref_id === b.id)?.n ?? 0) : 0,
      };
    }),
    hayMasDias: todos.length > (e.pagina + 1) * DIAS_POR_PAGINA,
  };
}

export interface ResumenDeObra {
  readonly avance: number;
  readonly usado: number | null;
  readonly semaforo: Semaforo | null;
  readonly entrega: Dia;
  readonly atraso: number;
}

/** Para la lista de obras del dueño: de cada una, el avance, el presupuesto usado y el atraso previsto. */
export async function resumenDeObras(tx: Tx, ahora = new Date()): Promise<Map<string, ResumenDeObra>> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const ids = (await tx<{ id: string }[]>`select id from obras where estado <> 'entregada'`).map((o) => o.id);
  if (!ids.length) return new Map();
  const l = await leerObras(tx, s, ids);
  return new Map(
    ids.map((id) => {
      const c = calcular(l, id);
      return [
        id,
        {
          avance: c.av.pct,
          usado: c.presupuesto.usado,
          semaforo: c.presupuesto.semaforo,
          entrega: c.entregaComprometida,
          atraso: c.atraso,
        },
      ];
    }),
  );
}
