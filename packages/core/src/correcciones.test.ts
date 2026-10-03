import { describe, expect, it } from 'vitest';
import { cambiosAplicables, validarCorreccion } from './correcciones';
import { ErrorDeNegocio } from './errores';

const error = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    if (!(e instanceof ErrorDeNegocio)) throw e;
    return e.codigo;
  }
};

const ahora = new Date('2026-10-12T18:00:00Z');
const base = {
  tabla: 'mano_obra',
  esPM: true,
  esPropio: true,
  creadoEn: new Date('2026-10-11T18:00:00Z'),
  ahora,
  obraCerrada: false,
  anulado: false,
  motivo: 'Se fue a mediodía',
  accion: 'editar' as const,
};

describe('quién corrige qué', () => {
  it('el PM corrige lo suyo dentro de 48 horas, con motivo', () => {
    expect(error(() => validarCorreccion(base))).toBeNull();
    expect(error(() => validarCorreccion({ ...base, motivo: 'no' }))).toBe('falta_motivo');
    expect(error(() => validarCorreccion({ ...base, esPropio: false }))).toBe('registro_de_otro');
    expect(error(() => validarCorreccion({ ...base, creadoEn: new Date('2026-10-10T17:00:00Z') }))).toBe(
      'fuera_de_48_horas',
    );
    expect(error(() => validarCorreccion({ ...base, tabla: 'cobros' }))).toBe('tabla_no_corregible');
  });

  it('el dueño corrige sin límite de tiempo, también lo de otros y cobros y pagos; nunca en una obra cerrada', () => {
    const dueno = { ...base, esPM: false, esPropio: false, creadoEn: new Date('2026-01-01T00:00:00Z') };
    expect(error(() => validarCorreccion({ ...dueno, tabla: 'cobros' }))).toBeNull();
    expect(error(() => validarCorreccion({ ...dueno, obraCerrada: true }))).toBe('obra_cerrada');
    expect(error(() => validarCorreccion({ ...dueno, tabla: 'obras' }))).toBe('tabla_no_corregible');
  });

  it('lo anulado no se edita; anularlo otra vez sí se permite (no hace nada)', () => {
    expect(error(() => validarCorreccion({ ...base, anulado: true }))).toBe('ya_anulado');
    expect(error(() => validarCorreccion({ ...base, anulado: true, accion: 'anular' }))).toBeNull();
  });
});

describe('los cambios que se aplican', () => {
  it('solo campos editables que cambian; montos y cantidades como números', () => {
    const actual = { monto: '120.00', proveedor: 'Home Depot', obra_id: 'OB-1' };
    expect(cambiosAplicables('gastos', actual, { monto: 120, proveedor: "Lowe's", obra_id: 'OB-2' })).toEqual(
      [{ campo: 'proveedor', antes: 'Home Depot', despues: "Lowe's" }],
    );
    expect(error(() => cambiosAplicables('gastos', actual, { monto: '120' }))).toBe('sin_cambios');
    expect(error(() => cambiosAplicables('avance', { estado: 'en_progreso' }, { estado: 'terminada' }))).toBe(
      'sin_cambios',
    );
  });
});
