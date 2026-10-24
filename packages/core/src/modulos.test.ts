import { describe, expect, it } from 'vitest';
import { conLoQueNecesitan, MODULOS, MODULOS_DEL_PLAN, sinElModulo } from './modulos';

describe('los módulos de una empresa (D-110)', () => {
  it('prender uno prende lo que necesita', () => {
    expect(conLoQueNecesitan(['cambios'])).toEqual(['dinero', 'portal', 'cambios']);
    expect(conLoQueNecesitan(['historico', 'indicadores'])).toEqual(['dinero', 'indicadores', 'historico']);
    expect(conLoQueNecesitan([])).toEqual([]);
  });

  it('apagar uno apaga los que dependen de él', () => {
    expect(sinElModulo(MODULOS, 'dinero')).toEqual([
      'portal',
      'calidad',
      'nomina',
      'indicadores',
      'desempeno',
      'marca',
    ]);
    expect(sinElModulo(['dinero', 'portal', 'cambios'], 'portal')).toEqual(['dinero']);
    expect(sinElModulo(['dinero', 'calidad'], 'calidad')).toEqual(['dinero']);
  });

  it('cada plan ya trae lo que necesitan sus módulos', () => {
    for (const ms of Object.values(MODULOS_DEL_PLAN)) expect(conLoQueNecesitan(ms)).toEqual([...ms]);
  });
});
