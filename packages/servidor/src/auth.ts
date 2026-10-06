// Lo que el servidor le pide a la API de Auth de Supabase con la llave secreta (el service role). Solo para lo que
// la base no puede hacer: crear el usuario de un correo, preparar la sesión de un celular recién verificado y firmar
// los enlaces de las fotos (D-027). Nunca para leer o escribir datos de negocio.
import { createClient } from '@supabase/supabase-js';
import type { UsuarioDeCorreo } from './acceso';
import type { FirmarEnlace } from './fotos';

export interface AuthAdmin {
  readonly usuarioDeCorreo: UsuarioDeCorreo;
  /**
   * Un token de un solo uso para abrir la sesión del usuario de ese correo en el celular que acaba de canjear su
   * invitación. Quien lo recibe lo canjea enseguida (`verifyOtp` con `type: 'magiclink'`); no se manda por correo.
   */
  readonly tokenDeSesion: (correo: string) => Promise<string>;
  readonly firmarEnlace: FirmarEnlace;
}

export function authAdmin(url: string, llaveSecreta: string): AuthAdmin {
  const admin = createClient(url, llaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function enlace(correo: string) {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: correo });
    if (error) throw error;
    return data;
  }

  return {
    async usuarioDeCorreo(correo) {
      const { data, error } = await admin.auth.admin.createUser({ email: correo, email_confirm: true });
      if (!error) return data.user.id;
      if (error.code !== 'email_exists') throw error;
      // ya existe: su id sale del enlace (que no se usa ni se manda)
      return (await enlace(correo)).user.id;
    },
    async tokenDeSesion(correo) {
      return (await enlace(correo)).properties.hashed_token;
    },
    async firmarEnlace(ruta, segundos) {
      const { data, error } = await admin.storage.from('fotos').createSignedUrl(ruta, segundos);
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
