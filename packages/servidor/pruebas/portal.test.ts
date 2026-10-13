// El portal del cliente (D-066), con los datos de supabase/seed.sql: OB-001 de Carlos (Familia García) tiene un
// enlace con un token conocido y la foto de su cierre del 5 de octubre marcada para el cliente. "Hoy" es el lunes 12
// de octubre de 2026 en Austin.
import { afterAll, describe, expect, it } from 'vitest';
import {
  anularEnlaceCliente,
  crearEnlaceCliente,
  enlaceClienteDeObra,
  enlaceDeFotoDelPortal,
  marcarFotoCliente,
  portalCliente,
  sinIdentidad,
  type Tx,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const LUNES = enAustin('2026-10-12', 9);
const TOKEN = 'enlace-de-prueba-cliente-garcia-2026';
const firmar = async (ruta: string) => `https://firmado.test/${ruta}`;

/** Una foto de OB-001 de un tipo (como el dueño, que las ve todas). */
async function fotoDe(tx: Tx, tipo: string): Promise<string> {
  const [f] = await tx<{ id: string }[]>`
    select id from fotos where obra_id = ${OBRAS.a1Carlos} and ref_tipo = ${tipo} limit 1`;
  return f!.id;
}

describe('el portal del cliente', () => {
  it('con su enlace, el cliente ve el avance, cada espacio, la entrega, los días trabajados y las fotos marcadas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await sinIdentidad(tx);
      const p = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      expect(p.empresa).toBe('IJM Construction');
      expect(p.obra).toEqual({
        folio: 'OB-001',
        cliente: 'Familia García',
        direccion: '1200 Oak St, Austin, TX',
        estado: 'en_obra',
        inicio: '2026-10-05',
        // la del alta más el día de la orden de cambio autorizada
        entregaComprometida: '2026-10-31',
        entregada: null,
      });
      expect(p.avance).toEqual({ pct: 0.4, terminadas: 1, total: 2 });
      expect(p.espacios).toEqual([
        {
          nombre: 'Baño principal',
          pct: 0.4,
          estado: 'en_curso',
          etapa: { es: 'Plomería', en: 'Plumbing' },
          enCurso: [],
        },
      ]);
      expect(p.dias).toEqual([
        {
          dia: '2026-10-05',
          partidas: [
            {
              espacio: 'Baño principal',
              partida: { es: 'Demolición y retiro de escombro', en: null },
              terminada: true,
            },
          ],
        },
      ]);
      expect(p.fotos).toHaveLength(1);
      expect(p.fotos[0]!.dia).toBe('2026-10-05');
    }));

  it('nada de dinero, de la cuadrilla, de lo interno ni de la fecha prevista', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await sinIdentidad(tx);
      const texto = JSON.stringify(await portalCliente(tx, { token: TOKEN }, LUNES));
      expect(texto).not.toMatch(
        /monto|precio|costo|presupuesto|contrato|tarifa|prevista|atraso|Pedro|Juan|Plomería Rápida|Home Depot|humedad/i,
      );
    }));

  it('cuenta las visitas; solo el dueño ve el enlace, lo crea de nuevo (el anterior deja de servir) y lo anula', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect(await enlaceClienteDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES)).toMatchObject({
        accesos: 0,
        ultimoAcceso: null,
      });
      await sinIdentidad(tx);
      await portalCliente(tx, { token: TOKEN }, LUNES);
      await portalCliente(tx, { token: TOKEN }, LUNES);
      await como(tx, USUARIOS.duenoA);
      expect((await enlaceClienteDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.accesos).toBe(2);

      const { token } = await crearEnlaceCliente(tx, { obraId: OBRAS.a1Carlos }, LUNES);
      expect(token).not.toBe(TOKEN);
      expect((await enlaceClienteDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.accesos).toBe(0);
      await sinIdentidad(tx);
      expect(await portalCliente(tx, { token: TOKEN }, LUNES)).toBeNull();
      expect((await portalCliente(tx, { token }, LUNES))!.obra.folio).toBe('OB-001');
      expect(await portalCliente(tx, { token: 'un-token-que-no-existe-0000' }, LUNES)).toBeNull();

      await como(tx, USUARIOS.duenoA);
      await anularEnlaceCliente(tx, { obraId: OBRAS.a1Carlos }, LUNES);
      expect(await enlaceClienteDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES)).toBeNull();
      await sinIdentidad(tx);
      expect(await portalCliente(tx, { token }, LUNES)).toBeNull();

      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => crearEnlaceCliente(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
      expect(await codigo(tx, () => enlaceClienteDeObra(tx, { obraId: OBRAS.a1Carlos }, LUNES))).toBe(
        'solo_dueno',
      );
      // y el PM no lee la tabla de enlaces
      expect(await tx`select id from enlaces_cliente`).toHaveLength(0);
    }));

  it('el enlace de una obra entregada sirve mientras dura la garantía', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const { token } = await crearEnlaceCliente(tx, { obraId: OBRAS.a3Entregada }, LUNES);
      await sinIdentidad(tx);
      const p = (await portalCliente(tx, { token }, LUNES))!;
      expect(p.obra.estado).toBe('entregada');
      expect(p.obra.entregada).not.toBeNull();
      // vencida la garantía, ya no
      await como(tx, USUARIOS.duenoA);
      await tx`
        update entregas set fecha_entrega = '2025-08-28', garantia_vence = '2026-08-28'
        where obra_id = ${OBRAS.a3Entregada}`;
      await sinIdentidad(tx);
      expect(await portalCliente(tx, { token }, LUNES)).toBeNull();
    }));

  it('el PM de la obra o el dueño marcan las fotos; solo las del trabajo; el portal firma solo las marcadas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const cierre = await fotoDe(tx, 'bitacora');
      const recibo = await fotoDe(tx, 'gasto');

      // un recibo nunca va al portal, ni lo marca el PM ni el dueño
      await como(tx, USUARIOS.carlos);
      expect(await codigo(tx, () => marcarFotoCliente(tx, { fotoId: recibo, visible: true }))).toBe(
        'foto_no_permitida',
      );
      await marcarFotoCliente(tx, { fotoId: cierre, visible: false });
      await sinIdentidad(tx);
      expect((await portalCliente(tx, { token: TOKEN }, LUNES))!.fotos).toEqual([]);
      expect(
        await codigo(tx, () => enlaceDeFotoDelPortal(tx, { token: TOKEN, fotoId: cierre }, firmar)),
      ).toBe('foto_no_encontrada');

      await como(tx, USUARIOS.duenoA);
      expect(await codigo(tx, () => marcarFotoCliente(tx, { fotoId: recibo, visible: true }))).toBe(
        'foto_no_permitida',
      );
      await marcarFotoCliente(tx, { fotoId: cierre, visible: true });
      await sinIdentidad(tx);
      expect((await enlaceDeFotoDelPortal(tx, { token: TOKEN, fotoId: cierre }, firmar)).url).toMatch(
        /^https:\/\/firmado\.test\//,
      );
      // con otro token, la misma foto no
      expect(
        await codigo(tx, () =>
          enlaceDeFotoDelPortal(tx, { token: 'enlace-de-prueba-cliente-perez-2026', fotoId: cierre }, firmar),
        ),
      ).toBe('foto_no_encontrada');

      // Luis no marca fotos de una obra que no es suya
      await como(tx, USUARIOS.luis);
      expect(await codigo(tx, () => marcarFotoCliente(tx, { fotoId: cierre, visible: false }))).toBe(
        'foto_no_encontrada',
      );
    }));
});
