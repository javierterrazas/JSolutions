// La conexión MCP del asistente del dueño (D-114). El asistente (Claude u otro) manda aquí sus mensajes de JSON-RPC por
// POST, con la llave en la dirección: la llave dice a nombre de qué dueño se consulta, y cada herramienta corre con su
// identidad (ve lo mismo que él en la app). Solo lectura. Sin estado: no hay sesión ni flujo de eventos (GET: 405).
// Cada consulta queda anotada, aunque falle.
import {
  anotarConsultaAsistente,
  atenderMcp,
  correrHerramienta,
  enNombreDe,
  herramientasDelAsistente,
  quienConsultaConLlave,
  sinUsuario,
} from '@ijm/servidor';
import { esErrorDeNegocio } from '@ijm/core';
import { servidor } from '@/lib/servidor';

export const dynamic = 'force-dynamic';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
const falla = (code: number, message: string, status: number) =>
  json({ jsonrpc: '2.0', id: null, error: { code, message } }, status);

export async function POST(peticion: Request, { params }: RouteContext<'/mcp/[llave]'>) {
  const { llave } = await params;
  let quien;
  try {
    quien = await sinUsuario(servidor(), (tx) => quienConsultaConLlave(tx, llave));
  } catch (e) {
    if (esErrorDeNegocio(e) && e.codigo === 'demasiadas_consultas')
      return falla(-32000, 'Demasiadas consultas en un minuto: espera un momento.', 429);
    throw e;
  }
  if (!quien)
    return falla(
      -32001,
      'Este enlace ya no sirve: la llave se quitó o la empresa no tiene el asistente.',
      404,
    );

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return falla(-32700, 'Parse error', 400);
  }
  const { userId, llaveId, idioma } = quien;
  const r = await atenderMcp(cuerpo, {
    listar: () => enNombreDe(servidor(), { userId }, (tx) => herramientasDelAsistente(tx)),
    llamar: async (nombre, args) => {
      const inicio = Date.now();
      let ok = false;
      try {
        const x = await enNombreDe(servidor(), { userId }, (tx) =>
          correrHerramienta(tx, nombre, args, idioma),
        );
        ok = !!x && !x.error;
        return x;
      } finally {
        await sinUsuario(servidor(), (tx) =>
          anotarConsultaAsistente(tx, {
            llaveId,
            herramienta: nombre,
            argumentos: args,
            ok,
            milisegundos: Date.now() - inicio,
          }),
        ).catch(() => {});
      }
    },
  });
  // solo notificaciones: recibidas, sin respuesta
  return r === null ? new Response(null, { status: 202 }) : json(r);
}

const soloPost = () => new Response(null, { status: 405, headers: { allow: 'POST' } });
export const GET = soloPost;
export const DELETE = soloPost;
