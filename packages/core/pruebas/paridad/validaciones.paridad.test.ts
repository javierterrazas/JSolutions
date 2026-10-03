// Paridad de las validaciones y la calidad: el mismo caso al legacy y a packages/core, y el mismo resultado o el
// mismo error. Los mensajes del legacy se traducen a los códigos de core (D-015).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CALENDARIO_LEGACY as CAL,
  calificarInspeccion,
  cerrarPruebaAgua,
  type Dia,
  diaDeCaptura,
  ErrorDeNegocio,
  exigirInspecciones,
  fotosCriticas,
  type InspeccionHecha,
  type RegistroCuadrilla,
  restarLaborables,
  sumarDias,
  type TrabajadorTipo,
  validarAltaObra,
  validarCierreDia,
  validarCierreTardioDueno,
  validarCierreTardioPM,
  validarCuadrilla,
  validarInicioPruebaAgua,
} from '../../src/index';
import { areasDe, clavePartida, espaciosEtapas, filas, obrasDe } from './convertir';
import { cargarLegacy, type ContextoLegacy, diaLocal, funcionLegacy, type Libro } from './legacy';
import { diasSimulados } from './mesSimulado';
import { leerLibro } from './xlsx';

const EJEMPLO = leerLibro(
  fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url)),
);
const CODIGO_LEGACY = readFileSync(
  fileURLToPath(new URL('../../../../legacy/app/App_Dueno.gs', import.meta.url)),
  'utf8',
);
const texto = (v: unknown) => String(v ?? '').trim();
const ZONA = 'America/Chicago';

/** Esa hora de ese día, hora local. */
const alas = (dia: Dia, hora = 10) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hora);
};

/** Los mensajes del legacy y el código de core que dice lo mismo. */
const CODIGOS: [RegExp, string][] = [
  [/^Faltan: pies²/, 'faltan_pies2'],
  [/^Faltan: /, 'faltan'],
  [/10 dígitos/, 'telefono_incompleto'],
  [/no existe o no está activo/, 'pm_no_activo'],
  [/entrega no puede ser antes del inicio/, 'entrega_antes_del_inicio'],
  [/al menos un espacio/, 'sin_espacios'],
  [/dia completo o medio dia/, 'cuadrilla_dia_o_medio'],
  [/no puede pasar de un dia/, 'cuadrilla_pasa_un_dia'],
  [/El maximo es 16/, 'cuadrilla_pasa_16_horas'],
  [/ultimos 2 dias habiles/, 'fuera_de_ventana'],
  [/ya tiene cierre/, 'dia_ya_cerrado'],
  [/falta que el administrador capture el presupuesto/, 'obra_sin_presupuesto'],
  [/por que no hubo trabajo/, 'falta_motivo_sin_trabajo'],
  [/requiere al menos una foto/, 'falta_foto'],
  [/Marca en que partida/, 'faltan_partidas'],
  [/no es de esta obra/, 'orden_de_otra_obra'],
  [/hay que aprobar la inspeccion/, 'falta_inspeccion'],
  [/Esa obra ya esta cerrada/, 'obra_cerrada'],
  [/Escribe por que lo registras/, 'falta_motivo'],
  [/Elige el dia/, 'falta_dia'],
  [/Solo dias anteriores a hoy/, 'solo_dias_anteriores'],
  [/antes del inicio de la obra/, 'antes_del_inicio'],
  [/La inspeccion necesita fotos/, 'inspeccion_sin_foto'],
  [/no tiene preguntas/, 'hito_sin_preguntas'],
  [/al menos un punto que aplique/, 'ninguno_aplica'],
  [/prueba de inundacion terminada/, 'falta_prueba_agua'],
  [/La prueba arranca con la foto|La prueba se cierra con la foto/, 'prueba_sin_foto'],
  [/Ya hay una prueba en curso/, 'prueba_en_curso'],
  [/La prueba es de 24/, 'prueba_incompleta'],
];
function deLegacy<T>(fn: () => T): { codigo: string | null; valor?: T } {
  try {
    return { codigo: null, valor: fn() };
  } catch (e) {
    // el error viene de la máquina virtual del legacy: no es instanceof Error de este lado
    const msg = String((e as { message?: unknown })?.message ?? e);
    return { codigo: CODIGOS.find(([re]) => re.test(msg))?.[1] ?? `?? ${msg}` };
  }
}
function deCore<T>(fn: () => T): { codigo: string | null; valor?: T; datos?: unknown } {
  try {
    return { codigo: null, valor: fn() };
  } catch (e) {
    if (e instanceof ErrorDeNegocio) return { codigo: e.codigo, datos: e.datos };
    throw e;
  }
}

/** Un contexto del legacy con sesiones abiertas y las fotos de Drive simuladas. */
function legacy(app: 'Dueno' | 'PM', libro: Libro, ahora?: Date): ContextoLegacy {
  const ctx = cargarLegacy(app, {
    libro,
    ...(ahora ? { ahora } : {}),
    sesiones: { T: 'javier', C: 'carlos', L: 'luis' },
  });
  ctx.guardarFotos_ = (f: unknown[]) => (f ?? []).map((_, i) => `https://drive.falso/${i}`).join(' | ');
  return ctx;
}
const llamar = <T>(ctx: ContextoLegacy, fn: string, ...args: unknown[]) =>
  funcionLegacy<(...a: unknown[]) => T>(ctx, fn)(...args);
const FOTO = { mime: 'image/jpeg', data: 'x' };

// ------------------------------------------------------------------ datos convertidos
const trabajadoresDe = (libro: Libro): TrabajadorTipo[] =>
  filas(libro, 'Trabajadores').map((t) => ({
    id: texto(t[0]),
    tipoPago: texto(t[3]) === 'Por dia' ? 'dia' : 'hora',
  }));
const cuadrillaDe = (libro: Libro): RegistroCuadrilla[] =>
  filas(libro, 'Mano_Obra').map((m) => ({
    id: texto(m[0]),
    trabajadorId: texto(m[3]),
    obraId: texto(m[2]),
    dia: diaLocal(m[1] as Date),
    cantidad: Number(m[5]) || 0,
  }));
/** Las inspecciones, en el orden de la hoja: la última manda. */
const inspeccionesDe = (libro: Libro, obraId: string): InspeccionHecha[] =>
  filas(libro, 'Calidad')
    .filter((c) => c[2] === obraId)
    .map((c, i) => ({
      espacioId: texto(c[12]) || areasDe(libro, obraId).find((a) => !a.generales)?.id || '',
      hitoId: texto(c[3]),
      resultado: texto(c[5]) === 'Aprobado' ? 'aprobado' : 'con_defectos',
      realizadaEn: String(i).padStart(6, '0'),
    }));
/** El hito de cada partida de la obra (texto del legacy). */
function hitosDe(libro: Libro, obraId: string): Map<string, string | null> {
  const ctx = cargarLegacy('Dueno', { libro });
  const out = new Map<string, string | null>();
  for (const a of areasDe(libro, obraId)) {
    const lista = llamar<unknown[][]>(
      ctx,
      'partidasDeArea_',
      { id: a.id, tipo: a.tipo },
      llamar(ctx, 'datos_', 'Partidas_Catalogo'),
    );
    for (const c of lista) out.set(clavePartida(a.id, c[2]), texto(c[3]) || null);
  }
  return out;
}
const diasCerrados = (libro: Libro, obraId: string) =>
  new Set(
    filas(libro, 'Bitacora')
      .filter((b) => b[2] === obraId)
      .map((b) => diaLocal(b[1] as Date)),
  );

describe('paridad de las validaciones con el legacy', () => {
  it('alta de obra: lo que falta (128 combinaciones), teléfono, PM, fechas, espacios y doble clic', () => {
    const completa = {
      cliente: 'Familia Paridad', telefono: '512-555-0142', direccion: '77 Paridad Ln', pm: 'carlos',
      inicio: '2026-11-02', finEst: '2026-12-11', contrato: 25000, areas: [{ tipo: 'Baño', nombre: '', pies2: 45 }],
    }; // prettier-ignore
    const campos = ['cliente', 'telefono', 'direccion', 'pm', 'inicio', 'finEst', 'contrato'] as const;
    const casos: Record<string, unknown>[] = [];
    for (let m = 0; m < 128; m++) {
      casos.push(
        Object.fromEntries(
          Object.entries(completa).map(([k, v]) => [
            k,
            campos.indexOf(k as never) >= 0 && (m >> campos.indexOf(k as never)) & 1
              ? k === 'contrato'
                ? 0
                : ''
              : v,
          ]),
        ),
      );
    }
    casos.push(
      { ...completa, telefono: '555-0142' },
      { ...completa, telefono: 'cinco uno dos' },
      { ...completa, pm: 'javier' },
      { ...completa, pm: 'nadie' },
      { ...completa, finEst: '2026-10-30' },
      { ...completa, areas: [] },
      { ...completa, areas: [{ tipo: 'Generales', pies2: 10 }] },
      { ...completa, areas: [{ tipo: 'Baño', nombre: 'Baño principal' }, { tipo: 'Closet', pies2: 0 }] },
      { ...completa, areas: [{ tipo: 'Baño', pies2: 45 }, { tipo: 'Closet', nombre: 'Closet de visitas', pies2: 20 }] },
      { ...completa, cliente: filas(EJEMPLO, 'Proyectos')[1]![1], direccion: ` ${String(filas(EJEMPLO, 'Proyectos')[1]![3]).toUpperCase()} ` },
      { ...completa, cliente: filas(EJEMPLO, 'Proyectos')[1]![1], direccion: filas(EJEMPLO, 'Proyectos')[1]![3], confirmado: ['duplicada'] },
    ); // prettier-ignore
    const pms = new Set(
      filas(EJEMPLO, 'Usuarios')
        .filter((u) => u[3] === 'pm' && texto(u[6]) === 'SI')
        .map((u) => texto(u[0])),
    );
    const activas = filas(EJEMPLO, 'Proyectos')
      .filter((p) => p[9] !== 'Entregada')
      .map((p) => ({ id: texto(p[0]), cliente: texto(p[1]), direccion: texto(p[3]) }));
    for (const caso of casos) {
      // una copia: el legacy le pone nombre a los espacios que no lo traen
      const l = deLegacy(() =>
        llamar<{ ok?: boolean; confirmar?: boolean; codigo?: string; id?: string }>(
          legacy('Dueno', EJEMPLO),
          'duNuevaObra',
          'T',
          structuredClone(caso),
        ),
      );
      const c = deCore(() =>
        validarAltaObra(
          {
            cliente: caso.cliente as string, telefono: caso.telefono as string, direccion: caso.direccion as string,
            pmId: caso.pm as string, inicio: (caso.inicio as string) || null, finEstimada: (caso.finEst as string) || null,
            contrato: caso.contrato as number,
            espacios: (caso.areas as { tipo: string; nombre?: string; pies2?: number }[]).map((a) => ({ tipo: a.tipo === 'Generales' ? '' : a.tipo, nombre: a.nombre ?? null, pies2: a.pies2 ?? null })),
            confirmado: ((caso.confirmado as string[]) ?? []).map((x) => (x === 'duplicada' ? 'obra_duplicada' : x)),
          },
          { pmsActivos: pms, obrasActivas: activas },
        ),
      ); // prettier-ignore
      const resumenLegacy = l.codigo ?? (l.valor?.confirmar ? 'confirmar' : 'ok');
      const resumenCore = c.codigo ?? (c.valor && !c.valor.ok ? 'confirmar' : 'ok');
      expect(resumenCore, JSON.stringify(caso)).toBe(resumenLegacy);
      // y la lista de lo que falta, en el mismo orden
      if (l.codigo === 'faltan') {
        const nombres: Record<string, string> = {
          cliente: 'cliente', telefono_cliente: 'teléfono del cliente', direccion: 'dirección', pm: 'PM',
          fecha_inicio: 'fecha de inicio', fecha_entrega: 'fecha de entrega', contrato: 'monto del contrato',
        }; // prettier-ignore
        const campos = (c.datos as { campos: string[] }).campos.map((x) => nombres[x]);
        let mensaje = '';
        try {
          llamar(legacy('Dueno', EJEMPLO), 'duNuevaObra', 'T', structuredClone(caso));
        } catch (e) {
          mensaje = String((e as { message?: unknown }).message);
        }
        expect(`Faltan: ${campos.join(', ')}.`).toBe(mensaje);
      }
    }
  });

  it('cuadrilla: medio día o día completo, un día sumando obras, 16 horas sumando obras', () => {
    let rechazos = 0;
    let aceptadas = 0;
    for (const [d, libro] of [...diasSimulados()].filter((_, i) => i % 3 === 0)) {
      const ctx = legacy('Dueno', libro);
      const registros = cuadrillaDe(libro);
      const trabajadores = trabajadoresDe(libro);
      for (const t of trabajadores) {
        for (const captura of [[0.5], [1], [2], [8], [10], [16], [17], [0.5, 0.5], [8, 9], [0.5, 1]]) {
          const lista = captura.map((h) => ({ trabajador: t.id, horas: h }));
          const l = deLegacy(() => llamar(ctx, 'validarCuadrilla_', lista, alas(d, 16)));
          const c = deCore(() =>
            validarCuadrilla(
              lista.map((x) => ({ trabajadorId: x.trabajador, cantidad: x.horas })),
              d,
              trabajadores,
              registros,
            ),
          );
          expect(c.codigo, `${d} ${t.id} ${JSON.stringify(captura)}`).toBe(l.codigo);
          if (l.codigo) rechazos++;
          else aceptadas++;
        }
      }
    }
    expect(rechazos).toBeGreaterThan(50);
    expect(aceptadas).toBeGreaterThan(50);
  }, 600_000);

  it('el día de una captura: hasta 7 días atrás, nunca en el futuro', () => {
    const ahora = alas('2026-10-14', 9);
    const ctx = legacy('PM', EJEMPLO, ahora);
    for (const capturado of [
      null,
      '',
      'no es fecha',
      '2026-10-13T22:30:00-05:00',
      '2026-10-14T00:30:00-05:00',
      '2026-10-07T10:00:00-05:00',
      '2026-10-07T08:00:00-05:00',
      '2026-10-06T12:00:00-05:00',
      '2026-10-15T08:00:00-05:00',
      '2026-10-14T08:59:00-05:00',
    ]) {
      const l = diaLocal(llamar<Date>(ctx, 'fechaCaptura_', { capturado }));
      expect(diaDeCaptura(capturado, ahora, ZONA), String(capturado)).toBe(l);
    }
  });
});

describe('paridad del cierre del día con el legacy', () => {
  it('el cierre del PM: ventana tardía, sin trabajo, fotos, partidas, órdenes, inspecciones y cuadrilla', () => {
    const vistos = new Map<string, number>();
    for (const [d, libro] of [...diasSimulados()].filter((_, i) => i % 2 === 0)) {
      for (const hoy of [sumarDias(d, 1)]) {
        for (const obra of obrasDe(libro).filter(
          (o) =>
            o.estado === 'En obra' || o.estado === 'Lista para arranque' || o.estado === 'Sin presupuesto',
        )) {
          const pm = texto(obra.fila[5]) === 'carlos' ? 'C' : 'L';
          const espacios = espaciosEtapas(libro, obra.id);
          const hitos = hitosDe(libro, obra.id);
          const partidas = espacios.flatMap((e) => e.partidas.map((p) => p.id));
          const conHito = partidas.filter((p) => hitos.get(p));
          const ots = filas(libro, 'Ordenes_Trabajo')
            .filter((o) => o[1] === obra.id)
            .map((o) => texto(o[0]));
          const otAjena = filas(libro, 'Ordenes_Trabajo').find((o) => o[1] !== obra.id);
          const trab = trabajadoresDe(libro).find((t) => t.tipoPago === 'hora')!;
          const base = {
            obra: obra.id,
            partidas: partidas.slice(0, 1),
            terminadas: [],
            fotos: [],
            fotosPorSubir: 1,
            cuadrilla: [],
            subs: [],
          };
          const casos: Record<string, unknown>[] = [
            base,
            { ...base, fotosPorSubir: 0 },
            { ...base, fotosPorSubir: 0, fotos: [FOTO] },
            { ...base, partidas: [] },
            { ...base, sinTrabajo: true, motivo: 'Clima' },
            { ...base, sinTrabajo: true, motivo: 'Me dio flojera' },
            { ...base, subs: ots.slice(0, 1).map((ot) => ({ ot, llego: true, nombre: 'x' })) },
            ...(otAjena ? [{ ...base, subs: [{ ot: otAjena[0], llego: true, nombre: 'x' }] }] : []),
            ...conHito.slice(0, 3).map((p) => ({ ...base, partidas: [p], terminadas: [p] })),
            { ...base, cuadrilla: [{ trabajador: trab.id, horas: 10, partida: partidas[0] }, { trabajador: trab.id, horas: 7, partida: partidas[0] }] },
            ...[1, 2, 3].map((k) => ({ ...base, tardio: restarLaborables(hoy, k, CAL) })),
            { ...base, tardio: hoy },
          ]; // prettier-ignore
          for (const caso of casos) {
            const l = deLegacy(() => llamar(legacy('PM', libro, alas(hoy)), 'pmCerrarDia', pm, caso));
            const tardio = caso.tardio as Dia | undefined;
            const c = deCore(() => {
              if (tardio) validarCierreTardioPM(tardio, hoy, diasCerrados(libro, obra.id), CAL);
              validarCierreDia({
                sinTrabajo: !!caso.sinTrabajo,
                motivo: caso.motivo === 'Clima' ? 'clima' : (caso.motivo as string | undefined),
                obraSinPresupuesto: obra.estado === 'Sin presupuesto',
                fotos: (caso.fotos as unknown[]).length,
                fotosPorSubir: caso.fotosPorSubir as number,
                partidas: caso.partidas as string[],
                ordenesReportadas: (caso.subs as { ot: string }[]).map((s) => s.ot),
                ordenesDeLaObra: new Set(ots),
              });
              if (!caso.sinTrabajo) {
                exigirInspecciones(
                  (caso.terminadas as string[]).map((p) => ({ partidaId: p, espacioId: p.split('|')[0]!, hitoId: hitos.get(p) ?? null })),
                  inspeccionesDe(libro, obra.id),
                );
              }
              validarCuadrilla(
                (caso.sinTrabajo ? [] : (caso.cuadrilla as { trabajador: string; horas: number }[])).map((x) => ({ trabajadorId: x.trabajador, cantidad: x.horas })),
                tardio ?? hoy,
                trabajadoresDe(libro),
                cuadrillaDe(libro),
              );
            }); // prettier-ignore
            expect(c.codigo, `${hoy} ${obra.id} ${JSON.stringify(caso).slice(0, 160)}`).toBe(l.codigo);
            vistos.set(l.codigo ?? 'ok', (vistos.get(l.codigo ?? 'ok') ?? 0) + 1);
          }
        }
      }
    }
    // que de verdad se ejercitó cada rechazo
    for (const codigo of ['ok', 'falta_foto', 'faltan_partidas', 'falta_motivo_sin_trabajo', 'orden_de_otra_obra', 'falta_inspeccion', 'cuadrilla_pasa_16_horas', 'fuera_de_ventana', 'dia_ya_cerrado', 'obra_sin_presupuesto']) {
      expect(vistos.get(codigo) ?? 0, codigo).toBeGreaterThan(0);
    } // prettier-ignore
  }, 600_000);

  it('el día olvidado que registra el dueño', () => {
    const vistos = new Map<string, number>();
    for (const [d, libro] of [...diasSimulados()].filter((_, i) => i % 3 === 0)) {
      const hoy = sumarDias(d, 1);
      for (const obra of obrasDe(libro).filter((o) => o.inicio)) {
        const espacios = espaciosEtapas(libro, obra.id);
        const hitos = hitosDe(libro, obra.id);
        const partidas = espacios.flatMap((e) => e.partidas.map((p) => p.id));
        const conHito = partidas.find((p) => hitos.get(p));
        const cerrados = [...diasCerrados(libro, obra.id)];
        const trab = trabajadoresDe(libro).find((t) => t.tipoPago === 'dia')!;
        // un día sin cierre entre el inicio y ayer (en el mes simulado casi todos se cierran: suele ser un sábado)
        const cerradosSet = diasCerrados(libro, obra.id);
        let libre = sumarDias(hoy, -1);
        while (libre >= obra.inicio! && cerradosSet.has(libre)) libre = sumarDias(libre, -1);
        const base = {
          fecha: libre >= obra.inicio! ? libre : restarLaborables(hoy, 4, CAL),
          partidas: partidas.slice(0, 1),
          terminadas: [],
          cuadrilla: [],
          motivo: 'El PM me lo dictó',
        };
        const casos: Record<string, unknown>[] = [
          base,
          { ...base, motivo: '  ' },
          { ...base, fecha: '' },
          { ...base, fecha: hoy },
          { ...base, fecha: sumarDias(hoy, 3) },
          { ...base, fecha: sumarDias(obra.inicio!, -3) },
          ...(cerrados.length ? [{ ...base, fecha: cerrados[0] }] : []),
          { ...base, partidas: [] },
          ...(conHito ? [{ ...base, partidas: [conHito], terminadas: [conHito] }] : []),
          { ...base, cuadrilla: [{ trabajador: trab.id, horas: 2 }] },
        ]; // prettier-ignore
        const cerrada = filas(libro, 'Obras_Cerradas').some((c) => c[1] === obra.id);
        for (const caso of casos) {
          const l = deLegacy(() =>
            llamar(legacy('Dueno', libro, alas(hoy)), 'duCierreTardio', 'T', obra.id, caso),
          );
          const c = deCore(() => {
            validarCierreTardioDueno({
              obraCerrada: cerrada, motivo: caso.motivo as string, dia: (caso.fecha as string) || null, hoy,
              inicioObra: obra.inicio, diasCerrados: diasCerrados(libro, obra.id), partidas: caso.partidas as string[],
            });
            exigirInspecciones(
              (caso.terminadas as string[]).map((p) => ({ partidaId: p, espacioId: p.split('|')[0]!, hitoId: hitos.get(p) ?? null })),
              inspeccionesDe(libro, obra.id),
            );
            validarCuadrilla(
              (caso.cuadrilla as { trabajador: string; horas: number }[]).map((x) => ({ trabajadorId: x.trabajador, cantidad: x.horas })),
              caso.fecha as string, trabajadoresDe(libro), cuadrillaDe(libro),
            );
          }); // prettier-ignore
          expect(c.codigo, `${hoy} ${obra.id} ${JSON.stringify(caso)}`).toBe(l.codigo);
          vistos.set(l.codigo ?? 'ok', (vistos.get(l.codigo ?? 'ok') ?? 0) + 1);
        }
      }
    }
    for (const codigo of ['ok', 'obra_cerrada', 'falta_motivo', 'falta_dia', 'solo_dias_anteriores', 'antes_del_inicio', 'dia_ya_cerrado', 'faltan_partidas', 'falta_inspeccion', 'cuadrilla_dia_o_medio']) {
      expect(vistos.get(codigo) ?? 0, codigo).toBeGreaterThan(0);
    } // prettier-ignore
  }, 600_000);
});

describe('paridad de la calidad con el legacy', () => {
  it('cada inspección: "No aplica", defectos, preguntas inventadas, sin fotos y PC3 sin prueba de agua', () => {
    const vistos = new Map<string, number>();
    for (const [d, libro] of [...diasSimulados()].filter((_, i) => i % 4 === 0)) {
      const checklist = filas(libro, 'Checklist_Calidad');
      const hitos = [...new Set(checklist.map((c) => texto(c[0])))];
      for (const obra of obrasDe(libro).filter((o) =>
        ['En obra', 'Lista para arranque', 'En cierre', 'Sin presupuesto'].includes(o.estado),
      )) {
        const pm = texto(obra.fila[5]) === 'carlos' ? 'C' : 'L';
        for (const area of areasDe(libro, obra.id).filter((a) => !a.generales)) {
          for (const hito of hitos) {
            const preguntas = checklist.filter((c) => texto(c[0]) === hito).map((c) => texto(c[2]));
            const casos = [
              { cumple: preguntas, noAplica: [] as string[], fotos: [FOTO] },
              { cumple: preguntas.slice(1), noAplica: [], fotos: [FOTO] },
              { cumple: preguntas.slice(2), noAplica: preguntas.slice(0, 2), fotos: [FOTO] },
              { cumple: [], noAplica: preguntas, fotos: [FOTO] },
              { cumple: ['Pregunta inventada'], noAplica: [], fotos: [FOTO] },
              { cumple: preguntas, noAplica: [], fotos: [] },
            ];
            for (const caso of casos) {
              const p = { obra: obra.id, hito, partida: '', area: area.id, ...caso };
              const l = deLegacy(() =>
                llamar<{ aprobado: boolean; defectos: number; noAplica: number }>(
                  legacy('PM', libro, alas(d)),
                  'pmInspeccion',
                  pm,
                  p,
                ),
              );
              const sinFugas = filas(libro, 'Pruebas_Agua').some(
                (x) =>
                  x[1] === obra.id &&
                  texto(x[7]) === 'Sin fugas' &&
                  (texto(x[9]) ? texto(x[9]) === area.id : true),
              );
              const c = deCore(() =>
                calificarInspeccion({
                  puntos: preguntas.map((t) => ({ id: t, requiereFoto: false })),
                  cumple: caso.cumple, noAplica: caso.noAplica, fotos: caso.fotos.length,
                  exigePruebaAgua: /^PC3\b/i.test(hito), pruebaAguaSinFugas: sinFugas,
                }),
              ); // prettier-ignore
              expect(
                c.codigo,
                `${d} ${obra.id} ${area.id} ${hito} ${JSON.stringify(caso).slice(0, 80)}`,
              ).toBe(l.codigo);
              if (!l.codigo) {
                expect({
                  aprobado: c.valor!.resultado === 'aprobado',
                  defectos: c.valor!.defectos.length,
                  noAplica: c.valor!.noAplica.length,
                }).toEqual({
                  aprobado: l.valor!.aprobado,
                  defectos: l.valor!.defectos,
                  noAplica: l.valor!.noAplica,
                });
              }
              const clave = l.codigo ?? (l.valor!.aprobado ? 'aprobada' : 'con_defectos');
              vistos.set(clave, (vistos.get(clave) ?? 0) + 1);
            }
          }
        }
      }
    }
    for (const codigo of [
      'aprobada',
      'con_defectos',
      'ninguno_aplica',
      'inspeccion_sin_foto',
      'falta_prueba_agua',
    ]) {
      expect(vistos.get(codigo) ?? 0, codigo).toBeGreaterThan(0);
    }
  }, 600_000);

  it('la prueba de inundación: una en curso por espacio, foto, y 23 horas como mínimo', () => {
    const libro = diasSimulados().get('2026-10-15')!;
    const obra = obrasDe(libro).find((o) => o.estado === 'En obra')!;
    const pm = texto(obra.fila[5]) === 'carlos' ? 'C' : 'L';
    const area = areasDe(libro, obra.id).find((a) => !a.generales)!;
    const inicio = alas('2026-10-15', 8);
    // una prueba en curso, puesta a mano en la hoja
    const conPrueba = structuredClone(libro);
    conPrueba.Pruebas_Agua!.push([
      'AGU-9999',
      obra.id,
      inicio,
      'liga',
      '',
      '',
      '',
      'En curso',
      'carlos',
      area.id,
    ]);
    for (const horas of [1, 22.94, 22.96, 23, 24, 49.5]) {
      for (const fotos of [[FOTO], []]) {
        const ahora = new Date(inicio.getTime() + horas * 3_600_000);
        const l = deLegacy(() =>
          llamar<{ horas: number }>(
            legacy('PM', conPrueba, ahora),
            'pmPruebaFin',
            pm,
            'AGU-9999',
            fotos[0],
            false,
          ),
        );
        const c = deCore(() => cerrarPruebaAgua(inicio, ahora, fotos.length));
        expect(c.codigo, `${horas} h, ${fotos.length} fotos`).toBe(l.codigo);
        if (!l.codigo) expect(c.valor).toBe(l.valor!.horas);
      }
    }
    for (const base of [libro, conPrueba]) {
      const enCurso = filas(base, 'Pruebas_Agua').some(
        (x) => x[1] === obra.id && texto(x[7]) === 'En curso' && texto(x[9]) === area.id,
      );
      for (const fotos of [[FOTO], []]) {
        const l = deLegacy(() =>
          llamar(legacy('PM', base, alas('2026-10-16')), 'pmPruebaInicio', pm, obra.id, fotos[0], area.id),
        );
        const c = deCore(() => validarInicioPruebaAgua({ fotos: fotos.length, hayEnCurso: enCurso }));
        expect(c.codigo, `en curso ${enCurso}, ${fotos.length} fotos`).toBe(l.codigo);
      }
    }
  });

  it('"Foto solo en lo crítico": qué puntos cambian y cuántos son críticos', () => {
    const lista = (nombre: string) =>
      JSON.parse(CODIGO_LEGACY.match(new RegExp(`const ${nombre} = (\\[[^\\]]*\\]);`))![1]!) as string[];
    const estandar = lista('PUNTOS_ESTANDAR_');
    const criticas = lista('FOTO_CRITICA_');
    const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const en = (l: string[], s: string) => l.some((x) => quitarAcentos(x) === quitarAcentos(s));
    // el libro tal cual, todos los puntos con foto, ninguno, y uno agregado por el dueño
    const variantes: Libro[] = [EJEMPLO];
    for (const valor of ['SI', 'NO']) {
      const v = structuredClone(EJEMPLO);
      v.Checklist_Calidad = [
        v.Checklist_Calidad![0]!,
        ...v.Checklist_Calidad!.slice(1).map((r) => [r[0], r[1], r[2], valor]),
      ];
      v.Checklist_Calidad.push(['PC5 Pre-entrega', 99, 'Punto que agregué yo', 'SI']);
      variantes.push(v);
    }
    for (const v of variantes) {
      const l = llamar<{ cambiados: number; criticos: number }>(legacy('Dueno', v), 'duFotosCriticas', 'T');
      const c = fotosCriticas(
        filas(v, 'Checklist_Calidad').map((r, i) => ({
          id: String(i), requiereFoto: texto(r[3]).toUpperCase() === 'SI', estandar: en(estandar, texto(r[2])), critico: en(criticas, texto(r[2])),
        })),
      ); // prettier-ignore
      expect({ cambiados: c.cambios.length, criticos: c.criticos }).toEqual({
        cambiados: l.cambiados,
        criticos: l.criticos,
      });
    }
  });
});
