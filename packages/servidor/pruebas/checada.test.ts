// La checada con GPS y selfie (D-117), con supabase/seed.sql: OB-001 de Carlos en Austin, Pedro (por hora) y Juan (por
// día). El módulo nace apagado; aquí se prende. Las checadas usan la hora real de la base (now()).
import { MODULOS } from '@ijm/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  anularCierre,
  anularChecada,
  canjearAccesoTrabajador,
  cerrarDia,
  checadasDelDia,
  checadasDeLaObra,
  checar,
  corregirSalida,
  datosParaCierre,
  estadoDeAccesoTrabajador,
  fijarGeocerca,
  guardarModulos,
  invitarTrabajadorChecada,
  type LlaveTrabajador,
  quitarAccesoTrabajador,
  sinIdentidad,
  trabajadorDeLlave,
  type Tx,
} from '../src/index';
import { codigo, como, EMPRESA_A, OBRAS, probarComo, servidor, USUARIOS } from './apoyo';

afterAll(() => servidor.sql.end());

// la obra en el centro de Austin; "cerca" a ~45 m, "lejos" a ~1.1 km
const OBRA = { lat: 30.2672, lng: -97.7431 };
const CERCA = { lat: 30.2676, lng: -97.7431, precision: 12 };
const LEJOS = { lat: 30.2772, lng: -97.7431, precision: 12 };

const trabajador = async (tx: Tx, nombre: string) =>
  (await tx<{ id: string }[]>`select id from trabajadores where nombre = ${nombre}`)[0]!.id;

/** Prende el módulo, le pone geocerca a OB-001 y le da su llave de checada al trabajador. */
async function preparar(tx: Tx, nombre = 'Pedro'): Promise<LlaveTrabajador> {
  await guardarModulos(tx, { empresaId: EMPRESA_A, modulos: [...MODULOS] });
  await fijarGeocerca(tx, { obraId: OBRAS.a1Carlos, ...OBRA, radio: 150 });
  const { token } = await invitarTrabajadorChecada(tx, { trabajadorId: await trabajador(tx, nombre) });
  return sinSesion(tx, async () => canjearAccesoTrabajador(tx, { token, dispositivo: 'Android' }));
}

/** Como llega el trabajador: sin sesión; luego, otra vez como el dueño. */
async function sinSesion<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await sinIdentidad(tx);
  try {
    return await fn();
  } finally {
    await como(tx, USUARIOS.duenoA);
  }
}

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

describe('la llave de checada del trabajador', () => {
  it('el dueño lo invita (con el módulo), su celular la canjea una vez y queda con su llave', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const pedro = await trabajador(tx, 'Pedro');
      expect(await codigo(tx, () => invitarTrabajadorChecada(tx, { trabajadorId: pedro }))).toBe(
        'modulo_no_incluido',
      );
      await guardarModulos(tx, { empresaId: EMPRESA_A, modulos: [...MODULOS] });
      const { token } = await invitarTrabajadorChecada(tx, { trabajadorId: pedro });
      await sinSesion(tx, async () => {
        expect(await estadoDeAccesoTrabajador(tx, { token, llave: null })).toBe('vigente');
        const llave = await canjearAccesoTrabajador(tx, { token, dispositivo: 'iPhone de Pedro' });
        expect(llave.trabajador).toBe('Pedro');
        expect(await estadoDeAccesoTrabajador(tx, { token, llave })).toBe('tuya');
        expect(await estadoDeAccesoTrabajador(tx, { token, llave: null })).toBe('usada');
        expect(await codigo(tx, () => canjearAccesoTrabajador(tx, { token }))).toBe('invitacion_invalida');
        expect(await trabajadorDeLlave(tx, llave)).toMatchObject({
          nombre: 'Pedro',
          tipoPago: 'hora',
          dentro: null,
        });
      });
    }));

  it('activar otro celular quita el anterior; quitarle la checada lo deja sin acceso', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const primera = await preparar(tx);
      const { token } = await invitarTrabajadorChecada(tx, { trabajadorId: await trabajador(tx, 'Pedro') });
      const segunda = await sinSesion(tx, () => canjearAccesoTrabajador(tx, { token }));
      await sinSesion(tx, async () => {
        expect(await trabajadorDeLlave(tx, primera)).toBeNull();
        expect(await trabajadorDeLlave(tx, segunda)).not.toBeNull();
      });
      await quitarAccesoTrabajador(tx, { trabajadorId: await trabajador(tx, 'Pedro') });
      await sinSesion(tx, async () => {
        expect(await trabajadorDeLlave(tx, segunda)).toBeNull();
        expect((await checar(tx, segunda, { tipo: 'entrada', ...CERCA })).resultado).toBe('sin_acceso');
      });
    }));
});

describe('checar', () => {
  it('solo dentro de la geocerca; la salida cuenta las horas en cuartos y las escribe en la cuadrilla', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const llave = await preparar(tx);
      await sinSesion(tx, async () => {
        const fuera = await checar(tx, llave, { tipo: 'entrada', ...LEJOS });
        expect(fuera).toMatchObject({ resultado: 'fuera', obra: 'OB-001' });
        expect(fuera.distancia).toBeGreaterThan(1000);
        expect((await checar(tx, llave, { tipo: 'salida', ...CERCA })).resultado).toBe('sin_entrada');
        expect((await checar(tx, llave, { tipo: 'entrada', ...CERCA, precision: 500 })).resultado).toBe(
          'gps_impreciso',
        );

        // la entrada se capturó hace 3 horas sin señal y se envía ahora: cuenta la hora del celular
        const entrada = await checar(tx, llave, {
          tipo: 'entrada',
          ...CERCA,
          foto: `${EMPRESA_A}/checadas/selfie.jpg`,
          capturada: hace(180),
        });
        expect(entrada).toMatchObject({ resultado: 'ok', obra: 'OB-001' });
        expect(entrada.distancia).toBeLessThan(60);
        expect((await checar(tx, llave, { tipo: 'entrada', ...CERCA })).resultado).toBe('ya_dentro');
        expect((await trabajadorDeLlave(tx, llave))!.dentro).toMatchObject({ obra: 'OB-001' });

        // salir lejos no se puede; en la obra, sí
        expect((await checar(tx, llave, { tipo: 'salida', ...LEJOS })).resultado).toBe('fuera');
        const salida = await checar(tx, llave, { tipo: 'salida', ...CERCA });
        expect(salida).toMatchObject({ resultado: 'ok', horas: 3 });
        expect((await trabajadorDeLlave(tx, llave))!.dentro).toBeNull();
      });

      // la cuadrilla de OB-001 tiene sus 3 horas, y el dueño y el PM ven la checada
      const [m] = await tx<{ cantidad: string }[]>`
        select m.cantidad from mano_obra m join trabajadores t on t.id = m.trabajador_id
        where t.nombre = 'Pedro' and m.obra_id = ${OBRAS.a1Carlos} and m.bitacora_id is null and m.estado = 'vigente'
        order by m.creado_en desc limit 1`;
      expect(Number(m!.cantidad)).toBe(3);
      const delDia = await checadasDelDia(tx);
      expect(delDia.checadas).toEqual([
        expect.objectContaining({
          trabajador: 'Pedro',
          horas: 3,
          entradaConFoto: true,
          entradaDespues: true,
        }),
      ]);
      await como(tx, USUARIOS.carlos);
      expect(await checadasDeLaObra(tx, { obraId: OBRAS.a1Carlos, dia: delDia.hoy })).toHaveLength(1);
      const cierre = await datosParaCierre(tx, { obraId: OBRAS.a1Carlos });
      expect(cierre!.checadas).toHaveLength(1);
      // Luis no es PM de OB-001: no ve sus checadas
      await como(tx, USUARIOS.luis);
      expect(await checadasDeLaObra(tx, { obraId: OBRAS.a1Carlos, dia: delDia.hoy })).toEqual([]);
    }));

  it('quien cobra por día cuenta un día, una sola vez por día y obra', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const llave = await preparar(tx, 'Juan');
      await sinSesion(tx, async () => {
        await checar(tx, llave, { tipo: 'entrada', ...CERCA, capturada: hace(60) });
        expect((await checar(tx, llave, { tipo: 'salida', ...CERCA })).horas).toBe(1);
        await checar(tx, llave, { tipo: 'entrada', ...CERCA });
        expect((await checar(tx, llave, { tipo: 'salida', ...CERCA })).horas).toBeNull();
      });
    }));

  it('la salida olvidada la pone el dueño con motivo; anular la entrada se lleva sus horas', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const llave = await preparar(tx);
      const entrada = await sinSesion(tx, () =>
        checar(tx, llave, { tipo: 'entrada', ...CERCA, capturada: hace(10) }),
      );
      const hora = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(Date.now() - 60_000));
      expect(
        await codigo(tx, () => corregirSalida(tx, { entradaId: entrada.checadaId!, hora, motivo: '' })),
      ).toBe('motivo_requerido');
      await corregirSalida(tx, { entradaId: entrada.checadaId!, hora, motivo: 'Se le acabó la pila' });
      const [c] = (await checadasDelDia(tx)).checadas;
      expect(c!.salida).toMatchObject({ origen: 'correccion', motivo: 'Se le acabó la pila' });
      expect(c!.horas).toBe(0.25);

      await anularChecada(tx, { checadaId: entrada.checadaId!, motivo: 'Checó por error' });
      expect((await checadasDelDia(tx)).checadas).toEqual([]);
      const [m] = await tx<{ n: number }[]>`
        select count(*)::int as n from mano_obra m join trabajadores t on t.id = m.trabajador_id
        where t.nombre = 'Pedro' and m.bitacora_id is null and m.estado = 'vigente' and m.dia = current_date`;
      expect(m!.n).toBe(0);
    }));

  it('con la checada, el cierre no captura cuadrilla: liga las horas checadas; anular el cierre no se las lleva', () =>
    probarComo(USUARIOS.duenoA, async (tx) => {
      const llave = await preparar(tx);
      await sinSesion(tx, async () => {
        await checar(tx, llave, { tipo: 'entrada', ...CERCA, capturada: hace(120) });
        await checar(tx, llave, { tipo: 'salida', ...CERCA });
      });
      await como(tx, USUARIOS.carlos);
      const [p] = await tx<{ id: string }[]>`
        select id from partidas_obra where obra_id = ${OBRAS.a1Carlos} and estado = 'activa' order by orden limit 1`;
      const juan = await trabajador(tx, 'Juan');
      const r = await cerrarDia(tx, {
        obraId: OBRAS.a1Carlos,
        partidas: [p!.id],
        // lo que mande el teléfono de cuadrilla no cuenta
        cuadrilla: [{ trabajadorId: juan, cantidad: 1 }],
        fotosPorSubir: 1,
      });
      expect(r.cuadrilla).toBe(0);
      const ligadas = await tx<{ trabajador: string; cantidad: string }[]>`
        select t.nombre as trabajador, m.cantidad from mano_obra m join trabajadores t on t.id = m.trabajador_id
        where m.bitacora_id = ${r.bitacoraId} and m.estado = 'vigente'`;
      expect(ligadas.map((x) => [x.trabajador, Number(x.cantidad)])).toEqual([['Pedro', 2]]);

      await anularCierre(tx, { bitacoraId: r.bitacoraId, motivo: 'Me equivoqué de partidas' });
      const [quedan] = await tx<{ n: number }[]>`
        select count(*)::int as n from mano_obra m join trabajadores t on t.id = m.trabajador_id
        where t.nombre = 'Pedro' and m.obra_id = ${OBRAS.a1Carlos} and m.bitacora_id is null and m.estado = 'vigente'
          and m.cantidad = 2`;
      expect(quedan!.n).toBe(1);
    }));
});
