// Paridad del cronograma: plan, previsión, fecha de entrega propuesta y atraso, contra el legacy, con los datos del
// libro de ejemplo y con los de cada día del mes simulado. Con el calendario del legacy (lunes a viernes, sin
// feriados): el calendario real de cada empresa se prueba en src/cronograma.test.ts.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  atraso,
  atrasoPrevisto,
  avanceEsperado,
  CALENDARIO_LEGACY as CAL,
  cronogramaObra,
  type Dia,
  fechaComprometida,
  proponerEntrega,
  sumarDias,
} from '../../src/index';
import { avanceDe, espaciosCrono, filas, obrasDe, plantilla } from './convertir';
import { cargarLegacy, diaLocal, funcionLegacy, type Libro } from './legacy';
import { diasSimulados } from './mesSimulado';
import { leerLibro } from './xlsx';

const EJEMPLO = leerLibro(
  fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url)),
);

/** Esa hora de ese día, hora local: el "ahora" del legacy. */
const alas = (dia: Dia, hora: number) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hora);
};
const alas10 = (dia: Dia) => alas(dia, 10);
const deFecha = (v: unknown) => (v instanceof Date ? diaLocal(v) : null);
/** fecha_() del legacy: "MM/dd/yyyy" → "yyyy-MM-dd". */
const deTexto = (s: string) => (s ? `${s.slice(6, 10)}-${s.slice(0, 2)}-${s.slice(3, 5)}` : null);
const rango = (desde: Dia, hasta: Dia) => {
  const out: Dia[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) out.push(d);
  return out;
};

/** Cada caso: unas hojas y el día que el legacy ve como hoy. */
function casos(): { nombre: string; libro: Libro; hoy: Dia }[] {
  const out: { nombre: string; libro: Libro; hoy: Dia }[] = [];
  for (const [d, libro] of diasSimulados()) {
    // al cerrar el día y a la mañana siguiente (también en fin de semana)
    out.push({ nombre: `mes simulado, ${d}`, libro, hoy: d });
    out.push({ nombre: `mes simulado, ${d} + 1`, libro, hoy: sumarDias(d, 1) });
  }
  for (const hoy of rango('2026-08-24', '2026-10-25'))
    out.push({ nombre: `libro de ejemplo, ${hoy}`, libro: EJEMPLO, hoy });
  return out;
}

interface FilaLegacy {
  area: string;
  partida: string;
  ini: Date;
  fin: Date;
  planIni: Date;
  planFin: Date;
  estado: string;
}

const ESTADO: Record<string, string> = {
  'Sin iniciar': 'sin_iniciar',
  'En progreso': 'en_progreso',
  Terminada: 'terminada',
};

describe('paridad del cronograma con el legacy', () => {
  it('plan y previsión de cada obra, en cada día', () => {
    const diferencias: string[] = [];
    let comparadas = 0;
    for (const caso of casos()) {
      const ctx = cargarLegacy('Dueno', { libro: caso.libro, ahora: alas10(caso.hoy) });
      const legacy = funcionLegacy<
        (id: string) => { filas: FilaLegacy[]; planFin: Date; prevFin: Date } | null
      >(ctx, 'cronogramaObra_');
      for (const obra of obrasDe(caso.libro)) {
        const l = legacy(obra.id);
        if (!obra.inicio) {
          if (l) diferencias.push(`${caso.nombre} ${obra.id}: el legacy calcula sin fecha de inicio`);
          continue;
        }
        const c = cronogramaObra(
          obra.inicio,
          espaciosCrono(caso.libro, obra.id),
          avanceDe(caso.libro, obra.id),
          caso.hoy,
          CAL,
        );
        const deLegacy = {
          planFin: deFecha(l?.planFin),
          prevFin: deFecha(l?.prevFin),
          filas: (l?.filas ?? []).map((f) => ({
            partida: `${f.area}|${f.partida}`,
            planIni: deFecha(f.planIni),
            planFin: deFecha(f.planFin),
            ini: deFecha(f.ini),
            fin: deFecha(f.fin),
            estado: ESTADO[f.estado],
          })),
        };
        const deCore = {
          planFin: c.planFin,
          prevFin: c.prevFin,
          filas: c.filas.map((f) => ({
            partida: f.partidaId,
            planIni: f.planIni,
            planFin: f.planFin,
            ini: f.ini,
            fin: f.fin,
            estado: f.estado,
          })),
        };
        comparadas++;
        if (JSON.stringify(deLegacy) !== JSON.stringify(deCore)) {
          diferencias.push(
            `${caso.nombre} ${obra.id}:\n  legacy ${JSON.stringify(deLegacy)}\n  core   ${JSON.stringify(deCore)}`,
          );
        }
      }
    }
    expect(comparadas).toBeGreaterThan(300);
    expect(diferencias.slice(0, 3)).toEqual([]);
  }, 600_000);

  it('la fecha de entrega que se propone al dar de alta', () => {
    const tipos = [...new Set(filas(EJEMPLO, 'Partidas_Catalogo').map((c) => String(c[0])))].filter(
      (t) => t !== 'Generales',
    );
    const combinaciones = [
      ...tipos.map((t) => [t]),
      ...tipos.flatMap((a, i) => tipos.slice(i + 1).map((b) => [a, b])),
      tipos,
    ];
    const diferencias: string[] = [];
    let comparadas = 0;
    for (const inicio of rango('2026-10-01', '2026-10-21')) {
      const ctx = cargarLegacy('Dueno', { libro: EJEMPLO, sesiones: { T: 'javier' } });
      const legacy = funcionLegacy<
        (t: string, i: string, tipos: string[]) => { fecha: string; dias: number } | null
      >(ctx, 'duProponerEntrega');
      for (const combo of combinaciones) {
        const l = legacy('T', inicio, combo);
        const c = proponerEntrega(
          inicio,
          combo.map((t) => plantilla(EJEMPLO, t)),
          plantilla(EJEMPLO, 'Generales'),
          CAL,
        );
        comparadas++;
        if (JSON.stringify(l) !== JSON.stringify(c)) {
          diferencias.push(
            `${inicio} ${combo.join(' + ')}: legacy ${JSON.stringify(l)} · core ${JSON.stringify(c)}`,
          );
        }
      }
    }
    expect(comparadas).toBeGreaterThan(100);
    expect(diferencias.slice(0, 5)).toEqual([]);
  });

  // Diferencia conocida (D-030): el día de inicio, el legacy da 0 % de avance esperado antes del mediodía y 1/n
  // después, porque guarda el inicio a las 12:00 y lo compara con la hora actual. core da 1/n todo el día.
  it('fecha comprometida, atraso, atraso previsto y avance esperado del tablero del dueño', () => {
    const diferencias: string[] = [];
    const conocidas: string[] = [];
    let comparadas = 0;
    for (const [d, libro] of diasSimulados()) {
      for (const [hoy, hora] of [
        [d, 10],
        [d, 13],
        [sumarDias(d, 1), 10],
      ] as const) {
        const ctx = cargarLegacy('Dueno', { libro, ahora: alas(hoy, hora), sesiones: { T: 'javier' } });
        const tablero = funcionLegacy<(t: string) => { tablero: Record<string, unknown>[] }>(
          ctx,
          'calcularDatos_',
        )('T').tablero;
        for (const t of tablero) {
          const obra = obrasDe(libro).find((o) => o.id === t.id)!;
          const diasOC = filas(libro, 'Ordenes_Cambio')
            .filter((o) => o[1] === obra.id && ['Autorizada', 'Facturada'].includes(String(o[9])))
            .reduce((a, o) => a + (Number(o[8]) || 0), 0);
          const entregada = filas(libro, 'Entrega').some((e) => e[1] === obra.id);
          const comprometida = fechaComprometida(obra.finEstimada!, diasOC, CAL);
          const prevFin = entregada
            ? null
            : cronogramaObra(obra.inicio!, espaciosCrono(libro, obra.id), avanceDe(libro, obra.id), hoy, CAL)
                .prevFin;
          const deCore = {
            compromiso: comprometida,
            atraso: atraso(comprometida, hoy, entregada, CAL),
            prevFin,
            atrasoPrevisto: entregada ? 0 : atrasoPrevisto(comprometida, prevFin, CAL),
            esperado: Math.round(avanceEsperado(obra.inicio!, comprometida, hoy, CAL) * 1e9),
          };
          const deLegacy = {
            compromiso: deTexto(String(t.compromiso)),
            atraso: t.atraso,
            prevFin: deTexto(String(t.prevFin)),
            atrasoPrevisto: t.atrasoPrevisto,
            esperado: Math.round(Number(t.esperado) * 1e9),
          };
          comparadas++;
          if (JSON.stringify(deLegacy) === JSON.stringify(deCore)) continue;
          const linea = `${hoy} ${hora}:00 ${obra.id}: legacy ${JSON.stringify(deLegacy)} · core ${JSON.stringify(deCore)}`;
          const soloElInicio = hora < 12 && hoy === obra.inicio && deLegacy.esperado === 0;
          if (
            soloElInicio &&
            JSON.stringify({ ...deLegacy, esperado: deCore.esperado }) === JSON.stringify(deCore)
          ) {
            conocidas.push(linea);
          } else diferencias.push(linea);
        }
      }
    }
    expect(comparadas).toBeGreaterThan(100);
    expect(diferencias.slice(0, 5)).toEqual([]);
    expect(conocidas.length).toBeGreaterThan(0);
  }, 600_000);
});
