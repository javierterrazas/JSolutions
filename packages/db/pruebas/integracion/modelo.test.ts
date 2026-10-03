// Lo que el modelo de datos garantiza por sí mismo, sin depender del código de la app.
import { afterAll, describe, expect, it } from 'vitest';
import { conexionDePrueba } from '../conexion';
import { crearEmpresaDePrueba, enTransaccionRevertida, errorDe } from '../datos';

const { cliente } = conexionDePrueba();
afterAll(() => cliente.end());

// docs/MODELO_DE_DATOS.md
const TABLAS = [
  'empresas', 'configuracion', 'metas_indicadores', 'miembros', 'dispositivos', 'folios',
  'tipos_espacio', 'oficios', 'etapas', 'hitos_calidad', 'puntos_control', 'plantillas_partida',
  'subcontratistas', 'trabajadores', 'tarifas_trabajador',
  'obras', 'obras_finanzas', 'espacios', 'partidas_obra', 'presupuesto_etapas', 'plan_semanal',
  'bitacora', 'bitacora_partidas', 'bitacora_subs', 'avance', 'mano_obra', 'gastos', 'avisos',
  'inspecciones', 'inspeccion_respuestas', 'pruebas_agua', 'punch_list', 'fotos',
  'ordenes_trabajo', 'ordenes_trabajo_precios', 'pagos_sub', 'ordenes_cambio', 'ordenes_cambio_montos',
  'no_calidad', 'cobros', 'entregas', 'obras_cerradas', 'historico_etapas', 'historico_duraciones',
  'correcciones',
]; // prettier-ignore

// 💲 La muralla financiera: tablas que solo leerán dueño y administrador (D-002).
const TABLAS_DINERO = [
  'tarifas_trabajador', 'obras_finanzas', 'presupuesto_etapas', 'ordenes_trabajo_precios', 'pagos_sub',
  'ordenes_cambio_montos', 'no_calidad', 'cobros', 'obras_cerradas', 'historico_etapas',
]; // prettier-ignore

describe('las tablas del modelo', () => {
  it('existen todas, y ninguna más', async () => {
    const r = await cliente<{ tabla: string }[]>`
      select table_name as tabla from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`;
    expect(r.map((t) => t.tabla).sort()).toEqual([...TABLAS].sort());
  });

  it('toda tabla de negocio lleva empresa_id obligatorio', async () => {
    const r = await cliente<{ tabla: string }[]>`
      select t.table_name as tabla from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE' and t.table_name <> 'empresas'
        and not exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = t.table_name
                          and c.column_name = 'empresa_id' and c.is_nullable = 'NO')`;
    expect(r.map((t) => t.tabla)).toEqual([]);
  });

  it('ninguna columna usa punto flotante: el dinero y las medidas son numeric', async () => {
    const r = await cliente<{ columna: string }[]>`
      select table_name || '.' || column_name as columna from information_schema.columns
      where table_schema = 'public' and data_type in ('real', 'double precision', 'money')`;
    expect(r.map((c) => c.columna)).toEqual([]);
  });

  it('los montos de las tablas 💲 son numeric(12,2)', async () => {
    const r = await cliente<{ columna: string; tipo: string }[]>`
      select table_name || '.' || column_name as columna, format_type(a.atttypid, a.atttypmod) as tipo
      from information_schema.columns c
      join pg_attribute a on a.attrelid = ('public.' || c.table_name)::regclass and a.attname = c.column_name
      where c.table_schema = 'public' and c.table_name = any(${TABLAS_DINERO})
        and c.column_name in ('monto', 'precio', 'tarifa', 'costo', 'costo_estimado', 'precio_cliente',
                              'contrato_original', 'costo_real', 'cobrado')`;
    expect(r.length).toBeGreaterThanOrEqual(10);
    expect(r.filter((c) => c.tipo !== 'numeric(12,2)')).toEqual([]);
  });

  it('el dinero no está en las tablas que leerá el PM', async () => {
    const r = await cliente<{ columna: string }[]>`
      select table_name || '.' || column_name as columna from information_schema.columns
      where table_schema = 'public' and not (table_name = any(${TABLAS_DINERO}))
        and table_name not in ('configuracion', 'gastos')
        and column_name ~ '(monto|precio|tarifa|costo|contrato|margen|cobrado|pagado)'`;
    expect(r.map((c) => c.columna)).toEqual([]);
  });
});

describe('integridad entre empresas', () => {
  it('un registro de una empresa no puede apuntar a otra', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx, 'Empresa A');
      const b = await crearEmpresaDePrueba(tx, 'Empresa B');

      // un espacio de la obra de A con el tipo de espacio de B
      expect(
        await errorDe(
          tx,
          (t) => t`insert into espacios (empresa_id, obra_id, tipo_espacio_id, nombre)
                   values (${a.empresa}, ${a.obra}, ${b.tipoEspacio}, 'x')`,
        ),
      ).toMatch(/foreign key/);

      // una obra de A con el PM de B
      expect(
        await errorDe(
          tx,
          (t) => t`insert into obras (empresa_id, folio, cliente, telefono_cliente, direccion, pm_id,
                                      fecha_inicio, fecha_fin_estimada)
                   values (${a.empresa}, 'OB-002', 'C', '5125550100', 'D', ${b.pm}, '2026-10-05', '2026-10-30')`,
        ),
      ).toMatch(/foreign key/);

      // un avance de la obra de A sobre una partida de la obra de B
      expect(
        await errorDe(
          tx,
          (t) => t`insert into avance (empresa_id, obra_id, partida_obra_id, estado, dia)
                   values (${a.empresa}, ${a.obra}, ${b.partida}, 'en_progreso', '2026-10-05')`,
        ),
      ).toMatch(/foreign key/);

      // el mismo avance, bien armado, sí entra
      expect(
        await errorDe(
          tx,
          (t) => t`insert into avance (empresa_id, obra_id, partida_obra_id, estado, dia)
                   values (${a.empresa}, ${a.obra}, ${a.partida}, 'en_progreso', '2026-10-05')`,
        ),
      ).toBeNull();
    }));

  it('una partida de otro espacio no sirve para la mano de obra de este', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      const [otro] = await tx`insert into espacios (empresa_id, obra_id, tipo_espacio_id, nombre)
                              values (${a.empresa}, ${a.obra}, ${a.tipoEspacio}, 'Otro baño') returning id`;
      const [t] = await tx`insert into trabajadores (empresa_id, nombre, tipo_pago)
                           values (${a.empresa}, 'Pedro', 'hora') returning id`;
      expect(
        await errorDe(
          tx,
          (
            x,
          ) => x`insert into mano_obra (empresa_id, obra_id, espacio_id, partida_obra_id, trabajador_id, cantidad, dia)
                   values (${a.empresa}, ${a.obra}, ${otro!.id}, ${a.partida}, ${t!.id}, 8, '2026-10-05')`,
        ),
      ).toMatch(/foreign key/);
    }));
});

describe('reglas que guarda la base', () => {
  it('un solo cierre vigente por obra y día; anulado, se puede volver a cerrar', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      const cierre = (folio: string) => (t: typeof tx) =>
        t`insert into bitacora (empresa_id, folio, obra_id, dia) values (${a.empresa}, ${folio}, ${a.obra}, '2026-10-05')`;
      expect(await errorDe(tx, cierre('BIT-0001'))).toBeNull();
      expect(await errorDe(tx, cierre('BIT-0002'))).toMatch(/bitacora_un_cierre_por_dia/);
      await tx`update bitacora set estado = 'anulado' where folio = 'BIT-0001' and empresa_id = ${a.empresa}`;
      expect(await errorDe(tx, cierre('BIT-0003'))).toBeNull();
    }));

  it('"hoy no hubo trabajo" exige motivo y no compromete fotos', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      expect(
        await errorDe(
          tx,
          (t) => t`insert into bitacora (empresa_id, folio, obra_id, dia, sin_trabajo)
                   values (${a.empresa}, 'BIT-0001', ${a.obra}, '2026-10-05', true)`,
        ),
      ).toMatch(/check constraint/);
      expect(
        await errorDe(
          tx,
          (t) => t`insert into bitacora (empresa_id, folio, obra_id, dia, sin_trabajo, motivo_sin_trabajo)
                   values (${a.empresa}, 'BIT-0001', ${a.obra}, '2026-10-05', true, 'clima')`,
        ),
      ).toBeNull();
    }));

  it('una foto con el mismo número no entra dos veces (un reintento sin señal)', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      const [b] = await tx`insert into bitacora (empresa_id, folio, obra_id, dia, fotos_comprometidas)
                           values (${a.empresa}, 'BIT-0001', ${a.obra}, '2026-10-05', 2) returning id`;
      const foto = (ruta: string) => (t: typeof tx) =>
        t`insert into fotos (empresa_id, obra_id, ref_tipo, ref_id, indice, storage_path)
          values (${a.empresa}, ${a.obra}, 'bitacora', ${b!.id}, 1, ${ruta})`;
      expect(await errorDe(tx, foto(`${a.empresa}/${a.obra}/1.jpg`))).toBeNull();
      expect(await errorDe(tx, foto(`${a.empresa}/${a.obra}/1-reintento.jpg`))).toMatch(
        /fotos_ref_tipo_ref_id_indice_key/,
      );
    }));

  it('la fecha de entrega no puede ser antes del inicio', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      expect(
        await errorDe(tx, (t) => t`update obras set fecha_fin_estimada = '2026-10-01' where id = ${a.obra}`),
      ).toMatch(/check constraint/);
    }));

  it('el teléfono del cliente necesita al menos 10 dígitos', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      expect(
        await errorDe(tx, (t) => t`update obras set telefono_cliente = '555-0100' where id = ${a.obra}`),
      ).toMatch(/check constraint/);
    }));

  it('las dos medidas del espacio: la verificada guarda quién y cuándo', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      expect(
        await errorDe(tx, (t) => t`update espacios set pies2_verificados = 48 where id = ${a.espacio}`),
      ).toMatch(/check constraint/);
      expect(
        await errorDe(
          tx,
          (t) => t`update espacios set pies2_verificados = 48, verificado_por = ${a.pm}, verificado_en = now()
                   where id = ${a.espacio}`,
        ),
      ).toBeNull();
      const [e] = await tx`select pies2_cotizados, pies2_verificados from espacios where id = ${a.espacio}`;
      expect(e).toEqual({ pies2_cotizados: '45.00', pies2_verificados: '48.00' });
    }));

  it('actualizado_en se renueva solo al editar', () =>
    enTransaccionRevertida(cliente, async (tx) => {
      const a = await crearEmpresaDePrueba(tx);
      await tx`update obras set actualizado_en = '2000-01-01' where id = ${a.obra}`;
      const [o] = await tx`select actualizado_en > '2001-01-01' as renovado from obras where id = ${a.obra}`;
      expect(o!.renovado).toBe(true);
    }));
});
