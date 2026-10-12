// El álbum de fotos de una obra (fase 2, paso 6f; legacy: pmAlbum), con los datos de supabase/seed.sql: OB-001 tiene
// la foto del cierre del 5 de octubre, el recibo de la compra de Carlos en Home Depot, el de la compra de la oficina en
// Ferguson y fotos de órdenes de cambio.
import { afterAll, describe, expect, it } from 'vitest';
import { albumDeObra, albumEnGarantia, cerrarDia, enlaceDeFoto, obrasEnGarantia } from '../src/index';
import { codigo, como, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

describe('el álbum de la obra', () => {
  it('el PM ve las fotos de su obra por registro; nunca las de la oficina ni las de órdenes de cambio', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const a = (await albumDeObra(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(a.obra.folio).toBe('OB-001');
      expect(a.registros.map((r) => r.tipo).sort()).toEqual(['bitacora', 'gasto']);
      expect(a.registros.find((r) => r.tipo === 'bitacora')).toMatchObject({
        folio: 'BIT-0001',
        dia: '2026-10-05',
        fotos: [expect.any(String)],
      });
      expect(a.registros.find((r) => r.tipo === 'gasto')).toMatchObject({ detalle: 'Home Depot' });
      expect(a.hayMas).toBe(false);
    }));

  it('el dueño ve todas, también las de la oficina y las de órdenes de cambio', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const a = (await albumDeObra(tx, { obraId: OBRAS.a1Carlos }))!;
      expect(
        a.registros
          .filter((r) => r.tipo === 'gasto')
          .map((r) => r.detalle)
          .sort(),
      ).toEqual(['Ferguson', 'Home Depot']);
      expect(a.registros.some((r) => r.tipo === 'orden_cambio')).toBe(true);
    }));

  it('otro PM no ve el álbum de una obra que no es suya; una página vacía no tiene más', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      expect(await albumDeObra(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
      await como(tx, USUARIOS.carlos);
      expect(await albumDeObra(tx, { obraId: OBRAS.a1Carlos, pagina: 5 })).toMatchObject({
        registros: [],
        hayMas: false,
      });
    }));
});

// OB-003 de Carlos está entregada; el seed le pone garantía hasta el 2027-10-30 (D-060).
describe('las obras terminadas del PM, en garantía', () => {
  const firmar = async (ruta: string) => `firmado:${ruta}`;

  it('el PM ve la lista de sus obras entregadas en garantía, sin dinero, y su álbum con las mismas reglas de fotos', () =>
    probarComo(USUARIOS.carlos, async (tx) => {
      const lista = await obrasEnGarantia(tx);
      expect(lista).toEqual([
        expect.objectContaining({
          id: OBRAS.a3Entregada,
          folio: 'OB-003',
          entregaComprometida: '2026-08-28',
          entregada: '2026-10-30',
          garantiaVence: '2027-10-30',
          atraso: 63,
          diasCerrados: expect.any(Number),
        }),
      ]);
      expect(Object.keys(lista[0]!).some((k) => /monto|contrato|precio|costo/i.test(k))).toBe(false);

      // RLS no le abre la obra; el álbum en garantía sí, con las reglas de siempre
      expect(await albumDeObra(tx, { obraId: OBRAS.a3Entregada })).toBeNull();
      const a = (await albumEnGarantia(tx, { obraId: OBRAS.a3Entregada }))!;
      expect(a.obra.folio).toBe('OB-003');
      const tipos = a.registros.map((r) => r.tipo);
      expect(tipos).toContain('bitacora');
      expect(tipos).not.toContain('orden_cambio');
      expect(a.registros.filter((r) => r.tipo === 'gasto').map((r) => r.detalle)).not.toContain('Ferguson');

      // y abre sus fotos, pero no las que no le tocan
      const foto = a.registros.find((r) => r.tipo === 'bitacora')!.fotos[0]!;
      expect((await enlaceDeFoto(tx, foto, firmar)).url).toMatch(/^firmado:/);
      await como(tx, USUARIOS.duenoA);
      const [oficina] = await tx<{ id: string }[]>`
        select f.id from fotos f join gastos g on g.id = f.ref_id
        where f.obra_id = ${OBRAS.a3Entregada} and f.ref_tipo = 'gasto' and g.origen <> 'pm'`;
      await como(tx, USUARIOS.carlos);
      if (oficina)
        expect(await codigo(tx, () => enlaceDeFoto(tx, oficina.id, firmar))).toBe('foto_no_encontrada');

      // solo lectura: sigue sin poder cerrar un día en ella
      expect(await codigo(tx, () => cerrarDia(tx, { obraId: OBRAS.a3Entregada, partidas: [] }))).toBe(
        'obra_no_encontrada',
      );
      // una obra activa no es "terminada"
      expect(await albumEnGarantia(tx, { obraId: OBRAS.a1Carlos })).toBeNull();
    }));

  it('vencida la garantía, ya no aparece; otro PM y el dueño no tienen esta lista', () =>
    probarComo(USUARIOS.luis, async (tx) => {
      expect(await obrasEnGarantia(tx)).toEqual([]);
      expect(await albumEnGarantia(tx, { obraId: OBRAS.a3Entregada })).toBeNull();
      await como(tx, USUARIOS.duenoA);
      expect(await obrasEnGarantia(tx)).toEqual([]);
      await tx`update entregas set fecha_entrega = '2024-01-10', garantia_vence = '2025-01-10'
               where obra_id = ${OBRAS.a3Entregada}`;
      await como(tx, USUARIOS.carlos);
      expect(await obrasEnGarantia(tx)).toEqual([]);
      expect(await albumEnGarantia(tx, { obraId: OBRAS.a3Entregada })).toBeNull();
    }));
});
