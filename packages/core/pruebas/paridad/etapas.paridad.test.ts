// Paridad del avance ponderado, el presupuesto por etapa, los costos por etapa y los costos unitarios
// históricos, contra el legacy, con el libro de ejemplo y con cada día del mes simulado.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  avanceDeObra,
  claveEtapa,
  costosPorEtapa,
  costosUnitarios,
  type Dia,
  etapasDeEspacio,
  montoSugerido,
} from '../../src/index';
import {
  avanceDe,
  cargosDe,
  espaciosAvance,
  espaciosEtapas,
  obrasDe,
  obrasParaHistorico,
  presupuestoDe,
} from './convertir';
import { cargarLegacy, funcionLegacy, type Libro } from './legacy';
import { diasSimulados } from './mesSimulado';
import { leerLibro } from './xlsx';

const EJEMPLO = leerLibro(
  fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url)),
);
const SIN_ETAPA = 'Otras partidas';
/** Montos con 6 decimales: el legacy y core suman en el mismo orden, pero así no importa el último bit. */
const r6 = (n: unknown) => (n === null || n === undefined ? null : Math.round(Number(n) * 1e6) / 1e6);
const alas10 = (dia: Dia) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 10);
};

/** El libro de ejemplo y cada día del mes simulado. */
const casos = (): { nombre: string; libro: Libro; hoy: Dia }[] => [
  { nombre: 'libro de ejemplo', libro: EJEMPLO, hoy: '2026-10-15' },
  ...[...diasSimulados()].map(([d, libro]) => ({ nombre: `mes simulado, ${d}`, libro, hoy: d })),
];

describe('paridad del avance y las etapas con el legacy', () => {
  it('el avance ponderado de cada obra, total y por espacio', () => {
    const diferencias: string[] = [];
    let conAvance = 0;
    for (const caso of casos()) {
      const ctx = cargarLegacy('Dueno', { libro: caso.libro, ahora: alas10(caso.hoy) });
      const legacy = funcionLegacy<
        (o: string) => { pct: number; curso: number; porArea: { pct: number; curso: number }[] }
      >(ctx, 'avanceObra_');
      for (const obra of obrasDe(caso.libro)) {
        const l = legacy(obra.id);
        const c = avanceDeObra(espaciosAvance(caso.libro, obra.id), avanceDe(caso.libro, obra.id));
        const deLegacy = [r6(l.pct), r6(l.curso), ...l.porArea.map((a) => [r6(a.pct), r6(a.curso)])];
        const deCore = [r6(c.pct), r6(c.curso), ...c.porEspacio.map((a) => [r6(a.pct), r6(a.curso)])];
        if (l.pct || l.curso) conAvance++;
        if (JSON.stringify(deLegacy) !== JSON.stringify(deCore)) {
          diferencias.push(
            `${caso.nombre} ${obra.id}: legacy ${JSON.stringify(deLegacy)} · core ${JSON.stringify(deCore)}`,
          );
        }
      }
    }
    expect(conAvance).toBeGreaterThan(50);
    expect(diferencias.slice(0, 3)).toEqual([]);
  }, 600_000);

  it('las etapas de cada espacio y su presupuesto (también el formato antiguo, por partida)', () => {
    const diferencias: string[] = [];
    let conMonto = 0;
    for (const caso of casos()) {
      const ctx = cargarLegacy('Dueno', { libro: caso.libro, sesiones: { T: 'javier' } });
      type Etapa = {
        etapa: string;
        partidas: string[];
        monto: number;
        historico: { sugerido: number } | null;
      };
      const legacy = funcionLegacy<
        (t: string, o: string) => { areas: { id: string; etapas: Etapa[] }[]; total: number }
      >(ctx, 'duPresupuesto');
      const historico = new Map(
        costosUnitarios(obrasParaHistorico(caso.libro)).map((u) => [
          `${u.tipoEspacioId}|${u.etapaId ?? ''}`,
          u,
        ]),
      );
      for (const obra of obrasDe(caso.libro)) {
        const l = legacy('T', obra.id);
        const espacios = espaciosEtapas(caso.libro, obra.id);
        const presu = new Map(
          presupuestoDe(caso.libro, obra.id).map((x) => [claveEtapa(x.espacioId, x.etapaId), x.monto]),
        );
        const deLegacy = l.areas.map((a) => ({
          espacio: a.id,
          etapas: a.etapas.map((e) => ({
            etapa: e.etapa === SIN_ETAPA ? null : e.etapa,
            partidas: e.partidas.map((p) => `${a.id}|${p}`),
            monto: r6(e.monto),
            sugerido: e.historico?.sugerido ?? null,
          })),
        }));
        const deCore = espacios.map((e) => ({
          espacio: e.id,
          etapas: etapasDeEspacio(e).map((et) => {
            const h = e.generales ? undefined : historico.get(`${e.tipoEspacioId}|${et.etapaId ?? ''}`);
            return {
              etapa: et.etapaId,
              partidas: et.partidas,
              monto: r6(presu.get(claveEtapa(e.id, et.etapaId)) ?? 0),
              sugerido: h ? (e.pies2 ? montoSugerido(h.promedio, e.pies2) : 0) : null,
            };
          }),
        }));
        if (l.total) conMonto++;
        if (JSON.stringify(deLegacy) !== JSON.stringify(deCore)) {
          diferencias.push(
            `${caso.nombre} ${obra.id}:\n  legacy ${JSON.stringify(deLegacy)}\n  core   ${JSON.stringify(deCore)}`,
          );
        }
      }
    }
    expect(conMonto).toBeGreaterThan(20);
    expect(diferencias.slice(0, 2)).toEqual([]);
  }, 600_000);

  it('el costo real por espacio y etapa contra su presupuesto (detalle de obra del dueño)', () => {
    const diferencias: string[] = [];
    let conCosto = 0;
    for (const caso of casos()) {
      const ctx = cargarLegacy('Dueno', {
        libro: caso.libro,
        ahora: alas10(caso.hoy),
        sesiones: { T: 'javier' },
      });
      type Fila = Record<string, unknown> & { partidas: { partida: string; total: number }[] };
      const legacy = funcionLegacy<(t: string, o: string) => { costoPorEtapa: Fila[] }>(ctx, 'duDetalleObra');
      for (const obra of obrasDe(caso.libro)) {
        const l = legacy('T', obra.id).costoPorEtapa;
        const c = costosPorEtapa(
          espaciosEtapas(caso.libro, obra.id),
          cargosDe(caso.libro, obra.id),
          presupuestoDe(caso.libro, obra.id),
        );
        const deLegacy = l.map((y) => ({
          espacio: y.areaId,
          etapa: y.etapa === SIN_ETAPA ? null : y.etapa,
          cubos: [y.material, y.cuadrilla, y.sub, y.total, y.presupuesto].map(r6),
          desvio: r6(y.desvio),
          unitario: r6(y.unitario),
          unitarioPresupuesto: r6(y.unitarioPresu),
          partidas: y.partidas.map((p) => [
            p.partida === '(sin asignar)' ? null : `${String(y.areaId)}|${p.partida}`,
            r6(p.total),
          ]),
        }));
        const deCore = c.map((y) => ({
          espacio: y.espacioId,
          etapa: y.etapaId,
          cubos: [y.material, y.cuadrilla, y.sub, y.total, y.presupuesto].map(r6),
          desvio: r6(y.desvio),
          unitario: r6(y.unitario),
          unitarioPresupuesto: r6(y.unitarioPresupuesto),
          partidas: y.partidas.map((p) => [p.partidaId, r6(p.total)]),
        }));
        conCosto += l.filter((y) => y.total).length;
        if (JSON.stringify(deLegacy) !== JSON.stringify(deCore)) {
          diferencias.push(
            `${caso.nombre} ${obra.id}:\n  legacy ${JSON.stringify(deLegacy)}\n  core   ${JSON.stringify(deCore)}`,
          );
        }
      }
    }
    expect(conCosto).toBeGreaterThan(100);
    expect(diferencias.slice(0, 2)).toEqual([]);
  }, 600_000);

  it('los costos unitarios históricos por tipo de espacio y etapa', () => {
    const diferencias: string[] = [];
    let entradas = 0;
    for (const caso of casos()) {
      const ctx = cargarLegacy('Dueno', { libro: caso.libro });
      type U = { n: number; prom: number; min: number; max: number; promPresupuesto: number };
      const l = funcionLegacy<() => Record<string, U>>(ctx, 'costosUnitarios_')();
      const deLegacy = Object.fromEntries(
        Object.entries(l).map(([k, u]) => [
          k.endsWith('|' + SIN_ETAPA) ? k.slice(0, -SIN_ETAPA.length) : k,
          [u.n, r6(u.prom), r6(u.min), r6(u.max), r6(u.promPresupuesto)],
        ]),
      );
      const deCore = Object.fromEntries(
        costosUnitarios(obrasParaHistorico(caso.libro)).map((u) => [
          `${u.tipoEspacioId}|${u.etapaId ?? ''}`,
          [u.n, r6(u.promedio), r6(u.minimo), r6(u.maximo), r6(u.promedioPresupuesto)],
        ]),
      );
      entradas += Object.keys(deLegacy).length;
      const ordenar = (o: Record<string, unknown>) => JSON.stringify(Object.entries(o).sort());
      if (ordenar(deLegacy) !== ordenar(deCore)) {
        diferencias.push(`${caso.nombre}:\n  legacy ${ordenar(deLegacy)}\n  core   ${ordenar(deCore)}`);
      }
    }
    expect(entradas).toBeGreaterThan(30);
    expect(diferencias.slice(0, 2)).toEqual([]);
  }, 600_000);
});
