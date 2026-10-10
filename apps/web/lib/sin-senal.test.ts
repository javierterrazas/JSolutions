// La app sin señal (D-047): qué se ofrece para cerrar con la copia y el PIN local.
import type { CopiaSinSenal } from '@ijm/servidor';
import { describe, expect, it } from 'vitest';
import type { ElementoCola } from './cola';
import {
  datosDeHoy,
  estaAbierto,
  estadoDeHoy,
  hoyDeLaCopia,
  huellaDePin,
  nuevaHuella,
  type ObraDeLaCopia,
  pinConfirmado,
  type PinLocal,
  revisarPinLocal,
} from './sin-senal';

const obra: ObraDeLaCopia = {
  datos: {
    obra: { id: 'obra-1', folio: 'OB-001', cliente: 'Familia Pérez', estado: 'en_obra' },
    dia: '2026-10-08',
    tardio: false,
    yaCerrado: false,
    diasSinCierre: [],
    espacios: [],
    trabajadores: [],
    subs: [
      {
        ordenId: 'o1',
        folio: 'OT-1',
        sub: 'Plomería Rápida',
        alcance: 'Rough',
        partida: null,
        inicio: '2026-10-07',
      },
      { ordenId: 'o2', folio: 'OT-2', sub: 'Tile Pro', alcance: 'Piso', partida: null, inicio: '2026-10-12' },
    ],
    motivos: ['clima'],
  },
  cerrados: ['2026-10-05'],
};

const cierreEnCola = (obraId: string, dia: string): ElementoCola => ({
  id: 'c1',
  n: 1,
  tipo: 'cierre',
  etiqueta: { obra: 'OB-001', dia },
  entrada: { obraId } as never,
  intentos: 0,
});

describe('lo que se cierra sin señal', () => {
  it('hoy es el día en la zona de la empresa, no en la del teléfono', () => {
    // 11 pm del 8 en Austin ya es el 9 en UTC
    const ahora = new Date('2026-10-09T04:00:00Z');
    expect(hoyDeLaCopia({ zona: 'America/Chicago' } as CopiaSinSenal, ahora)).toBe('2026-10-08');
  });

  it('se cierra hoy, no un día olvidado, y solo con los subs cuya orden ya empezó', () => {
    const d = datosDeHoy(obra, '2026-10-09');
    expect(d).toMatchObject({ dia: '2026-10-09', tardio: false });
    expect(d.subs.map((s) => s.ordenId)).toEqual(['o1']);
    expect(datosDeHoy(obra, '2026-10-12').subs.map((s) => s.ordenId)).toEqual(['o1', 'o2']);
  });

  it('hoy ya cerrado en el servidor, o cerrado en el teléfono y esperando la señal, no se vuelve a ofrecer', () => {
    expect(estadoDeHoy(obra, '2026-10-05', [])).toBe('cerrado');
    expect(estadoDeHoy(obra, '2026-10-08', [cierreEnCola('obra-1', '2026-10-08')])).toBe('en_el_telefono');
    expect(estadoDeHoy(obra, '2026-10-08', [cierreEnCola('obra-2', '2026-10-08')])).toBe('por_cerrar');
    expect(estadoDeHoy(obra, '2026-10-08', [cierreEnCola('obra-1', '2026-10-07')])).toBe('por_cerrar');
  });
});

describe('el PIN local', () => {
  const ahora = new Date('2026-10-08T15:00:00Z');
  const minutos = (n: number) => new Date(ahora.getTime() + n * 60_000);

  it('guarda una huella, no el PIN; la misma sal da la misma huella', async () => {
    const h = await nuevaHuella('7305');
    expect(h.huella).not.toContain('7305');
    expect(await huellaDePin('7305', h.sal)).toBe(h.huella);
    expect(await huellaDePin('7306', h.sal)).not.toBe(h.huella);
    expect((await nuevaHuella('7305')).sal).not.toBe(h.sal);
  });

  it('confirmado por el servidor, abre por la jornada del PM (16 h)', () => {
    const p = pinConfirmado('m1', 4, { sal: 's', huella: 'h' }, ahora);
    expect(estaAbierto(p, minutos(16 * 60 - 1))).toBe(true);
    expect(estaAbierto(p, minutos(16 * 60 + 1))).toBe(false);
  });

  it('5 intentos fallidos bloquean 15 minutos; bloqueado, ni el correcto abre; después sí', () => {
    let p: PinLocal = { ...pinConfirmado('m1', 4, { sal: 's', huella: 'h' }, ahora), abiertoHasta: null };
    for (let i = 1; i <= 4; i++) {
      const r = revisarPinLocal(p, false, ahora);
      expect(r.resultado).toEqual({ ok: false, codigo: 'pin_incorrecto', datos: { quedan: 5 - i } });
      p = r.pin;
    }
    const bloqueo = revisarPinLocal(p, false, ahora);
    expect(bloqueo.resultado).toMatchObject({ ok: false, codigo: 'pin_bloqueado' });
    p = bloqueo.pin;
    expect(revisarPinLocal(p, true, minutos(14)).resultado).toMatchObject({ codigo: 'pin_bloqueado' });
    const despues = revisarPinLocal(p, true, minutos(16));
    expect(despues.resultado).toEqual({ ok: true });
    expect(estaAbierto(despues.pin, minutos(17))).toBe(true);
  });

  it('el correcto borra los intentos fallidos', () => {
    let p = pinConfirmado('m1', 4, { sal: 's', huella: 'h' }, ahora);
    p = revisarPinLocal(p, false, ahora).pin;
    p = revisarPinLocal(p, true, ahora).pin;
    expect(p.intentos).toBe(0);
  });
});
