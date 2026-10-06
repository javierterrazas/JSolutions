import { describe, expect, it } from 'vitest';
import { validarPin } from './acceso';
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
    expect(codigo(() => validarPin('2468', 'pm'))).toBeNull();
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

  it('los parecidos sí valen', () => {
    for (const pin of ['1235', '2468', '1122', '0101', '9870'])
      expect(
        codigo(() => validarPin(pin, 'pm')),
        pin,
      ).toBeNull();
  });
});
