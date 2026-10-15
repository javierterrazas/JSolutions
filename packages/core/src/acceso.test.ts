import { describe, expect, it } from 'vitest';
import { celularDeCorreo, correoDeCelular, formatoCelular, normalizarCelular, validarPin } from './acceso';
import { ErrorDeNegocio } from './errores';

const codigo = (fn: () => void) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ErrorDeNegocio ? [e.codigo, e.datos] : e;
  }
};

describe('validar el PIN', () => {
  it('el PM usa 4 dígitos; el dueño y el administrador, 6', () => {
    expect(codigo(() => validarPin('5170', 'pm'))).toBeNull();
    expect(codigo(() => validarPin('482915', 'dueno'))).toBeNull();
    expect(codigo(() => validarPin('482915', 'admin'))).toBeNull();
    expect(codigo(() => validarPin('482915', 'pm'))).toEqual(['pin_invalido', { largo: 4 }]);
    expect(codigo(() => validarPin('2468', 'dueno'))).toEqual(['pin_invalido', { largo: 6 }]);
  });

  it('solo dígitos', () => {
    expect(codigo(() => validarPin('24a8', 'pm'))).toEqual(['pin_invalido', { largo: 4 }]);
    expect(codigo(() => validarPin(' 2468', 'pm'))).toEqual(['pin_invalido', { largo: 4 }]);
    expect(codigo(() => validarPin('', 'pm'))).toEqual(['pin_invalido', { largo: 4 }]);
  });

  it('rechaza los fáciles de adivinar: un dígito repetido o una escalera', () => {
    for (const pin of ['0000', '7777', '1234', '6789', '9876', '3210'])
      expect(
        codigo(() => validarPin(pin, 'pm')),
        pin,
      ).toEqual(['pin_debil', undefined]);
    for (const pin of ['111111', '123456', '654321'])
      expect(
        codigo(() => validarPin(pin, 'dueno')),
        pin,
      ).toEqual(['pin_debil', undefined]);
  });

  it('rechaza también los más usados (D-055): de 2 en 2, dos dígitos, un año, mitades o pares, el teclado', () => {
    for (const pin of [
      '2468',
      '1357',
      '8642',
      '1212',
      '1122',
      '0101',
      '6969',
      '2000',
      '1987',
      '2024',
      '2580',
    ])
      expect(
        codigo(() => validarPin(pin, 'pm')),
        pin,
      ).toEqual(['pin_debil', undefined]);
    for (const pin of ['121212', '112211', '123123', '112233', '147258'])
      expect(
        codigo(() => validarPin(pin, 'dueno')),
        pin,
      ).toEqual(['pin_debil', undefined]);
  });

  it('los parecidos sí valen', () => {
    for (const pin of ['1235', '5170', '3859', '9870', '0471', '1939', '2040'])
      expect(
        codigo(() => validarPin(pin, 'pm')),
        pin,
      ).toBeNull();
    for (const pin of ['482915', '193046', '123124'])
      expect(
        codigo(() => validarPin(pin, 'dueno')),
        pin,
      ).toBeNull();
  });
});

describe('el celular de un miembro (D-083)', () => {
  it('normaliza los formatos de siempre a +1, y respeta el + de otro país', () => {
    for (const t of ['512-555-0101', '(512) 555 0101', '5125550101', '1 512 555 0101', '+1 512 555-0101'])
      expect(normalizarCelular(t), t).toBe('+15125550101');
    expect(normalizarCelular('+52 55 1234 5678')).toBe('+525512345678');
    for (const t of ['555-0101', '', 'abc', '+12', '25125550101']) expect(normalizarCelular(t), t).toBeNull();
  });

  it('la dirección interna va y vuelve; un correo de verdad no es celular', () => {
    expect(correoDeCelular('+15125550101')).toBe('15125550101@celular.invalid');
    expect(celularDeCorreo('15125550101@celular.invalid')).toBe('+15125550101');
    expect(celularDeCorreo('javier@icloud.com')).toBeNull();
    expect(celularDeCorreo(null)).toBeNull();
  });

  it('se muestra como (512) 555-0101', () => {
    expect(formatoCelular('+15125550101')).toBe('(512) 555-0101');
    expect(formatoCelular('+525512345678')).toBe('+525512345678');
  });
});
