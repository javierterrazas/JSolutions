// Paridad de "Esta semana" del dueño, el plan congelado de cada lunes, el cumplimiento semanal (PPC), la semana
// del PM y los días sin cierre, contra el legacy, con cada día del mes simulado. Calendario del legacy.
import { describe, expect, it } from 'vitest';
import {
  CALENDARIO_LEGACY as CAL,
  cronogramaObra,
  cumplimientoSemanal,
  type Dia,
  diasSinCierre,
  estaSemana,
  lunesDe,
  planDeLaSemana,
  realDeAvance,
  semanaDelPM,
  sumarDias,
} from '../../src/index';
import {
  avanceDe,
  cierresDe,
  clavePartida,
  espaciosCrono,
  filas,
  obrasDe,
  ordenesDe,
  subsDe,
} from './convertir';
import { cargarLegacy, diaLocal, funcionLegacy, type Libro } from './legacy';
import { diasSimulados } from './mesSimulado';

const alas10 = (dia: Dia) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 10);
};
const deTexto = (s: string) => (s ? `${s.slice(6, 10)}-${s.slice(0, 2)}-${s.slice(3, 5)}` : null);
const ordenar = <T>(xs: T[]) => xs.map((x) => JSON.stringify(x)).sort();

/** Cada día del mes simulado, al cerrar el día y a la mañana siguiente. */
function casos(): { libro: Libro; hoy: Dia }[] {
  return [...diasSimulados()].flatMap(([d, libro]) => [
    { libro, hoy: d },
    { libro, hoy: sumarDias(d, 1) },
  ]);
}

const cronogramas = (libro: Libro, hoy: Dia) =>
  obrasDe(libro)
    .filter((o) => o.inicio)
    .map((o) => ({
      id: o.id,
      cronograma: cronogramaObra(o.inicio!, espaciosCrono(libro, o.id), avanceDe(libro, o.id), hoy, CAL),
    }));

const nombreSub = (libro: Libro) =>
  new Map(filas(libro, 'Subcontratistas').map((s) => [String(s[0]), String(s[1])]));
const nombreArea = (libro: Libro) => new Map(filas(libro, 'Areas').map((a) => [String(a[0]), String(a[3])]));

describe('paridad de la semana con el legacy', () => {
  it('"Esta semana" del dueño: subs por programar, confirmaciones faltantes y choques', () => {
    const diferencias: string[] = [];
    let conDatos = 0;
    for (const { libro, hoy } of casos()) {
      const ctx = cargarLegacy('Dueno', { libro, ahora: alas10(hoy) });
      const datos = funcionLegacy<(h: string) => unknown[]>(ctx, 'datos_');
      const l = funcionLegacy<
        (o: unknown[], ots: unknown[], subs: unknown[]) => Record<string, Record<string, unknown>[]>
      >(ctx, 'estaSemana_')(datos('Proyectos'), datos('Ordenes_Trabajo'), datos('Subcontratistas'));
      const c = estaSemana(cronogramas(libro, hoy), ordenesDe(libro), subsDe(libro), hoy, CAL);
      const subs = nombreSub(libro);

      const deLegacy = {
        porProgramar: ordenar(
          l.porProgramar!.map((x) => ({
            obra: x.obra,
            partida: `${String(x.areaId)}|${String(x.partida)}`,
            inicio: x.iniISO,
            fin: x.finISO,
            sub: x.sub || null,
          })),
        ),
        sinConfirmar: ordenar(l.sinConfirmar!.map((x) => x.ot)),
        choques: ordenar(
          l.choques!.map((x) => ({ sub: x.sub, obras: x.obras, dia: deTexto(String(x.dia)) })),
        ),
      };
      const deCore = {
        porProgramar: ordenar(
          c.porProgramar.map((x) => ({
            obra: x.obraId,
            partida: x.partidaId,
            inicio: x.inicio,
            fin: x.fin,
            sub: x.subSugerido,
          })),
        ),
        sinConfirmar: ordenar(c.sinConfirmar.map((x) => x.id)),
        choques: ordenar(
          c.choques.map((x) => ({ sub: subs.get(x.subId), obras: x.obras.join(' y '), dia: x.dia })),
        ),
      };
      if (deLegacy.porProgramar.length || deLegacy.sinConfirmar.length || deLegacy.choques.length) conDatos++;
      if (JSON.stringify(deLegacy) !== JSON.stringify(deCore)) {
        diferencias.push(`${hoy}:\n  legacy ${JSON.stringify(deLegacy)}\n  core   ${JSON.stringify(deCore)}`);
      }
    }
    expect(conDatos).toBeGreaterThan(10);
    expect(diferencias.slice(0, 3)).toEqual([]);
  }, 600_000);

  it('el plan que se congela cada lunes', () => {
    const diferencias: string[] = [];
    let partidas = 0;
    for (const { libro, hoy } of casos()) {
      // con la hoja vacía, el legacy congela la semana de hoy
      const sinPlan = { ...libro, Plan_Semanal: [libro.Plan_Semanal![0]!] };
      const ctx = cargarLegacy('Dueno', { libro: sinPlan, ahora: alas10(hoy) });
      const datos = funcionLegacy<(h: string) => unknown[][]>(ctx, 'datos_');
      funcionLegacy<(o: unknown[]) => void>(ctx, 'congelarSemana_')(datos('Proyectos'));
      const l = datos('Plan_Semanal').map((r) => ({
        obra: r[1],
        partida: clavePartida(String(r[2]), r[3]),
        fin: diaLocal(r[4] as Date),
      }));
      const c = cronogramas(libro, hoy).flatMap((o) =>
        planDeLaSemana(o.cronograma, hoy, CAL).map((p) => ({
          obra: o.id,
          partida: p.partidaId,
          fin: p.finPrevisto,
        })),
      );
      partidas += l.length;
      if (JSON.stringify(ordenar(l)) !== JSON.stringify(ordenar(c))) {
        diferencias.push(`${hoy}: legacy ${JSON.stringify(ordenar(l))} · core ${JSON.stringify(ordenar(c))}`);
      }
    }
    expect(partidas).toBeGreaterThan(50);
    expect(diferencias.slice(0, 3)).toEqual([]);
  }, 600_000);

  it('el cumplimiento de la semana pasada (PPC), por obra y de todas', () => {
    const diferencias: string[] = [];
    let conPlan = 0;
    for (const { libro, hoy } of casos()) {
      const ctx = cargarLegacy('Dueno', { libro, ahora: alas10(hoy) });
      const ppc = funcionLegacy<(o: string | null) => { plan: number; hecho: number; ppc: number } | null>(
        ctx,
        'ppcSemanaPasada_',
      );
      const lunesPasado = sumarDias(lunesDe(hoy), -7);
      const plan = filas(libro, 'Plan_Semanal')
        .filter((r) => r[0] instanceof Date && diaLocal(r[0]) === lunesPasado)
        .map((r) => ({ obra: String(r[1]), partidaId: clavePartida(String(r[2]), r[3]) }));
      const real = new Map(obrasDe(libro).flatMap((o) => [...realDeAvance(avanceDe(libro, o.id))]));
      for (const obra of [null, ...obrasDe(libro).map((o) => o.id)]) {
        const l = ppc(obra);
        const c = cumplimientoSemanal(
          plan.filter((p) => !obra || p.obra === obra),
          real,
          lunesPasado,
          CAL,
        );
        if (l) conPlan++;
        if (JSON.stringify(l) !== JSON.stringify(c)) {
          diferencias.push(
            `${hoy} ${obra ?? 'todas'}: legacy ${JSON.stringify(l)} · core ${JSON.stringify(c)}`,
          );
        }
      }
    }
    expect(conPlan).toBeGreaterThan(20);
    expect(diferencias.slice(0, 5)).toEqual([]);
  }, 600_000);

  it('la semana del PM y los días que se le olvidó cerrar', () => {
    const diferencias: string[] = [];
    let olvidos = 0;
    for (const { libro, hoy } of casos()) {
      const ctx = cargarLegacy('PM', { libro, ahora: alas10(hoy) });
      const datos = funcionLegacy<(h: string) => unknown[][]>(ctx, 'datos_');
      const semanaPM = funcionLegacy<
        (o: string) => {
          dias: { fecha: string; items: { partida: string; area: string }[]; llegan: string[] }[];
        } | null
      >(ctx, 'semanaPM_');
      const sinCierre = funcionLegacy<(b: unknown[][], e: string) => { iso: string }[]>(
        ctx,
        'diasSinCierre_',
      );
      const subs = nombreSub(libro);
      const areas = nombreArea(libro);
      const ordenes = ordenesDe(libro);

      for (const obra of obrasDe(libro).filter((o) => o.inicio)) {
        const l = semanaPM(obra.id);
        const cr = cronogramaObra(
          obra.inicio!,
          espaciosCrono(libro, obra.id),
          avanceDe(libro, obra.id),
          hoy,
          CAL,
        );
        const c = semanaDelPM(
          cr,
          ordenes.filter((o) => o.obraId === obra.id),
          hoy,
          CAL,
          5,
        );
        const deLegacy = (l?.dias ?? []).map((d) => ({
          dia: deTexto(d.fecha),
          partidas: d.items.map((i) => `${i.area} · ${i.partida}`),
          llegan: d.llegan,
        }));
        const deCore = c.dias.map((d) => ({
          dia: d.dia,
          partidas: d.partidas.map((p) => `${areas.get(p.split('|')[0]!)} · ${p.split('|')[1]}`),
          llegan: d.llegan.map((id) => subs.get(ordenes.find((o) => o.id === id)!.subId)),
        }));
        if (JSON.stringify(deLegacy) !== JSON.stringify(deCore)) {
          diferencias.push(
            `${hoy} ${obra.id} semana: legacy ${JSON.stringify(deLegacy)} · core ${JSON.stringify(deCore)}`,
          );
        }

        const bits = datos('Bitacora').filter((b) => b[2] === obra.id);
        const ls = sinCierre(bits, obra.estado).map((x) => x.iso);
        const cs = diasSinCierre(cierresDe(libro, obra.id), obra.estado === 'En obra', hoy, CAL);
        olvidos += ls.length;
        if (JSON.stringify(ls) !== JSON.stringify(cs)) {
          diferencias.push(
            `${hoy} ${obra.id} sin cierre: legacy ${JSON.stringify(ls)} · core ${JSON.stringify(cs)}`,
          );
        }
      }
    }
    expect(olvidos).toBeGreaterThan(0);
    expect(diferencias.slice(0, 5)).toEqual([]);
  }, 600_000);
});
