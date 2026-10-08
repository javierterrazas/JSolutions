import { describe, expect, it } from 'vitest';
import { formatoDinero } from './dinero';

describe('el dinero', () => {
  it('como en Estados Unidos, en español y en inglés', () => {
    expect(formatoDinero('es').format(28500.5)).toBe('$28,500.50');
    expect(formatoDinero('en').format(28500.5)).toBe('$28,500.50');
  });
});
