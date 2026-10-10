// Paridad de lo que se escribe: la copia de las plantillas al dar de alta, agregar y quitar partidas de una obra,
// y guardar el presupuesto por etapa. Se le pide al legacy la misma operación (sobre una copia de las hojas) y se
// compara lo que guarda, o el error que da, con lo que decide packages/core.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  agregarPartida,
  claveEtapa,
  copiarPlantilla,
  type DatosPartida,
  ErrorDeNegocio,
  type LineaPresupuesto,
  normalizarPresupuesto,
  presupuestoCompleto,
  presupuestoDesdePartidas,
  validarQuitarPartida,
} from '../../src/index';
import { areasDe, avanceDe, espaciosEtapas, filas, obrasDe } from './convertir';
import { cargarLegacy, type ContextoLegacy, funcionLegacy, type Libro } from './legacy';
import { diasSimulados } from './mesSimulado';
import { leerLibro } from './xlsx';

const EJEMPLO = leerLibro(
  fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url)),
);
const texto = (v: unknown) => String(v ?? '').trim();

/** Los mensajes del legacy y los códigos de core que dicen lo mismo (D-015). */
const CODIGO_DE_MENSAJE: [RegExp, string][] = [
  [/Esa obra ya esta cerrada/, 'obra_cerrada'],
  [/Escribe por que se quita/, 'falta_motivo'],
  [/Escribe el nombre de la partida/, 'partida_sin_nombre'],
  [/Ese punto de control no existe/, 'hito_inexistente'],
  [/Esa partida ya esta en/, 'partida_repetida'],
  [/ya tiene avance, horas u ordenes de trabajo/, 'partida_en_uso'],
  [/Un monto no puede ser negativo/, 'monto_negativo'],
  [/no es una etapa de este espacio/, 'etapa_no_es_del_espacio'],
];
function codigoDeLegacy(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return CODIGO_DE_MENSAJE.find(([re]) => re.test(msg))?.[1] ?? `mensaje desconocido: ${msg}`;
  }
}
function codigoDeCore(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof ErrorDeNegocio) return e.codigo;
    throw e;
  }
}

/** Una partida del catálogo del legacy, como entrada de core. */
const datosDe = (c: unknown[]): DatosPartida & { orden: number } => {
  const quien = texto(c[6]) || 'Cuadrilla';
  const esSub = !['cuadrilla', 'pm'].includes(quien.toLowerCase());
  return {
    orden: Number(c[1]) || 0,
    nombre: texto(c[2]),
    hitoId: texto(c[3]) || null,
    peso: Number(c[4]),
    dias: Number(c[5]),
    responsable: esSub ? 'subcontratista' : quien.toLowerCase() === 'pm' ? 'pm' : 'cuadrilla',
    oficioId: esSub ? quien : null,
    paralelo: texto(c[7]).toUpperCase() === 'SI',
    espera: Number(c[8]),
    etapaId: texto(c[9]) || null,
  };
};

const cerrada = (libro: Libro, obraId: string) => filas(libro, 'Obras_Cerradas').some((c) => c[1] === obraId);
const legacyDueno = (libro: Libro) => cargarLegacy('Dueno', { libro, sesiones: { T: 'javier' } });
/** Las hojas como están ahora: se olvida lo que el legacy ya había leído. */
const datos = (ctx: ContextoLegacy, hoja: string) => {
  funcionLegacy<() => void>(ctx, '__limpiarMemo')();
  return funcionLegacy<(h: string) => unknown[][]>(ctx, 'datos_')(hoja);
};

describe('paridad de las partidas de cada obra', () => {
  it('al dar de alta, cada espacio copia las partidas de su plantilla', () => {
    const tipos = [...new Set(filas(EJEMPLO, 'Partidas_Catalogo').map((c) => texto(c[0])))].filter(
      (t) => t !== 'Generales',
    );
    const ctx = legacyDueno(EJEMPLO);
    const r = funcionLegacy<(t: string, p: unknown) => { id: string }>(ctx, 'duNuevaObra')('T', {
      cliente: 'Prueba de paridad', telefono: '512-555-0199', direccion: '1 Paridad St', pm: 'carlos',
      inicio: '2026-11-02', finEst: '2026-12-18', contrato: 30000,
      areas: tipos.map((t) => ({ tipo: t, nombre: t, pies2: 40 })),
    }); // prettier-ignore
    const areas = datos(ctx, 'Areas').filter((a) => a[1] === r.id);
    const copiadas = datos(ctx, 'Partidas_Obra');
    expect(areas.length).toBe(tipos.length + 1);
    for (const a of areas) {
      const deLegacy = copiadas
        .filter((p) => p[0] === a[0])
        .map((p) => datosDe([a[2], p[2], p[3], p[4], p[5], p[7], p[8], p[9], p[10], p[11]]))
        .map((p) => ({ ...p, peso: p.peso, dias: p.dias, espera: p.espera }));
      const deCore = copiarPlantilla(
        filas(EJEMPLO, 'Partidas_Catalogo')
          .filter((c) => c[0] === a[2])
          .map(datosDe),
      );
      expect(deLegacy.map((p) => ({ ...p, nombre: p.nombre }))).toEqual(
        deCore.map((p) => ({ ...p, hitoId: p.hitoId, oficioId: p.oficioId })),
      );
    }
  });

  it('agregar una partida solo a esta obra: al final, con sus valores de omisión, o el mismo error', () => {
    const obra = obrasDe(EJEMPLO).find((o) => areasDe(EJEMPLO, o.id).some((a) => a.tipo === 'Baño'))!;
    const area = areasDe(EJEMPLO, obra.id).find((a) => a.tipo === 'Baño')!;
    const hitos = new Set(filas(EJEMPLO, 'Checklist_Calidad').map((c) => texto(c[0])));
    const casos: Record<string, unknown>[] = [
      { partida: 'Nicho adicional', peso: 2, dias: 1, etapa: 'Tile' },
      {
        partida: 'Banco de regadera',
        hito: 'PC3 Impermeabilización',
        quien: 'Tile',
        paralelo: true,
        espera: 2,
      },
      { partida: 'Retoque', peso: 0, dias: 0 },
      { partida: '   ' },
      { partida: 'Tile de piso y muro' },
      { partida: 'tile de piso y MURO' },
      { partida: 'Extra', hito: 'PC9 Inventado' },
    ];
    for (const caso of casos) {
      const ctx = legacyDueno(EJEMPLO);
      // la copia propia del área, como la crea el legacy antes de agregar
      funcionLegacy<(o: string, a: string) => unknown>(ctx, 'asegurarCopiaArea_')(obra.id, area.id);
      const antes = datos(ctx, 'Partidas_Obra').filter((p) => p[0] === area.id);
      const errorLegacy = codigoDeLegacy(() =>
        funcionLegacy<(t: string, o: string, a: string, p: unknown) => unknown>(ctx, 'duAgregarPartidaObra')(
          'T',
          obra.id,
          area.id,
          caso,
        ),
      );
      let deCore: unknown = null;
      const errorCore = codigoDeCore(() => {
        deCore = agregarPartida(
          antes.map((p) => ({ nombre: texto(p[3]), orden: Number(p[2]), activa: texto(p[6]) !== 'Quitada' })),
          {
            nombre: String(caso.partida),
            hitoId: (caso.hito as string) ?? null,
            peso: Number(caso.peso) || null,
            dias: Number(caso.dias) || null,
            responsable: caso.quien ? 'subcontratista' : null,
            oficioId: (caso.quien as string) ?? null,
            paralelo: !!caso.paralelo,
            espera: Number(caso.espera) || null,
            etapaId: (caso.etapa as string) ?? null,
          },
          hitos,
          cerrada(EJEMPLO, obra.id),
        );
      });
      expect(errorCore, JSON.stringify(caso)).toBe(errorLegacy);
      if (!errorLegacy) {
        const nueva = datos(ctx, 'Partidas_Obra')
          .filter((p) => p[0] === area.id)
          .slice(-1)[0]!;
        const deLegacy = datosDe([
          area.tipo,
          nueva[2],
          nueva[3],
          nueva[4],
          nueva[5],
          nueva[7],
          nueva[8],
          nueva[9],
          nueva[10],
          nueva[11],
        ]);
        expect(deCore, JSON.stringify(caso)).toEqual(deLegacy);
      }
    }
  });

  it('quitar una partida solo si no tiene avance, horas ni órdenes vigentes', () => {
    let usadas = 0;
    let libres = 0;
    for (const libro of [EJEMPLO, ...[...diasSimulados().values()].filter((_, i) => i % 5 === 0)]) {
      for (const obra of obrasDe(libro)) {
        for (const e of espaciosEtapas(libro, obra.id)) {
          for (const p of e.partidas.slice(0, 6)) {
            const partida = p.id.split('|')[1]!;
            const ctx = legacyDueno(libro);
            const errorLegacy = codigoDeLegacy(() =>
              funcionLegacy<(t: string, o: string, a: string, p: string, m: string) => unknown>(
                ctx,
                'duQuitarPartidaObra',
              )('T', obra.id, e.id, partida, 'No se hará en esta obra'),
            );
            const enArea = (r: unknown[], colArea: number) =>
              texto(r[colArea]) === e.id || !texto(r[colArea]);
            const uso = {
              avance: avanceDe(libro, obra.id).filter((a) => a.partidaId === p.id).length,
              manoDeObra: filas(libro, 'Mano_Obra').filter(
                (m) => m[2] === obra.id && m[4] === partida && enArea(m, 9),
              ).length,
              ordenesVigentes: filas(libro, 'Ordenes_Trabajo').filter(
                (o) => o[1] === obra.id && o[8] !== 'Cancelada' && o[13] === partida && enArea(o, 14),
              ).length,
            };
            const errorCore = codigoDeCore(() =>
              validarQuitarPartida(uso, 'No se hará en esta obra', cerrada(libro, obra.id)),
            );
            if (errorLegacy) usadas++;
            else libres++;
            expect(errorCore, `${obra.id} ${p.id}`).toBe(errorLegacy);
          }
        }
      }
    }
    expect(usadas).toBeGreaterThan(10);
    expect(libres).toBeGreaterThan(10);
    // recorre días del mes simulado, como las demás de paridad: con todas las pruebas a la vez pasa de 5 s
  }, 600_000);
});

describe('paridad al guardar el presupuesto por etapa', () => {
  it('lo que se guarda, si queda completo y qué espacios faltan, o el mismo error', () => {
    let guardados = 0;
    for (const libro of [EJEMPLO, ...[...diasSimulados().values()].filter((_, i) => i % 6 === 0)]) {
      for (const obra of obrasDe(libro)) {
        const espacios = espaciosEtapas(libro, obra.id);
        const nombre = new Map(filas(libro, 'Areas').map((a) => [texto(a[0]), texto(a[3])]));
        const etapas = espacios.flatMap((e) =>
          [...new Set(e.partidas.map((p) => p.etapaId))].map((etapaId) => ({ espacio: e, etapaId })),
        );
        const unaPartida = espacios.find((e) => !e.generales && e.partidas.length)?.partidas[0];
        const casos: { lineas: Record<string, unknown>[]; core: () => LineaPresupuesto[] }[] = [];
        // todas las etapas con monto
        const todas = etapas.map((x, i) => ({
          espacioId: x.espacio.id,
          etapaId: x.etapaId,
          monto: 100 * (i + 1),
        }));
        casos.push({
          lineas: todas.map((l) => ({
            area: l.espacioId,
            etapa: l.etapaId ?? 'Otras partidas',
            monto: l.monto,
          })),
          core: () => normalizarPresupuesto(espacios, todas),
        });
        // la misma etapa dos veces, y ceros que no se guardan
        const dobles = [
          ...todas,
          ...todas.map((l) => ({ ...l, monto: 1 })),
          ...todas.map((l) => ({ ...l, monto: 0 })),
        ];
        casos.push({
          lineas: dobles.map((l) => ({
            area: l.espacioId,
            etapa: l.etapaId ?? 'Otras partidas',
            monto: l.monto,
          })),
          core: () => normalizarPresupuesto(espacios, dobles),
        });
        // solo Generales: queda incompleto
        const soloGen = todas.filter((l) => espacios.find((e) => e.id === l.espacioId)?.generales);
        casos.push({
          lineas: soloGen.map((l) => ({
            area: l.espacioId,
            etapa: l.etapaId ?? 'Otras partidas',
            monto: l.monto,
          })),
          core: () => normalizarPresupuesto(espacios, soloGen),
        });
        // un monto negativo, y una etapa que no es del espacio
        const negativa = [{ ...todas[0]!, monto: -5 }];
        casos.push({
          lineas: negativa.map((l) => ({
            area: l.espacioId,
            etapa: l.etapaId ?? 'Otras partidas',
            monto: l.monto,
          })),
          core: () => normalizarPresupuesto(espacios, negativa),
        });
        const inventada = [{ espacioId: todas[0]!.espacioId, etapaId: 'Etapa inventada', monto: 10 }];
        casos.push({
          lineas: [{ area: inventada[0]!.espacioId, etapa: 'Etapa inventada', monto: 10 }],
          core: () => normalizarPresupuesto(espacios, inventada),
        });
        // el formato antiguo, por partida
        if (unaPartida) {
          const espacioId = unaPartida.id.split('|')[0]!;
          const antiguas = [{ espacioId, partidaId: unaPartida.id, monto: 777 }];
          casos.push({
            lineas: [{ area: espacioId, partida: unaPartida.id.split('|')[1], monto: 777 }],
            core: () => normalizarPresupuesto(espacios, presupuestoDesdePartidas(espacios, antiguas)),
          });
        }

        for (const caso of casos) {
          const ctx = legacyDueno(libro);
          let resLegacy: { completo: boolean; faltan: string[] } | undefined;
          const errorLegacy = codigoDeLegacy(() => {
            resLegacy = funcionLegacy<
              (t: string, o: string, l: unknown) => { completo: boolean; faltan: string[] }
            >(ctx, 'duGuardarPresupuesto')('T', obra.id, caso.lineas);
          });
          let lineasCore: LineaPresupuesto[] = [];
          const errorCore = codigoDeCore(() => {
            lineasCore = caso.core();
          });
          expect(errorCore, `${obra.id} ${JSON.stringify(caso.lineas).slice(0, 200)}`).toBe(errorLegacy);
          if (errorLegacy) continue;
          const guardado = datos(ctx, 'Presupuesto')
            .filter((x) => x[1] === obra.id)
            .map((x) => [
              claveEtapa(texto(x[7]), texto(x[2]) === 'Otras partidas' ? null : texto(x[2])),
              Number(x[3]),
            ])
            .sort();
          const deCore = lineasCore.map((l) => [claveEtapa(l.espacioId, l.etapaId), l.monto]).sort();
          expect(deCore).toEqual(guardado);
          const completo = presupuestoCompleto(espacios, lineasCore);
          expect({
            completo: completo.completo,
            faltan: completo.faltan.map((id) => nombre.get(id)),
          }).toEqual({
            completo: resLegacy!.completo,
            faltan: resLegacy!.faltan,
          });
          guardados++;
        }
      }
    }
    expect(guardados).toBeGreaterThan(40);
  }, 600_000);
});
