// El libro de ejemplo del legacy, leído desde Node, alimenta al legacy igual que lo hacía openpyxl.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cargarLegacy, diaLocal, funcionLegacy } from './legacy';
import { leerLibro } from './xlsx';

const RUTA = fileURLToPath(new URL('../../../../legacy/app/Gestion_Obra_IJM.xlsx', import.meta.url));

describe('el libro de ejemplo del legacy', () => {
  const libro = leerLibro(RUTA);

  it('trae sus 29 hojas', () => {
    expect(Object.keys(libro)).toHaveLength(29);
    expect(libro.Config?.[1]).toEqual(['EMPRESA', 'IJM Construction', 'Nombre que aparece en las apps']);
  });

  it('ninguna hoja con datos sale vacía (las que tienen renglones en blanco en medio)', () => {
    for (const h of ['Trabajadores', 'Presupuesto', 'Pruebas_Agua', 'Instrucciones']) {
      expect(libro[h]![0]!.length, h).toBeGreaterThan(0);
    }
    expect(libro.Trabajadores![1]!.slice(0, 5)).toEqual([
      'TRB-01',
      'Jose Luna',
      'Oficial de tile',
      'Por hora',
      32,
    ]);
  });

  it('las fechas salen como fechas locales', () => {
    const inicio = libro.Proyectos?.[1]?.[6];
    expect(inicio).toBeInstanceOf(Date);
    expect(diaLocal(inicio as Date)).toMatch(/^2026-\d\d-\d\d$/);
  });

  it('el legacy lo lee como en su propia prueba (prueba_pm): OB-004 es Baño + Closet con 56 pies²', () => {
    const ctx = cargarLegacy('PM', { libro: leerLibro(RUTA) });
    const datos = funcionLegacy<(u: string) => { obras: { id: string; tipo: string; pies2: number }[] }>(
      ctx,
      'construirDatos_',
    )('luis');
    const ob4 = datos.obras.find((o) => o.id === 'OB-004');
    expect(ob4).toMatchObject({ tipo: 'Baño + Closet', pies2: 56 });
  });
});
