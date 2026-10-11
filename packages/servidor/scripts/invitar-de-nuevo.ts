// Una invitación nueva para un miembro, por su correo, sin entrar a la app (D-038). Es el respaldo para cuando el
// dueño no puede entrar a Equipo, por ejemplo porque su celular quedó verificado para otra persona. Anula las
// invitaciones que el miembro no usó. Lo corre quien administra la plataforma con la conexión a la base
// (DATABASE_URL: directo, porque la API de datos de Supabase está apagada):
//
//   pnpm exec tsx --env-file=.env.nube packages/servidor/scripts/invitar-de-nuevo.ts \
//     --correo dueno@ejemplo.com --url https://j-solutions-nine.vercel.app
import { createHash, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { DIAS_INVITACION } from '@ijm/core';
import postgres from 'postgres';

const { values: a } = parseArgs({ options: { correo: { type: 'string' }, url: { type: 'string' } } });
const base = process.env.DATABASE_URL;
if (!a.correo || !a.url || !base) {
  console.error(!a.correo || !a.url ? 'Faltan --correo o --url' : 'Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}
const correo = a.correo.trim().toLowerCase();
// la base de la nube pide SSL; la local no lo tiene
const sql = postgres(base, {
  max: 1,
  prepare: false,
  onnotice: () => {},
  ssl: /@(127\.0\.0\.1|localhost)[:/]/.test(base) ? false : 'require',
});

try {
  const miembros = await sql<
    { id: string; empresa_id: string; nombre: string; rol: string; activo: boolean }[]
  >`
    select m.id, m.empresa_id, m.nombre, m.rol, m.activo
    from public.miembros m join auth.users u on u.id = m.user_id
    where lower(u.email) = ${correo}`;
  const m = miembros[0];
  if (!m) {
    console.error(`${correo} no es miembro de ninguna empresa.`);
    process.exitCode = 1;
  } else if (!m.activo) {
    console.error(`${m.nombre} está dado de baja: primero hay que reactivarlo.`);
    process.exitCode = 1;
  } else {
    // la base guarda solo el hash del token, igual que public.hash_secreto
    const token = randomBytes(32).toString('base64url');
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + DIAS_INVITACION * 24 * 3600 * 1000);
    await sql.begin(async (tx) => {
      await tx`
        update public.invitaciones set anulada_en = ${ahora}
        where miembro_id = ${m.id} and usada_en is null and anulada_en is null`;
      await tx`
        insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
        values (${m.empresa_id}, ${m.id}, ${createHash('sha256').update(token, 'utf8').digest('hex')}, ${expira})`;
    });
    console.log(`Invitación nueva para ${m.nombre} (${m.rol}). Las anteriores sin usar quedaron anuladas.`);
    console.log(`Ábrela en SU celular (vale hasta el ${expira.toLocaleDateString('es-MX')}, una vez):`);
    console.log(`${a.url.replace(/\/$/, '')}/invitacion/${token}`);
  }
} finally {
  await sql.end();
}
