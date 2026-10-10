// El inicio del PM (fase 2, paso 3; legacy: pm/servidor.js construirDatos_): sus obras con el avance ponderado y la
// entrega prevista, su semana, los días que olvidó cerrar, las órdenes por confirmar, las órdenes de cambio que
// tiene que ejecutar, las inspecciones pendientes, las respuestas a sus avisos, sus gastos sin recibo y su racha.
// Solo lee, con la identidad del PM: RLS decide qué ve, y nada de esto es dinero del negocio (D-002). Las reglas
// salen de @ijm/core.
import {
  atrasoPrevisto,
  avanceDeObra,
  cronogramaObra,
  type AvanceDia,
  type CierreDia,
  type Dia,
  diasSinCierre,
  type EspacioCrono,
  estadoDePartida,
  fechaComprometida,
  type OrdenSemana,
  rachaDeCierres,
  type Responsable,
  semanaDelPM,
} from '@ijm/core';
import type { Tx } from './conexion';
import type { Nombre } from './consultas-obra';
import { leerSesion } from './sesion';

/** Los días laborables que muestra la semana del PM: con el sábado, seis (D-028). */
export const DIAS_SEMANA_PM = 6;

export type EstadoObra = 'sin_presupuesto' | 'lista_para_arranque' | 'en_obra' | 'en_cierre';

export interface ObraDelPm {
  readonly id: string;
  readonly folio: string;
  readonly cliente: string;
  readonly telefono: string;
  readonly direccion: string;
  readonly estado: EstadoObra;
  /** Avance ponderado: terminado y en curso, de 0 a 1. */
  readonly avance: { readonly pct: number; readonly curso: number };
  /** La entrega estimada más los días de las órdenes de cambio autorizadas. */
  readonly entregaComprometida: Dia;
  /** La entrega que sale del cronograma con el avance real; null si no tiene partidas. */
  readonly entregaPrevista: Dia | null;
  /** Días laborables que la prevista pasa de la comprometida. */
  readonly atrasoPrevisto: number;
  readonly cerradoHoy: boolean;
  /** Los días que olvidó cerrar y todavía puede cerrar él (los últimos 2 laborables). */
  readonly diasSinCierre: readonly Dia[];
  readonly partidas: { readonly terminadas: number; readonly total: number };
  /** Puntos de control de partidas ya empezadas que no tienen una inspección aprobada. */
  readonly inspeccionesPendientes: readonly {
    espacioId: string;
    hitoId: string;
    espacio: string;
    hito: string;
    nombre: Nombre;
  }[];
}

export interface DiaDeLaSemana {
  readonly dia: Dia;
  readonly partidas: readonly { obra: string; espacio: string; nombre: Nombre }[];
  readonly llegan: readonly { obra: string; sub: string }[];
}

export interface InicioPm {
  readonly hoy: Dia;
  readonly racha: number;
  readonly obras: readonly ObraDelPm[];
  readonly semana: readonly DiaDeLaSemana[];
  readonly porConfirmar: readonly {
    obraId: string;
    obra: string;
    folio: string;
    sub: string;
    telefono: string | null;
    inicio: Dia;
  }[];
  readonly cambios: readonly {
    obra: string;
    folio: string;
    descripcion: string;
    dias: number;
    nueva: boolean;
  }[];
  // Sus avisos y sus gastos se ven aunque la obra ya se haya entregado (D-025, como el legacy); de esa obra ya no
  // ve el folio, y `obra` queda nulo.
  readonly avisosAbiertos: readonly {
    obra: string | null;
    folio: string;
    tipo: string;
    descripcion: string;
    dia: Dia;
  }[];
  readonly respuestas: readonly {
    obra: string | null;
    folio: string;
    descripcion: string;
    respuesta: string;
    dia: Dia;
  }[];
  readonly sinRecibo: readonly {
    obraId: string;
    obra: string | null;
    folio: string;
    dia: Dia;
    proveedor: string;
    monto: number;
  }[];
}

const VACIO = { porConfirmar: [], cambios: [], avisosAbiertos: [], respuestas: [], sinRecibo: [] } as const;

export async function inicioDelPm(tx: Tx, ahora = new Date()): Promise<InicioPm> {
  const s = await leerSesion(tx, ahora);
  const { hoy, calendario: cal } = s;

  const obras = await tx<
    {
      id: string;
      folio: string;
      cliente: string;
      telefono: string;
      direccion: string;
      estado: EstadoObra;
      inicio: Dia;
      fin: Dia;
    }[]
  >`
    select id, folio, cliente, telefono_cliente as telefono, direccion, estado, fecha_inicio as inicio,
           fecha_fin_estimada as fin
    from obras where pm_id = ${s.miembroId} and estado <> 'entregada' order by fecha_inicio, folio`;
  const ids = obras.map((o) => o.id);
  const folio = new Map(obras.map((o) => [o.id, o.folio]));

  // los cierres de sus obras; para la racha cuentan los de todas, también las ya entregadas
  const bitacora = await tx<{ obra_id: string; dia: Dia; sin_trabajo: boolean }[]>`
    select obra_id, dia, sin_trabajo from bitacora where creado_por = ${s.miembroId} and estado = 'vigente'`;
  const cerrados = await tx<{ dia: Dia }[]>`select d as dia from public.mis_dias_cerrados() d`;
  const racha = rachaDeCierres(
    cerrados.map((c) => c.dia),
    hoy,
    cal,
  );
  if (!ids.length) return { hoy, racha, obras: [], semana: [], ...VACIO };

  const espacios = await tx<{ id: string; obra_id: string; nombre: string; generales: boolean }[]>`
    select e.id, e.obra_id, e.nombre, t.es_generales as generales
    from espacios e join tipos_espacio t on t.id = e.tipo_espacio_id
    where e.obra_id = any(${ids}) order by e.orden`;
  const partidas = await tx<
    {
      id: string;
      espacio_id: string;
      nombre_es: string;
      nombre_en: string | null;
      hito_id: string | null;
      peso: string;
      dias: number;
      responsable: Responsable;
      oficio_id: string | null;
      paralelo: boolean;
      espera: number;
    }[]
  >`
    select id, espacio_id, nombre_es, nombre_en, hito_id, peso, dias, responsable, oficio_id, paralelo, espera
    from partidas_obra where obra_id = any(${ids}) and estado = 'activa' order by orden, nombre_es`;
  const avance = await tx<(AvanceDia & { obra_id: string })[]>`
    select obra_id, partida_obra_id as "partidaId", estado, dia
    from avance where obra_id = any(${ids}) and estado_registro = 'vigente'`;
  const ordenes = await tx<
    {
      id: string;
      folio: string;
      obra_id: string;
      sub: string;
      telefono: string | null;
      partida: string | null;
      estado: OrdenSemana['estado'];
      inicio: Dia | null;
      fin: Dia | null;
      confirmada: boolean;
    }[]
  >`
    select o.id, o.folio, o.obra_id, coalesce(s.nombre, '') as sub, s.telefono, o.partida_obra_id as partida, o.estado,
           o.inicio_programado as inicio, o.fin_programado as fin, o.confirmada_en is not null as confirmada
    from ordenes_trabajo o left join subcontratistas_pm s on s.id = o.subcontratista_id
    where o.obra_id = any(${ids})`;
  const cambios = await tx<
    { obra_id: string; folio: string; descripcion: string; dias: number; autorizada: Date | null }[]
  >`
    select obra_id, folio, descripcion, coalesce(dias_impacto, 0) as dias, autorizada_en as autorizada
    from ordenes_cambio_pm where obra_id = any(${ids}) order by autorizada_en desc nulls last`;
  const inspecciones = await tx<{ espacio_id: string; hito_id: string; resultado: string }[]>`
    select espacio_id, hito_id, resultado from inspecciones
    where obra_id = any(${ids}) order by realizada_en`;
  const hitos = new Map(
    (
      await tx<{ id: string; clave: string; es: string; en: string | null }[]>`
        select id, clave, nombre_es as es, nombre_en as en from hitos_calidad`
    ).map((h) => [h.id, h]),
  );

  const nombreEspacio = new Map(espacios.map((e) => [e.id, e.nombre]));
  const nombrePartida = new Map(partidas.map((p) => [p.id, { es: p.nombre_es, en: p.nombre_en }]));
  // la última inspección de cada punto de control en cada espacio manda
  const ultimaInspeccion = new Map(inspecciones.map((i) => [`${i.espacio_id}|${i.hito_id}`, i.resultado]));

  const semanas: { obra: string; dias: ReturnType<typeof semanaDelPM>['dias'] }[] = [];
  const lista = obras.map((o): ObraDelPm => {
    const suyos = espacios.filter((e) => e.obra_id === o.id);
    const crono: EspacioCrono[] = suyos.map((e) => ({
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
    const suyas = partidas.filter((p) => suyos.some((e) => e.id === p.espacio_id));
    const suAvance = avance.filter((a) => a.obra_id === o.id);
    const av = avanceDeObra(
      suyos.map((e) => ({
        id: e.id,
        generales: e.generales,
        partidas: suyas.filter((p) => p.espacio_id === e.id).map((p) => ({ id: p.id, peso: Number(p.peso) })),
      })),
      suAvance,
    );
    const cronograma = cronogramaObra(o.inicio, crono, suAvance, hoy, cal);
    const comprometida = fechaComprometida(
      o.fin,
      cambios.filter((c) => c.obra_id === o.id).reduce((a, c) => a + c.dias, 0),
      cal,
    );
    const cierres: CierreDia[] = bitacora
      .filter((b) => b.obra_id === o.id)
      .map((b) => ({ dia: b.dia, conTrabajo: !b.sin_trabajo }));
    semanas.push({
      obra: o.folio,
      dias: semanaDelPM(
        cronograma,
        ordenes
          .filter((x) => x.obra_id === o.id)
          .map((x) => ({
            id: x.id,
            obraId: x.obra_id,
            subId: x.sub,
            partidaId: x.partida ?? '',
            estado: x.estado,
            inicio: x.inicio,
            fin: x.fin,
          })),
        hoy,
        cal,
        DIAS_SEMANA_PM,
      ).dias,
    });

    const estadoDe = (id: string) => estadoDePartida(suAvance.filter((a) => a.partidaId === id));
    const pendientes = new Map<string, ObraDelPm['inspeccionesPendientes'][number]>();
    for (const p of suyas) {
      if (!p.hito_id || estadoDe(p.id) === 'sin_iniciar') continue;
      const k = `${p.espacio_id}|${p.hito_id}`;
      if (ultimaInspeccion.get(k) === 'aprobado' || pendientes.has(k)) continue;
      const h = hitos.get(p.hito_id);
      pendientes.set(k, {
        espacioId: p.espacio_id,
        hitoId: p.hito_id,
        espacio: nombreEspacio.get(p.espacio_id) ?? '',
        hito: h?.clave ?? '',
        nombre: { es: h?.es ?? '', en: h?.en ?? null },
      });
    }

    return {
      id: o.id,
      folio: o.folio,
      cliente: o.cliente,
      telefono: o.telefono,
      direccion: o.direccion,
      estado: o.estado,
      avance: { pct: av.pct, curso: av.curso },
      entregaComprometida: comprometida,
      entregaPrevista: cronograma.prevFin,
      atrasoPrevisto: atrasoPrevisto(comprometida, cronograma.prevFin, cal),
      cerradoHoy: cierres.some((c) => c.dia === hoy),
      diasSinCierre: diasSinCierre(cierres, o.estado === 'en_obra', hoy, cal),
      partidas: {
        terminadas: suyas.filter((p) => estadoDe(p.id) === 'terminada').length,
        total: suyas.length,
      },
      inspeccionesPendientes: [...pendientes.values()],
    };
  });

  // la semana de todas sus obras, día por día (todas usan el mismo calendario, así que los días coinciden)
  const semana: DiaDeLaSemana[] = (semanas[0]?.dias ?? []).map((d, i) => ({
    dia: d.dia,
    partidas: semanas.flatMap((s) =>
      (s.dias[i]?.partidas ?? []).map((id) => {
        const p = partidas.find((x) => x.id === id);
        return {
          obra: s.obra,
          espacio: nombreEspacio.get(p?.espacio_id ?? '') ?? '',
          nombre: nombrePartida.get(id) ?? { es: '', en: null },
        };
      }),
    ),
    llegan: semanas.flatMap((s) =>
      (s.dias[i]?.llegan ?? []).map((id) => ({
        obra: s.obra,
        sub: ordenes.find((x) => x.id === id)?.sub ?? '',
      })),
    ),
  }));

  // sus avisos y sus gastos (RLS ya los limita a los que él registró)
  const avisos = await tx<
    {
      obra_id: string;
      folio: string;
      tipo: string;
      descripcion: string;
      estado: string;
      respuesta: string | null;
      respondido: Dia | null;
      creado: Dia;
    }[]
  >`
    select obra_id, folio, tipo, descripcion, estado, respuesta, (respondido_en at time zone ${s.zona})::date as respondido,
           (creado_en at time zone ${s.zona})::date as creado
    from avisos where creado_por = ${s.miembroId} order by creado_en desc`;
  const sinRecibo = await tx<
    { obra_id: string; folio: string; dia: Dia; proveedor: string; monto: string }[]
  >`
    select g.obra_id, g.folio, g.dia, coalesce(g.proveedor, '') as proveedor, g.monto from gastos g
    where g.id in (select public.mis_gastos_sin_recibo())
    order by g.dia`;
  const hace3 = new Date(ahora.getTime() - 3 * 24 * 3600 * 1000);

  return {
    hoy,
    racha,
    obras: lista,
    semana,
    porConfirmar: ordenes
      .filter((x) => x.estado === 'emitida' && !x.confirmada && x.inicio)
      .sort((a, b) => (a.inicio! < b.inicio! ? -1 : 1))
      .map((x) => ({
        obraId: x.obra_id,
        obra: folio.get(x.obra_id) ?? '',
        folio: x.folio,
        sub: x.sub,
        telefono: x.telefono,
        inicio: x.inicio!,
      })),
    cambios: cambios.map((c) => ({
      obra: folio.get(c.obra_id) ?? '',
      folio: c.folio,
      descripcion: c.descripcion,
      dias: c.dias,
      nueva: !!c.autorizada && c.autorizada > hace3,
    })),
    avisosAbiertos: avisos
      .filter((a) => a.estado === 'abierto')
      .map((a) => ({
        obra: folio.get(a.obra_id) ?? null,
        folio: a.folio,
        tipo: a.tipo,
        descripcion: a.descripcion,
        dia: a.creado,
      })),
    respuestas: avisos
      .filter((a) => a.respuesta)
      .slice(0, 10)
      .map((a) => ({
        obra: folio.get(a.obra_id) ?? null,
        folio: a.folio,
        descripcion: a.descripcion,
        respuesta: a.respuesta!,
        dia: a.respondido ?? a.creado,
      })),
    sinRecibo: sinRecibo.map((g) => ({
      obraId: g.obra_id,
      obra: folio.get(g.obra_id) ?? null,
      folio: g.folio,
      dia: g.dia,
      proveedor: g.proveedor,
      monto: Number(g.monto),
    })),
  };
}
