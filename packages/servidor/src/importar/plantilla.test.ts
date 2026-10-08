// La plantilla estándar de datos iniciales (D-039): se genera, se lee de vuelta y se carga con el mismo lector que el
// libro del sistema actual.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ErrorDeNegocio } from '@ijm/core';
import { describe, expect, it } from 'vitest';
import { datosDelLibro } from './libro';
import { generarPlantilla, MARCA_EJEMPLO } from './plantilla';
import { leerLibro, type Libro } from './xlsx';

const ARCHIVO = fileURLToPath(
  new URL('../../../../docs/plantilla/Plantilla_datos_iniciales_J_Solutions.xlsx', import.meta.url),
);

/** La plantilla "llena": sus renglones de ejemplo, sin la marca EJEMPLO. */
function llena(): Libro {
  const l = leerLibro(generarPlantilla());
  for (const filas of Object.values(l))
    for (const f of filas)
      if (String(f[0]).startsWith(MARCA_EJEMPLO)) f[0] = String(f[0]).slice(`${MARCA_EJEMPLO} · `.length);
  return l;
}

function problema(fn: () => unknown) {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof ErrorDeNegocio) return { codigo: e.codigo, datos: e.datos };
    throw e;
  }
}

describe('la plantilla', () => {
  it('trae sus pestañas en orden, con los títulos en el primer renglón', () => {
    const l = leerLibro(generarPlantilla());
    expect(Object.keys(l)).toEqual([
      'Instrucciones',
      'Empresa',
      'Equipo',
      'Config',
      'Feriados',
      'Partidas_Catalogo',
      'Checklist_Calidad',
      'Subcontratistas',
      'Trabajadores',
    ]);
    expect(l.Partidas_Catalogo![0]!.slice(0, 3)).toEqual(['Tipo de espacio', 'Orden', 'Partida']);
    expect(l.Config!.find((r) => r[0] === 'PLANTILLA')![1]).toBe('J Solutions 1');
  });

  it('el archivo de docs/plantilla está al día: si cambia la plantilla, hay que volver a generarlo', () => {
    // pnpm plantilla
    expect(readFileSync(ARCHIVO).equals(generarPlantilla())).toBe(true);
  });

  it('vacía, no carga nada: los renglones de EJEMPLO no cuentan', () => {
    expect(problema(() => datosDelLibro(leerLibro(generarPlantilla())))).toEqual({
      codigo: 'libro_sin_partidas',
      datos: undefined,
    });
  });

  it('llena, carga todo: inglés, días laborables, feriados y la prueba de agua marcada', () => {
    const d = datosDelLibro(llena());
    expect(d.tipos.map((t) => t.nombre_es)).toEqual(['Generales de obra', 'Baño']);
    expect(
      d.partidas.map((p) => [p.tipo, p.nombre_es, p.nombre_en, p.responsable, p.oficio, p.hito]),
    ).toEqual([
      ['Generales de obra', 'Protección y movilización', 'Protection and setup', 'cuadrilla', null, null],
      ['Baño', 'Rough de plomería', 'Plumbing rough-in', 'subcontratista', 'Plomería', 'PC2'],
    ]);
    expect(d.oficios).toEqual([{ nombre_es: 'Plomería', requiere_licencia: true }]);
    expect(d.hitos).toEqual([
      { clave: 'PC2', nombre_es: 'Pre-cierre de muros', orden: 1, exige_prueba_agua: false },
    ]);
    expect(d.puntos[0]).toMatchObject({ texto_en: 'Plumbing pressure test held', requiere_foto: true });
    expect(d.diasLaborables).toEqual([1, 2, 3, 4, 5, 6]);
    expect(d.feriados).toEqual([
      {
        dia: '2026-11-26',
        nombre_es: 'Día de Acción de Gracias',
        nombre_en: 'Thanksgiving Day',
        se_trabaja: false,
      },
    ]);
    expect(d.subcontratistas[0]).toMatchObject({
      nombre: 'Rios Plumbing LLC',
      seguro_vence: '2027-03-31',
      w9: true,
    });
    expect(d.trabajadores).toEqual([
      {
        nombre: 'Jose Luna',
        puesto: 'Oficial de tile',
        tipo_pago: 'hora',
        tarifa: 32,
        telefono: '512-555-0401',
        activo: true,
      },
    ]);
    expect(d.configuracion.impuesto).toBe(0.0825);
    expect(d.metas).toEqual([]);

    // en la plantilla, la prueba de agua es la que se marca (no la de PC3, como en el legacy)
    const l = llena();
    l.Checklist_Calidad![1]![4] = 'SI';
    expect(datosDelLibro(l).hitos[0]!.exige_prueba_agua).toBe(true);
  });

  it('en la plantilla, un renglón a medias se reporta (en el legacy sería una nota)', () => {
    const l = llena();
    l.Trabajadores!.push(['', 'Pedro Sin Tarifa', '', 'Por dia', '', '', 'SI']);
    l.Config!.find((r) => r[0] === 'DIAS_LABORABLES')![1] = 'lunes a viernes';
    expect(problema(() => datosDelLibro(l))?.datos?.problemas).toEqual([
      {
        hoja: 'Config',
        renglon: 10,
        problema: 'DIAS_LABORABLES: lun, mar, mie, jue, vie, sab o dom, separados por coma',
      },
      { hoja: 'Trabajadores', renglon: 3, problema: 'tarifa' },
    ]);
  });
});
