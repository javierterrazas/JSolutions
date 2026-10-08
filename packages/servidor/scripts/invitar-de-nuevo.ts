// Una invitación nueva para un miembro, por su correo, sin entrar a la app (D-038). Es el respaldo para cuando el
// dueño no puede entrar a Equipo, por ejemplo porque su celular quedó verificado para otra persona. Anula las
// invitaciones que el miembro no usó. Lo corre quien administra la plataforma con la llave secreta:
//
//   pnpm exec tsx --env-file=.env.nube packages/servidor/scripts/invitar-de-nuevo.ts \
//     --correo dueno@ejemplo.com --url https://j-solutions-nine.vercel.app
import { createHash, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { DIAS_INVITACION } from '@ijm/core';
import { createClient } from '@supabase/supabase-js';

const { values: a } = parseArgs({ options: { correo: { type: 'string' }, url: { type: 'string' } } });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SECRET_KEY;
if (!a.correo || !a.url || !url || !llave) {
  console.error(
    !a.correo || !a.url
      ? 'Faltan --correo o --url'
      : 'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el archivo .env',
  );
  process.exit(1);
}
const correo = a.correo.trim().toLowerCase();
const supabase = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

// el usuario de Auth de ese correo
let usuario: string | undefined;
for (let pagina = 1; !usuario; pagina++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) throw error;
  usuario = data.users.find((u) => u.email?.toLowerCase() === correo)?.id;
  if (data.users.length < 200) break;
}
if (!usuario) {
  console.error(`No hay ningún usuario con el correo ${correo}.`);
  process.exit(1);
}

const { data: miembros, error } = await supabase
  .from('miembros')
  .select('id, empresa_id, nombre, rol, activo')
  .eq('user_id', usuario);
if (error) throw error;
const m = miembros[0];
if (!m) {
  console.error(`${correo} no es miembro de ninguna empresa.`);
  process.exit(1);
}
if (!m.activo) {
  console.error(`${m.nombre} está dado de baja: primero hay que reactivarlo.`);
  process.exit(1);
}

// la base guarda solo el hash del token, igual que public.hash_secreto
const token = randomBytes(32).toString('base64url');
const ahora = new Date();
const expira = new Date(ahora.getTime() + DIAS_INVITACION * 24 * 3600 * 1000);
const anuladas = await supabase
  .from('invitaciones')
  .update({ anulada_en: ahora.toISOString() })
  .eq('miembro_id', m.id)
  .is('usada_en', null)
  .is('anulada_en', null);
if (anuladas.error) throw anuladas.error;
const nueva = await supabase.from('invitaciones').insert({
  empresa_id: m.empresa_id,
  miembro_id: m.id,
  token_hash: createHash('sha256').update(token, 'utf8').digest('hex'),
  expira_en: expira.toISOString(),
});
if (nueva.error) throw nueva.error;

console.log(`Invitación nueva para ${m.nombre} (${m.rol}). Las anteriores sin usar quedaron anuladas.`);
console.log(`Ábrela en SU celular (vale hasta el ${expira.toLocaleDateString('es-MX')}, una vez):`);
console.log(`${a.url.replace(/\/$/, '')}/invitacion/${token}`);
