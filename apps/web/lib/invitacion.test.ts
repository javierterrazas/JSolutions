import { describe, expect, it } from 'vitest';
import { tokenDeInvitacion } from './invitacion';

const TOKEN = 'k3Jx_9aQ-2mPzR7tLw0vYb5nC8dE1fGh4iUoSjKlMnB';

describe('la invitación que se pega en la app instalada', () => {
  it('del enlace completo, con o sin texto alrededor, o el token solo', () => {
    for (const texto of [
      `https://j-solutions-nine.vercel.app/invitacion/${TOKEN}`,
      `Hola Carlos, tu invitación: https://j-solutions-nine.vercel.app/invitacion/${TOKEN} (vale 7 días)`,
      `  ${TOKEN}\n`,
    ])
      expect(tokenDeInvitacion(texto), texto).toBe(TOKEN);
  });
  it('lo que no es una invitación no da token', () => {
    for (const texto of [
      '',
      'hola',
      'https://j-solutions-nine.vercel.app/',
      'https://otra.com/invitacion/corto',
    ])
      expect(tokenDeInvitacion(texto), texto).toBeNull();
  });
});
