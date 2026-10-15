// Da a un usuario el papel de quien administra la plataforma (D-080): en su inicio le aparece "Plataforma", donde ve
// las empresas, sus suscripciones y sus pagos. Tiene que ser alguien que ya entra a la app (un miembro con su
// celular verificado). Lo corre quien desarrolla la plataforma, con la conexión directa a la base:
//
//   pnpm exec tsx --env-file=.env.nube packages/servidor/scripts/admin-plataforma.ts --celular 5125550101
//
// Con --correo en vez de --celular, para quien se dio de alta con correo (antes de D-083). Con --quitar, se lo quita.
import { parseArgs } from 'node:util';
import { correoDeCelular, normalizarCelular } from '@ijm/core';
import postgres from 'postgres';

const { values: a } = parseArgs({
  options: { celular: { type: 'string' }, correo: { type: 'string' }, quitar: { type: 'boolean' } },
});
const base = process.env.DATABASE_URL;
const celular = a.celular ? normalizarCelular(a.celular) : null;
if ((!a.correo && !celular) || !base) {
  console.error(
    a.celular && !celular
      ? 'Ese celular no está completo'
      : !base
        ? 'Falta DATABASE_URL en el archivo .env'
        : 'Falta --celular (o --correo)',
  );
  process.exit(1);
}
const correo = celular ? correoDeCelular(celular) : a.correo!.trim().toLowerCase();
const quien = a.celular ?? correo;
// la base de la nube pide SSL; la local no lo tiene
const sql = postgres(base, {
  max: 1,
  prepare: false,
  onnotice: () => {},
  ssl: /@(127\.0\.0\.1|localhost)[:/]/.test(base) ? false : 'require',
});

try {
  const [u] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = ${correo}`;
  if (!u) {
    console.error(`${quien} no es usuario de la app.`);
    process.exitCode = 1;
  } else if (a.quitar) {
    await sql`delete from plataforma.administradores where user_id = ${u.id}`;
    console.log(`${quien} ya no administra la plataforma.`);
  } else {
    await sql`insert into plataforma.administradores (user_id) values (${u.id}) on conflict do nothing`;
    console.log(`${quien} administra la plataforma: en su inicio le aparece "Plataforma".`);
  }
} finally {
  await sql.end();
}
