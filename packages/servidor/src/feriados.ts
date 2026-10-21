// Los feriados de la empresa, para el dueño (D-108): los días que no se trabaja cuentan para los días laborables del
// cronograma, de los cierres y de los indicadores (D-028). Se dan de alta uno por uno o los de Estados Unidos de un
// año de un toque; nada se borra: un feriado que sí se trabaja se marca así.
import { type Dia, ErrorDeNegocio, feriadosDeEstadosUnidos } from '@ijm/core';
import postgres from 'postgres';
import { z } from 'zod';
import type { Tx } from './conexion';
import { dia, uuid, validarEntrada } from './entrada';
import { exigirDueno, leerSesion } from './sesion';

export interface Feriado {
  readonly id: string;
  readonly dia: Dia;
  readonly nombre: string;
  readonly nombreEn: string | null;
  readonly seTrabaja: boolean;
}

/** Los feriados de este año en adelante, por fecha. */
export async function feriadosDeLaEmpresa(
  tx: Tx,
  ahora = new Date(),
): Promise<{ hoy: Dia; feriados: Feriado[] }> {
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const feriados = await tx<Feriado[]>`
    select id, to_char(dia, 'YYYY-MM-DD') as dia, nombre_es as nombre, nombre_en as "nombreEn",
           se_trabaja as "seTrabaja"
    from feriados where dia >= ${`${s.hoy.slice(0, 4)}-01-01`} order by dia`;
  return { hoy: s.hoy, feriados };
}

const EntradaFeriado = z.object({
  dia,
  nombre: z.string().trim().min(1).max(80),
  nombreEn: z.string().trim().max(80).nullish(),
});

/** Da de alta un feriado. Error: `feriado_repetido` (ya hay uno ese día). */
export async function agregarFeriado(
  tx: Tx,
  entrada: z.input<typeof EntradaFeriado>,
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(EntradaFeriado, entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  try {
    await tx.savepoint(
      (sp) => sp`
        insert into feriados (empresa_id, dia, nombre_es, nombre_en)
        values (${s.empresaId}, ${e.dia}, ${e.nombre}, ${e.nombreEn || null})`,
    );
  } catch (err) {
    if (err instanceof postgres.PostgresError && err.code === '23505')
      throw new ErrorDeNegocio('feriado_repetido');
    throw err;
  }
}

/** Da de alta los feriados de Estados Unidos de un año; los días que ya tenían uno se quedan como estaban. */
export async function agregarFeriadosDeEstadosUnidos(
  tx: Tx,
  entrada: { anio: number },
  ahora = new Date(),
): Promise<{ agregados: number }> {
  const { anio } = validarEntrada(z.object({ anio: z.number().int().min(2020).max(2100) }), entrada);
  const s = await leerSesion(tx, ahora);
  exigirDueno(s);
  const filas = feriadosDeEstadosUnidos(anio).map((f) => ({
    empresa_id: s.empresaId,
    dia: f.dia,
    nombre_es: f.es,
    nombre_en: f.en,
  }));
  const r = await tx`insert into feriados ${tx(filas)} on conflict (empresa_id, dia) do nothing`;
  return { agregados: r.count };
}

/** Marca si un feriado se trabaja o se descansa. Error: `registro_no_encontrado`. */
export async function cambiarFeriado(
  tx: Tx,
  entrada: { feriadoId: string; seTrabaja: boolean },
  ahora = new Date(),
): Promise<void> {
  const e = validarEntrada(z.object({ feriadoId: uuid, seTrabaja: z.boolean() }), entrada);
  exigirDueno(await leerSesion(tx, ahora));
  const r = await tx`update feriados set se_trabaja = ${e.seTrabaja} where id = ${e.feriadoId}`;
  if (!r.count) throw new ErrorDeNegocio('registro_no_encontrado');
}
