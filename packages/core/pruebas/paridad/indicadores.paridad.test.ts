// Paridad de los 19 indicadores con el tablero del legacy (kpis_), en cada día del mes simulado y en el libro de
// ejemplo, por la mañana y por la noche (varios dependen de cuántas horas han pasado).
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CALENDARIO_LEGACY as CAL,
  type ClaveIndicador,
  type Configuracion,
  calcularIndicadores,
  cumplimientoSemanal,
  type DatosIndicadores,
  type Dia,
  INDICADORES,
  lunesDe,
  realDeAvance,
  sumarDias,
} from '../../src/index';
import { avanceDe, clavePartida, filas } from './convertir';
import { cargarLegacy, type ContextoLegacy, diaLocal, funcionLegacy, type Libro } from './legacy';
import { diasSimulados } from './mesSimulado';
import { leerLibro } from './xlsx';

const EJEMPLO = leerLibro(
  fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url)),
);
const texto = (v: unknown) => String(v ?? '').trim();
const fecha = (v: unknown) => (v instanceof Date ? v : null);
const alas = (dia: Dia, hora: number) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hora);
};
const r6 = (n: unknown) => Math.round(Number(n) * 1e6) / 1e6;
const llamar = <T>(ctx: ContextoLegacy, fn: string, ...args: unknown[]) =>
  funcionLegacy<(...a: unknown[]) => T>(ctx, fn)(...args);

/** La configuración del libro, como la lee kpis_ (con sus valores por omisión). */
function configuracionDe(libro: Libro): Configuracion {
  const cfg = new Map(filas(libro, 'Config').map((r) => [texto(r[0]), Number(r[1])]));
  const num = (k: string, omision: number) => cfg.get(k) || omision;
  return {
    slaAvisosHoras: num('SLA_BLOQUEO_HORAS', 24),
    slaOrdenesCambioHoras: num('SLA_OC_HORAS', 48),
    horasSinRecibo: num('HORAS_SIN_RECIBO', 72),
    margenMinimoOC: num('MARGEN_MINIMO_OC', 0.35),
    metas: {
      tasa_cierre_dia: num('META_TASA_REPORTE', 0.95),
      presentacion_subs: num('META_PRESENTACION_SUBS', 0.9),
      oc_autorizadas: num('META_OC_AUTORIZADAS', 0.7),
      oc_sobre_contratos: num('MAX_OC_SOBRE_CONTRATO', 0.2),
      no_calidad_sobre_contratos: num('MAX_NO_CALIDAD', 0.02),
    },
  };
}

/** Las hojas del legacy convertidas a lo que miden los indicadores. Los estados de las obras, ya saneados. */
function datosDe(libro: Libro, proyectos: unknown[][], hoy: Dia): DatosIndicadores {
  const lunesPasado = sumarDias(lunesDe(hoy), -7);
  const plan = filas(libro, 'Plan_Semanal')
    .filter((r) => r[0] instanceof Date && diaLocal(r[0]) === lunesPasado)
    .map((r) => ({ partidaId: clavePartida(texto(r[2]), r[3]) }));
  const real = new Map(proyectos.flatMap((p) => [...realDeAvance(avanceDe(libro, texto(p[0])))]));
  return {
    obras: proyectos.map((p) => ({
      id: texto(p[0]),
      enObra: p[9] === 'En obra',
      inicio: fecha(p[6]) ? diaLocal(p[6] as Date) : null,
      contrato: Number(p[10]) || 0,
    })),
    cierres: filas(libro, 'Bitacora').map((b) => ({
      obraId: texto(b[2]),
      dia: diaLocal(b[1] as Date),
      conTrabajo: texto(b[4]) !== '',
    })),
    cumplimientoSemanaPasada: cumplimientoSemanal(plan, real, lunesPasado, CAL),
    avisos: filas(libro, 'Bloqueos').map((b) => ({
      abiertoEn: b[1] as Date,
      abierto: b[8] === 'Abierto',
      respondidoEn: fecha(b[10]),
    })),
    gastosPM: filas(libro, 'Gastos')
      .filter((g) => !texto(g[0]).startsWith('GOF'))
      .map((g) => ({ registradoEn: g[1] as Date, conRecibo: !!texto(g[9]) })),
    ordenesTrabajo: filas(libro, 'Ordenes_Trabajo').map((o) => ({
      id: texto(o[0]),
      cancelada: o[8] === 'Cancelada',
      precio: Number(o[5]) || 0,
      sePresento:
        texto(o[10]).toUpperCase() === 'SI' ? true : texto(o[10]).toUpperCase() === 'NO' ? false : null,
      faltas: Number(o[15]) || 0,
      aprobada: !!o[11],
    })),
    pagosSub: filas(libro, 'Pagos_Sub').map((p) => ({
      ordenTrabajoId: texto(p[2]),
      liquidacion: p[5] === 'Liquidacion',
      monto: Number(p[6]) || 0,
    })),
    inspecciones: filas(libro, 'Calidad').map((c) => ({ conDefectos: c[5] === 'Con defectos' })),
    pruebasAgua: filas(libro, 'Pruebas_Agua').map((a) => ({ conFuga: a[7] === 'Con fuga' })),
    punch: filas(libro, 'Punch_List').map((x) => ({
      cerrado: x[7] === 'Cerrado',
      compromiso: fecha(x[6]) ? diaLocal(x[6] as Date) : '',
      cerradoEl: fecha(x[8]) ? diaLocal(x[8] as Date) : null,
    })),
    entregas: filas(libro, 'Entrega').map((e) => ({ resenaRecibida: texto(e[7]).toUpperCase() === 'SI' })),
    noCalidad: filas(libro, 'No_Calidad').map((n) => ({
      garantia: n[3] === 'Garantia',
      costo: Number(n[6]) || 0,
      diasPerdidos: Number(n[7]) || 0,
    })),
    ordenesCambio: filas(libro, 'Ordenes_Cambio').map((o) => ({
      propuesta: o[9] === 'Propuesta',
      autorizada: o[9] === 'Autorizada' || o[9] === 'Facturada',
      emitidaEn: fecha(o[10]),
      costo: Number(o[5]) || 0,
      precio: Number(o[6]) || 0,
    })),
  };
}

const SEMAFORO: Record<string, string> = { VERDE: 'verde', AMBAR: 'ambar', ROJO: 'rojo', INFO: 'info' };

// Diferencia conocida (D-034): en el libro de ejemplo, escrito a mano, el aviso BLQ-0001 trae 3 horas de respuesta
// tecleadas, pero sus fechas de apertura y respuesta son el mismo día sin hora. El legacy usa las horas guardadas;
// core las calcula con las fechas. En el mes simulado, que guarda las horas al responder, coinciden siempre.
const CONOCIDA = (caso: string, clave: string) =>
  caso === 'libro de ejemplo' && clave === 'horas_respuesta_avisos';

describe('paridad de los 19 indicadores con el legacy', () => {
  it('valor, meta, semáforo, "sin datos" y si es de los seis del lunes, en cada día', () => {
    const diferencias: string[] = [];
    const conValor = new Map<ClaveIndicador, number>();
    // En el mes simulado nadie registra una reseña recibida: una variante del último día la marca en la mitad de
    // las entregas, para que esa regla también se compare.
    const [ultimoDia, ultimo] = [...diasSimulados()].slice(-1)[0]!;
    const conResenas = structuredClone(ultimo);
    conResenas.Entrega!.slice(1).forEach((e, i) => {
      if (texto(e[0]) && i % 2 === 0) e[7] = 'SI';
    });
    const casos: { nombre: string; libro: Libro; hoy: Dia }[] = [
      { nombre: 'libro de ejemplo', libro: EJEMPLO, hoy: '2026-09-15' },
      ...[...diasSimulados()].map(([d, libro]) => ({ nombre: d, libro, hoy: d })),
      { nombre: `${ultimoDia}, con reseñas`, libro: conResenas, hoy: ultimoDia },
    ];
    for (const caso of casos) {
      for (const hora of [10, 21]) {
        const ahora = alas(caso.hoy, hora);
        const ctx = cargarLegacy('Dueno', { libro: caso.libro, ahora, sesiones: { T: 'javier' } });
        // los estados de las obras, saneados como lo hace el tablero antes de calcular
        llamar(ctx, 'sanarEstados_');
        llamar(ctx, '__limpiarMemo');
        const proyectos = llamar<unknown[][]>(ctx, 'datos_', 'Proyectos');
        type K = { real: number; meta: number; sem: string; sinDatos?: boolean; top: boolean };
        const l = llamar<{ kpis: K[] }>(ctx, 'calcularDatos_', 'T').kpis;
        const c = calcularIndicadores(
          datosDe(caso.libro, proyectos, caso.hoy),
          configuracionDe(caso.libro),
          ahora,
          caso.hoy,
          CAL,
        );
        expect(l.length).toBe(19);
        l.forEach((k, i) => {
          const x = c[i]!;
          const deLegacy = [r6(k.real), r6(k.meta), SEMAFORO[k.sem], !!k.sinDatos, k.top];
          const deCore = [r6(x.valor), r6(x.meta), x.semaforo, x.sinDatos, x.principal];
          if (x.valor && !x.sinDatos) conValor.set(x.clave, (conValor.get(x.clave) ?? 0) + 1);
          if (JSON.stringify(deLegacy) !== JSON.stringify(deCore) && !CONOCIDA(caso.nombre, x.clave)) {
            diferencias.push(
              `${caso.nombre} ${hora}:00 ${INDICADORES[i]}: legacy ${JSON.stringify(deLegacy)} · core ${JSON.stringify(deCore)}`,
            );
          }
        });
      }
    }
    expect(diferencias.slice(0, 8)).toEqual([]);
    // que cada indicador haya medido algo distinto de cero en algún día (si no, la paridad no lo probó)
    expect(INDICADORES.filter((k) => !conValor.get(k))).toEqual([]);
  }, 600_000);
});
