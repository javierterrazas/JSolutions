import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('@ijm/core', () => {
  it('se puede importar', () => {
    expect(core).toBeTypeOf('object');
  });
});
