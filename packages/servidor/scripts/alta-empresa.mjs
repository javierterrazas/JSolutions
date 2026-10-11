// Da de alta una empresa con su dueño y imprime el enlace de invitación del dueño (D-038). Lo corre quien
// administra la plataforma, desde su computadora, con la llave secreta del proyecto de Supabase y la conexión a su
// base en un archivo .env que nunca se sube al repositorio:
//
//   node --env-file=.env.nube packages/servidor/scripts/alta-empresa.mjs \
//     --empresa "IJM Construction" --ciudad "Austin, TX" --dueno "Javier" --correo dueno@ejemplo.com \
//     --url https://j-solutions.vercel.app
//
// El .env necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (para crear el usuario en Auth) y DATABASE_URL
// (la base, directo: la API de datos de Supabase está apagada, D-038). No manda ningún correo: el enlace se abre en
// el celular del dueño, vale 7 días y una sola vez.
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const { values: a } = parseArgs({
  options: {
    empresa: { type: 'string' },
    ciudad: { type: 'string', default: '' },
    zona: { type: 'string', default: 'America/Chicago' },
    idioma: { type: 'string', default: 'es' },
    dueno: { type: 'string' },
    correo: { type: 'string' },
    url: { type: 'string' },
  },
});
const faltan = ['empresa', 'dueno', 'correo', 'url'].filter((k) => !a[k]);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SECRET_KEY;
const base = process.env.DATABASE_URL;
if (faltan.length || !url || !llave || !base) {
  console.error(
    faltan.length
      ? `Faltan: ${faltan.map((k) => '--' + k).join(', ')}`
      : 'Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o DATABASE_URL en el archivo .env',
  );
  process.exit(1);
}

const supabase = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });
const correo = a.correo.trim().toLowerCase();

const creado = await supabase.auth.admin.createUser({ email: correo, email_confirm: true });
if (creado.error) {
  console.error(`No se pudo crear el usuario de ${correo}: ${creado.error.message}`);
  process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const expira = new Date(Date.now() + 7 * 24 * 3600 * 1000);
// la base de la nube pide SSL; la local no lo tiene
const sql = postgres(base, {
  max: 1,
  prepare: false,
  onnotice: () => {},
  ssl: /@(127\.0\.0\.1|localhost)[:/]/.test(base) ? false : 'require',
});
try {
  await sql`
    select public.alta_empresa(${a.empresa}, ${a.ciudad}, ${a.zona}, ${a.idioma}::public.idioma,
                               ${creado.data.user.id}::uuid, ${a.dueno}, ${token}, ${expira.toISOString()}::timestamptz)`;
} catch (e) {
  // sin empresa, el usuario no sirve: se borra para poder intentarlo de nuevo con el mismo correo
  await supabase.auth.admin.deleteUser(creado.data.user.id);
  console.error(`No se pudo dar de alta la empresa: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
} finally {
  await sql.end();
}

console.log(`Empresa "${a.empresa}" dada de alta, con ${a.dueno} como dueño.`);
console.log(
  `Abre este enlace en el celular del dueño (vale hasta el ${expira.toLocaleDateString('es-MX')}, una vez):`,
);
console.log(`${a.url.replace(/\/$/, '')}/invitacion/${token}`);
