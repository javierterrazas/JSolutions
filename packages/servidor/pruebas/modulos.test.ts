// Los módulos de cada empresa (D-110), con supabase/seed.sql: quien administra la plataforma es el dueño de IJM
// (empresa A). Las empresas empiezan con todo prendido.
import { MODULOS } from '@ijm/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  cerrarDia,
  datosParaCierre,
  empresaDeLaPlataforma,
  guardarModulos,
  leerSesion,
  portalCliente,
  quienSoy,
  sinIdentidad,
} from '../src/index';
import { codigo, como, enAustin, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

const EMPRESA_A = 'e000000a-0000-4000-8000-000000000000';
const EMPRESA_B = 'e000000b-0000-4000-8000-000000000000';
const TOKEN = 'enlace-de-prueba-cliente-garcia-2026';
const LUNES = enAustin('2026-10-12', 9);

describe('los módulos de una empresa', () => {
  it('empiezan todos prendidos; quien administra los cambia con lo que necesitan', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      expect((await leerSesion(tx)).modulos).toEqual([...MODULOS]);
      expect((await empresaDeLaPlataforma(tx, { empresaId: EMPRESA_B }))!.modulos).toEqual([...MODULOS]);
      // pedir órdenes de cambio prende el portal y el dinero
      expect(await guardarModulos(tx, { empresaId: EMPRESA_B, modulos: ['cambios'] })).toEqual([
        'dinero',
        'portal',
        'cambios',
      ]);
      expect((await empresaDeLaPlataforma(tx, { empresaId: EMPRESA_B }))!.modulos).toEqual([
        'dinero',
        'portal',
        'cambios',
      ]);
      await como(tx, USUARIOS.duenoB);
      expect((await leerSesion(tx)).modulos).toEqual(['dinero', 'portal', 'cambios']);
    }));

  it('el dueño no se prende módulos solo, y quien no administra no los cambia', () =>
    probarComo(USUARIOS.duenoB, async (tx) => {
      await expect(
        tx.savepoint((sp) => sp`update empresas set modulos = '{}' where id = ${EMPRESA_B}`),
      ).rejects.toThrow(/solo_plataforma/);
      expect(await codigo(tx, () => guardarModulos(tx, { empresaId: EMPRESA_B, modulos: [] }))).toBe(
        'solo_plataforma',
      );
    }));

  it('sin la marca, la app usa la suya; sin calidad, se termina sin inspección; sin subs, el cierre no pregunta', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      // el rough de plomería con un punto de control que nadie ha inspeccionado
      await tx`update partidas_obra
               set hito_id = (select id from hitos_calidad where clave = 'PC3' and empresa_id = ${EMPRESA_A})
               where obra_id = ${OBRAS.a1Carlos} and nombre_es = 'Rough de plomería'`;
      const rough = async () =>
        (await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.espacios
          .flatMap((e) => e.partidas)
          .find((p) => p.nombre.es === 'Rough de plomería')!;
      const terminar = async (id: string) =>
        codigo(tx, () =>
          cerrarDia(
            tx,
            { obraId: OBRAS.a1Carlos, partidas: [id], terminadas: [id], fotosPorSubir: 1 },
            LUNES,
          ),
        );

      // con calidad, no se termina sin su inspección
      await como(tx, USUARIOS.carlos);
      const conCalidad = await rough();
      expect(conCalidad.faltaInspeccion).toBe(true);
      expect(await terminar(conCalidad.id)).not.toBeNull();

      await como(tx, USUARIOS.duenoA);
      await guardarModulos(tx, { empresaId: EMPRESA_A, modulos: ['dinero'] });
      expect((await quienSoy(tx)).marca).toEqual({ color: '#1d3557', conLogo: false, version: 1 });

      await como(tx, USUARIOS.carlos);
      expect((await datosParaCierre(tx, { obraId: OBRAS.a1Carlos }, LUNES))!.subs).toEqual([]);
      const sinCalidad = await rough();
      expect(sinCalidad.faltaInspeccion).toBe(false);
      expect(await terminar(sinCalidad.id)).toBeNull();
    }));

  it('sin el portal, el enlace del cliente no abre; sin órdenes de cambio, no las ve', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      await guardarModulos(tx, { empresaId: EMPRESA_A, modulos: ['portal'] });
      await sinIdentidad(tx);
      const p = (await portalCliente(tx, { token: TOKEN }, LUNES))!;
      expect(p.cambios.ordenes).toEqual([]);
      await como(tx, USUARIOS.duenoA);
      await guardarModulos(tx, { empresaId: EMPRESA_A, modulos: [] });
      await sinIdentidad(tx);
      expect(await portalCliente(tx, { token: TOKEN }, LUNES)).toBeNull();
    }));
});
