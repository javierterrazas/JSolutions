// La conversión del libro del sistema actual, con el libro de ejemplo del legacy (el mismo formato que el de IJM).
import { fileURLToPath } from 'node:url';
import { ErrorDeNegocio } from '@ijm/core';
import { describe, expect, it } from 'vitest';
import { datosDelLibro, requiereLicencia } from './libro';
import { leerLibro, type Libro } from './xlsx';

const RUTA = fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url));
const libro = () => leerLibro(RUTA);

function problema(fn: () => unknown) {
  try {
    fn();
    return null;
  } catch (e) {
    if (e instanceof ErrorDeNegocio) return { codigo: e.codigo, datos: e.datos };
    throw e;
  }
}

describe('el libro de ejemplo', () => {
  const d = datosDelLibro(libro());

  it('el catálogo completo: 41 partidas en 4 tipos de espacio, Generales de obra primero', () => {
    expect(d.tipos.map((t) => [t.nombre_es, t.es_generales])).toEqual([
      ['Generales de obra', true],
      ['Baño', false],
      ['Cocina', false],
      ['Closet', false],
    ]);
    expect(d.partidas).toHaveLength(41);
    const cuenta = (tipo: string) => d.partidas.filter((p) => p.tipo === tipo).length;
    expect([cuenta('Generales de obra'), cuenta('Baño'), cuenta('Cocina'), cuenta('Closet')]).toEqual([
      4, 16, 15, 6,
    ]);
    expect(d.etapas).toHaveLength(17);
    expect(d.etapas[0]).toEqual({ nombre_es: 'Generales de obra', orden: 1 });
  });

  it('quién hace cada partida: cuadrilla, PM o un sub con el oficio que empata con el de un sub', () => {
    const p = (nombre: string) => d.partidas.find((x) => x.nombre_es === nombre)!;
    expect(p('Protección y movilización')).toMatchObject({ responsable: 'cuadrilla', oficio: null, peso: 2 });
    expect(p('Permisos e inspecciones')).toMatchObject({ responsable: 'pm', oficio: null, paralelo: true });
    const subs = d.partidas.filter((x) => x.responsable === 'subcontratista');
    expect(subs.length).toBeGreaterThan(0);
    // "Drywall" en el catálogo es el sub de "Drywall/Pintura"
    expect([...new Set(subs.map((x) => x.oficio))].sort()).toContain('Drywall/Pintura');
    expect(d.oficios.map((o) => o.nombre_es)).not.toContain('Drywall');
  });

  it('los 5 puntos de control con sus 38 preguntas; PC3 exige la prueba de agua', () => {
    expect(d.hitos.map((h) => [h.clave, h.nombre_es, h.exige_prueba_agua])).toEqual([
      ['PC1', 'Post demolición', false],
      ['PC2', 'Pre-cierre de muros', false],
      ['PC3', 'Impermeabilización', true],
      ['PC4', 'Pre-acabados', false],
      ['PC5', 'Pre-entrega', false],
    ]);
    expect(d.puntos).toHaveLength(38);
    expect(d.puntos[0]).toMatchObject({ hito: 'PC1', orden: 1, requiere_foto: true });
    expect(d.partidas.filter((x) => x.hito).every((x) => d.hitos.some((h) => h.clave === x.hito))).toBe(true);
  });

  it('subcontratistas con sus papeles, y la licencia que pide Texas por oficio', () => {
    expect(d.subcontratistas).toHaveLength(6);
    expect(d.subcontratistas[0]).toEqual({
      nombre: 'Rios Plumbing LLC',
      oficio: 'Plomería',
      telefono: '512-555-0301',
      contacto: 'Arturo Rios',
      correo: 'arturo@riosplumbing.com',
      seguro_vence: '2027-03-31',
      licencia: 'M-40218',
      licencia_vence: '2027-08-31',
      w9: true,
      activo: true,
    });
    expect(d.oficios.filter((o) => o.requiere_licencia).map((o) => o.nombre_es)).toEqual([
      'Plomería',
      'Eléctrico',
    ]);
    expect(['HVAC', 'Aire acondicionado', 'Electricista'].every(requiereLicencia)).toBe(true);
    expect(['Tile', 'Drywall/Pintura', 'Countertops'].some(requiereLicencia)).toBe(false);
  });

  it('la cuadrilla con su tarifa y tipo de pago; la nota al pie de la hoja no es un trabajador', () => {
    expect(d.trabajadores.map((t) => [t.nombre, t.tipo_pago, t.tarifa])).toEqual([
      ['Jose Luna', 'hora', 32],
      ['Miguel Soto', 'hora', 20],
      ['Ruben Castro', 'hora', 35],
      ['Angel Perez', 'dia', 220],
    ]);
  });

  it('la configuración; las metas iguales a las del legacy no se guardan', () => {
    expect(d.configuracion).toEqual({
      impuesto: 0.0825,
      limite_compra_pm: 300,
      sla_bloqueo_horas: 24,
      sla_oc_horas: 48,
      umbral_oc_menor: 200,
      margen_minimo_oc: 0.35,
      horas_sin_recibo: 72,
    });
    expect(d.metas).toEqual([]);
  });
});

describe('un libro con problemas', () => {
  const con = (cambio: (l: Libro) => void) => {
    const l = libro();
    cambio(l);
    return problema(() => datosDelLibro(l));
  };

  it('dice cada renglón que no se puede cargar, con su número de renglón en la hoja', () => {
    const r = con((l) => {
      l.Partidas_Catalogo![3]![4] = 0; // peso
      l.Trabajadores![1]![3] = 'Por semana';
      l.Config!.push(['META_TASA_REPORTE', 'noventa']);
    });
    expect(r?.codigo).toBe('libro_invalido');
    expect(r?.datos?.problemas).toEqual([
      { hoja: 'Config', renglon: 18, problema: 'META_TASA_REPORTE: no es un número' },
      { hoja: 'Trabajadores', renglon: 2, problema: 'tipo de pago: Por hora o Por dia' },
      { hoja: 'Partidas_Catalogo', renglon: 4, problema: 'el peso debe ser mayor que cero' },
    ]);
  });

  it('una meta distinta a la del legacy sí se guarda', () => {
    const l = libro();
    l.Config!.find((r) => r[0] === 'META_TASA_REPORTE')![1] = 0.9;
    expect(datosDelLibro(l).metas).toEqual([{ indicador: 'tasa_cierre_dia', meta: 0.9 }]);
  });

  it('una hoja que falta', () => {
    expect(con((l) => delete l.Checklist_Calidad)).toEqual({
      codigo: 'libro_incompleto',
      datos: { hoja: 'Checklist_Calidad' },
    });
  });
});

describe('un libro anterior al cambio de acentos', () => {
  it('se carga con sus acentos: igual que el mismo libro ya corregido', () => {
    const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
    const viejo = libro();
    const columnas: Record<string, number[]> = {
      Partidas_Catalogo: [0, 2, 3, 6, 9],
      Checklist_Calidad: [0, 2],
      Subcontratistas: [2],
    };
    for (const [h, cs] of Object.entries(columnas))
      for (const r of viejo[h]!.slice(1))
        for (const c of cs) if (typeof r[c] === 'string') r[c] = sinAcentos(r[c]);
    expect(viejo.Partidas_Catalogo!.some((r) => r[0] === 'Bano')).toBe(true);

    const a = datosDelLibro(viejo);
    const b = datosDelLibro(libro());
    for (const k of ['tipos', 'etapas', 'oficios', 'hitos', 'puntos', 'partidas'] as const)
      expect(a[k], k).toEqual(b[k]);
    expect(a.subcontratistas.map((s) => s.oficio)).toEqual(b.subcontratistas.map((s) => s.oficio));
  });
});
