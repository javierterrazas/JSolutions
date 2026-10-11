// Comprueba la conexión directa a la base (DATABASE_URL) que usan los scripts de administración, sin escribir nada y
// sin mostrar la contraseña: dice si conectó, como quién y a dónde, o qué está mal en la cadena.
//
//   pnpm exec tsx --env-file=.env.nube packages/servidor/scripts/probar-conexion.ts
import postgres from 'postgres';

const base = process.env.DATABASE_URL;
if (!base) {
  console.error('Falta DATABASE_URL en el archivo .env (una línea DATABASE_URL=postgresql://…).');
  process.exit(1);
}

let url: URL;
try {
  url = new URL(base);
} catch {
  console.error('DATABASE_URL no es una cadena de conexión: debe empezar con postgresql://');
  process.exit(1);
}
if (!/^postgres(ql)?:$/.test(url.protocol)) {
  console.error('DATABASE_URL debe empezar con postgresql://');
  process.exit(1);
}
if (/YOUR-PASSWORD/i.test(base)) {
  console.error(
    'La cadena todavía dice [YOUR-PASSWORD]: cámbialo por la contraseña de la base (sin los corchetes).',
  );
  process.exit(1);
}
const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
// lo que se puede mostrar: el usuario y el servidor, nunca la contraseña
console.log(`Probando como ${decodeURIComponent(url.username)} en ${url.hostname}:${url.port || 5432}…`);

const sql = postgres(base, {
  max: 1,
  prepare: false,
  onnotice: () => {},
  connect_timeout: 15,
  ssl: local ? false : 'require',
});
try {
  const [r] = await sql.begin(
    'read only',
    (tx) => tx<{ yo: string; empresas: number }[]>`
    select current_user as yo, (select count(*)::int from public.empresas) as empresas`,
  );
  console.log(
    `Conectado como ${r!.yo}. La base tiene ${r!.empresas} empresa(s). La contraseña es la correcta.`,
  );
} catch (e) {
  const err = e as { code?: string; message?: string };
  const mensaje = err.message ?? String(e);
  if (err.code === '28P01' || /password authentication failed/i.test(mensaje))
    console.error('La contraseña no es la correcta. Cámbiala en el panel: Project Settings → Database.');
  else if (/tenant or user not found/i.test(mensaje))
    console.error(
      'El usuario no es el del proyecto: en el Session pooler debe ser postgres.kmtyufxmhzkkregkrsjs',
    );
  else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')
    console.error(`No se encontró el servidor ${url.hostname}: revisa la dirección, o que haya internet.`);
  else if (err.code === 'ETIMEDOUT' || err.code === 'CONNECT_TIMEOUT' || err.code === 'ENETUNREACH')
    console.error(
      'No contestó el servidor. Si usaste la "Direct connection", usa la del "Session pooler" (en el plan gratuito la directa no llega desde todas las redes).',
    );
  else console.error(`No se pudo conectar: ${mensaje}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
