-- Paso 4 · La muralla financiera y el aislamiento entre empresas.
--
-- Reglas (CLAUDE.md, D-002, D-003, D-017, D-026):
--   · por la API (PostgREST, rol authenticated) los usuarios SOLO LEEN;
--   · toda escritura la hace el servidor de la app con el rol servidor_app, a nombre del usuario de la sesión,
--     después de validar las reglas de negocio con packages/core. RLS sigue protegiendo esas escrituras: si el
--     servidor tiene un error, la base no deja escribir en la obra de otro PM ni cruzar empresas;
--   · toda política filtra por la empresa de la sesión;
--   · las tablas 💲 solo las leen dueño y administrador;
--   · el PM ve solo las obras que tiene asignadas, mientras no se entreguen;
--   · nada se borra: ningún rol de usuario tiene DELETE ni TRUNCATE, y ninguna política permite borrar.
--
-- Nunca se debilita una política para que pase una prueba.

-- ------------------------------------------------------------------ el rol del servidor
-- El servidor de la app se conecta a la base y, por cada operación, toma este rol con la identidad del usuario
-- (request.jwt.claims). Hereda lo que lee authenticated; además crea y edita. PostgREST no puede tomarlo: el
-- rol authenticator no es miembro de servidor_app.
create role servidor_app nologin inherit;
grant authenticated to servidor_app;
grant servidor_app to postgres;
grant usage on schema public to servidor_app;

-- ------------------------------------------------------------------ permisos de las tablas
-- Supabase da por defecto todos los permisos a anon y a authenticated, incluido TRUNCATE (al que RLS no aplica).
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger, maintain on all tables in schema public
  from authenticated;
grant select, insert, update on all tables in schema public to servidor_app;

revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Lo que se cree después nace cerrado: cada migración da sus permisos explícitamente.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant select, insert, update on tables to servidor_app;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
-- El permiso de ejecutar que toda función nueva da a PUBLIC (y por eso a anon) es global: la forma "in schema" de
-- arriba no lo quita. Esta sí.
alter default privileges revoke execute on functions from public;

-- Las funciones que las políticas necesitan (paso 3), y quién las puede llamar.
grant execute on function public.miembro_actual(), public.empresa_actual(), public.rol_actual(),
  public.es_dueno_o_admin(), public.es_pm_de(uuid) to authenticated, service_role;
grant execute on function public.siguiente_folio(uuid, text, integer) to service_role;

-- El PIN es secreto incluso para su dueño y para el dueño de la empresa: solo el servidor lo verifica (D-024).
revoke select on public.dispositivos from authenticated;
grant select (id, empresa_id, miembro_id, nombre, verificado_en, ultimo_uso, revocado_en, revocado_por, creado_en,
              actualizado_en)
  on public.dispositivos to authenticated;

-- ------------------------------------------------------------------ apoyo
-- Las obras del PM de la sesión: asignadas, sin entregar. Una sola consulta por sentencia, no una por renglón.
create function public.obras_del_pm() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select o.id from public.obras o
  where o.pm_id = public.miembro_actual() and o.estado <> 'entregada' and public.rol_actual() = 'pm'
$$;
grant execute on function public.obras_del_pm() to authenticated, service_role;

-- ------------------------------------------------------------------ lo que la base asigna y protege
-- Una importación (el importador de la fase 3) conserva folios y autores del legacy: lo declara con
-- set local ijm.importando = 'si'. Solo el servidor y el service role pueden escribir, así que nadie más lo usa.
create function public.importando() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('ijm.importando', true), '') = 'si'
$$;
grant execute on function public.importando() to servidor_app, service_role;

-- El folio lo asigna siempre la base, dentro de la transacción (D-005). Nadie lo elige ni lo aparta.
create function public.asignar_folio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.importando() or new.folio is null then
    new.folio := public.siguiente_folio(new.empresa_id, tg_argv[0], tg_argv[1]::integer);
  end if;
  return new;
end $$;

-- Quién, cuándo, de qué empresa y con qué folio no se cambian después.
create function public.proteger_columnas_fijas() returns trigger
language plpgsql set search_path = '' as $$
declare
  antes jsonb := to_jsonb(old);
  despues jsonb := to_jsonb(new);
  c text;
begin
  if public.importando() then
    return new;
  end if;
  foreach c in array array['empresa_id', 'creado_por', 'creado_en', 'folio'] loop
    if antes ? c and antes -> c is distinct from despues -> c then
      raise exception 'La columna % no se puede cambiar', c using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- Una foto se guarda en la carpeta de su empresa y su obra, y apunta a un registro de esa misma obra.
create function public.validar_foto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  existe boolean;
begin
  if new.storage_path not like new.empresa_id::text || '/' || new.obra_id::text || '/%'
     or new.storage_path like '%..%' then
    raise exception 'La ruta de la foto no corresponde a su empresa y su obra' using errcode = '23514';
  end if;
  existe := case new.ref_tipo
    when 'bitacora' then exists (select 1 from public.bitacora r where r.id = new.ref_id and r.obra_id = new.obra_id)
    when 'inspeccion' then exists (select 1 from public.inspecciones r where r.id = new.ref_id and r.obra_id = new.obra_id)
    when 'prueba_agua' then exists (select 1 from public.pruebas_agua r where r.id = new.ref_id and r.obra_id = new.obra_id)
    when 'aviso' then exists (select 1 from public.avisos r where r.id = new.ref_id and r.obra_id = new.obra_id)
    when 'punch' then exists (select 1 from public.punch_list r where r.id = new.ref_id and r.obra_id = new.obra_id)
    when 'gasto' then exists (select 1 from public.gastos r where r.id = new.ref_id and r.obra_id = new.obra_id)
    when 'orden_cambio' then exists (select 1 from public.ordenes_cambio r where r.id = new.ref_id and r.obra_id = new.obra_id)
  end;
  if not existe then
    raise exception 'La foto apunta a un registro que no es de su obra' using errcode = '23503';
  end if;
  return new;
end $$;

alter table public.fotos drop constraint fotos_ref_tipo_ref_id_indice_key;
alter table public.fotos add constraint fotos_ref_tipo_ref_id_indice_key unique (empresa_id, ref_tipo, ref_id, indice);
create trigger validar_foto before insert or update on public.fotos
  for each row execute function public.validar_foto();

do $$
declare
  t record;
begin
  -- folios: prefijo y dígitos de cada tabla
  for t in select * from (values
      ('obras', 'OB', 3), ('bitacora', 'BIT', 4), ('gastos', 'GTO', 4), ('avisos', 'BLQ', 4),
      ('punch_list', 'PUN', 4), ('ordenes_trabajo', 'OT', 4), ('pagos_sub', 'PAG', 4),
      ('ordenes_cambio', 'OC', 4), ('no_calidad', 'NC', 4), ('cobros', 'COB', 4)) as x(tabla, prefijo, digitos) loop
    -- la base llena el folio: el servidor no lo manda (el not null lo garantiza el disparador)
    execute format('alter table public.%I alter column folio drop not null', t.tabla);
    execute format('alter table public.%I add constraint %I check (folio is not null)', t.tabla, t.tabla || '_folio_asignado');
    execute format('create trigger asignar_folio before insert on public.%I
                    for each row execute function public.asignar_folio(%L, %L)', t.tabla, t.prefijo, t.digitos);
  end loop;
  -- columnas fijas en toda tabla que tenga alguna
  for t in select distinct table_name as tabla from information_schema.columns
           where table_schema = 'public' and column_name in ('empresa_id', 'creado_por', 'creado_en', 'folio')
             and table_name in (select table_name from information_schema.tables
                                where table_schema = 'public' and table_type = 'BASE TABLE') loop
    execute format('create trigger proteger_columnas_fijas before update on public.%I
                    for each row execute function public.proteger_columnas_fijas()', t.tabla);
  end loop;
end $$;

-- ------------------------------------------------------------------ plantillas de políticas
-- La mayoría de las tablas sigue uno de estos patrones. Se generan para que todas digan exactamente lo mismo.
-- Cada política de escritura repite COMPLETA su condición en el with check: en PostgreSQL, los with check de
-- varias políticas permisivas se combinan con OR, y uno incompleto abriría la puerta a los demás roles.
create function pg_temp.rls_dueno(t text, ops text[]) returns void language plpgsql as $$
declare
  op text;
  d text := 'empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin())';
begin
  foreach op in array ops loop
    if op = 'select' then
      execute format('create policy "dueno lee" on public.%I for select to authenticated using (%s)', t, d);
    elsif op = 'insert' then
      execute format('create policy "dueno crea" on public.%I for insert to servidor_app with check (%s)', t, d);
    elsif op = 'update' then
      execute format('create policy "dueno edita" on public.%I for update to servidor_app using (%s) with check (%s)',
                     t, d, d);
    end if;
  end loop;
end $$;

-- Catálogo que todo miembro de la empresa lee y solo el dueño edita.
create function pg_temp.rls_catalogo(t text) returns void language plpgsql as $$
begin
  execute format('create policy "la empresa lee" on public.%I for select to authenticated
                  using (empresa_id = (select public.empresa_actual()))', t);
  perform pg_temp.rls_dueno(t, array['insert', 'update']);
end $$;

-- Lo de una obra que el PM lee en sus obras.
create function pg_temp.rls_pm_lee(t text) returns void language plpgsql as $$
begin
  execute format('create policy "pm lee sus obras" on public.%I for select to authenticated
                  using (empresa_id = (select public.empresa_actual())
                         and obra_id in (select public.obras_del_pm()))', t);
end $$;

-- Lo que el PM registra en obra: el servidor lo crea en sus obras, a su nombre.
create function pg_temp.rls_pm_crea(t text, a_su_nombre boolean) returns void language plpgsql as $$
begin
  execute format('create policy "pm crea en sus obras" on public.%I for insert to servidor_app
                  with check (empresa_id = (select public.empresa_actual())
                              and obra_id in (select public.obras_del_pm())%s)',
                 t, case when a_su_nombre then ' and creado_por = (select public.miembro_actual())' else '' end);
end $$;

-- ------------------------------------------------------------------ empresa y usuarios
create policy "dueno lee su empresa" on public.empresas for select to authenticated
  using (id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno edita su empresa" on public.empresas for update to servidor_app
  using (id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()))
  with check (id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

select pg_temp.rls_dueno('configuracion', array['select', 'update']);
select pg_temp.rls_dueno('metas_indicadores', array['select', 'insert', 'update']);

-- Miembros y dispositivos: el alta, la baja, la invitación y el PIN los maneja el servidor con el service role
-- (fase 2). Por la API, cada quien lee lo suyo y el dueño lee lo de su empresa.
select pg_temp.rls_dueno('miembros', array['select']);
create policy "cada quien lee su miembro" on public.miembros for select to authenticated
  using (id = (select public.miembro_actual()));
select pg_temp.rls_dueno('dispositivos', array['select']);
create policy "cada quien lee sus dispositivos" on public.dispositivos for select to authenticated
  using (miembro_id = (select public.miembro_actual()));

-- folios: sin políticas. Solo la base numera (asignar_folio).

-- ------------------------------------------------------------------ catálogo
select pg_temp.rls_catalogo('tipos_espacio');
select pg_temp.rls_catalogo('oficios');
select pg_temp.rls_catalogo('etapas');
select pg_temp.rls_catalogo('hitos_calidad');
select pg_temp.rls_catalogo('puntos_control');
select pg_temp.rls_catalogo('trabajadores');            -- el PM necesita tipo_pago, nunca la tarifa
select pg_temp.rls_dueno('plantillas_partida', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('subcontratistas', array['select', 'insert', 'update']);   -- el PM: vista

-- ------------------------------------------------------------------ 💲 la muralla financiera
select pg_temp.rls_dueno('tarifas_trabajador', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('obras_finanzas', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('presupuesto_etapas', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('ordenes_trabajo_precios', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('pagos_sub', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('ordenes_cambio_montos', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('no_calidad', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('cobros', array['select', 'insert', 'update']);
select pg_temp.rls_dueno('obras_cerradas', array['select', 'insert']);
select pg_temp.rls_dueno('historico_etapas', array['select', 'insert']);

-- ------------------------------------------------------------------ obras
create policy "pm lee sus obras" on public.obras for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and id in (select public.obras_del_pm()));
select pg_temp.rls_dueno('obras', array['select', 'insert', 'update']);

select pg_temp.rls_dueno('espacios', array['select', 'insert', 'update']);
select pg_temp.rls_pm_lee('espacios');
-- La medida verificada (D-014): el servidor la escribe a nombre del PM, solo en sus obras.
create policy "pm verifica medidas en sus obras" on public.espacios for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and verificado_por = (select public.miembro_actual()));

select pg_temp.rls_dueno('partidas_obra', array['select', 'insert', 'update']);
select pg_temp.rls_pm_lee('partidas_obra');
select pg_temp.rls_dueno('plan_semanal', array['select', 'insert']);
select pg_temp.rls_dueno('historico_duraciones', array['select', 'insert']);
select pg_temp.rls_dueno('entregas', array['select', 'insert', 'update']);          -- el PM: vista

-- ------------------------------------------------------------------ lo que registra el PM
-- El dueño lee todo y registra el cierre tardío (bitácora, partidas, avance, cuadrilla). El PM lee lo de sus
-- obras y el servidor lo crea a su nombre. Las correcciones (48 h para el PM) son ediciones del servidor.
select pg_temp.rls_dueno('bitacora', array['select', 'insert', 'update']);
select pg_temp.rls_pm_lee('bitacora');
select pg_temp.rls_pm_crea('bitacora', true);
create policy "pm corrige sus cierres" on public.bitacora for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and creado_por = (select public.miembro_actual()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()));

select pg_temp.rls_dueno('bitacora_partidas', array['select', 'insert']);
select pg_temp.rls_pm_lee('bitacora_partidas');
select pg_temp.rls_pm_crea('bitacora_partidas', false);

select pg_temp.rls_dueno('bitacora_subs', array['select', 'insert']);
select pg_temp.rls_pm_lee('bitacora_subs');
select pg_temp.rls_pm_crea('bitacora_subs', false);

select pg_temp.rls_dueno('avance', array['select', 'insert', 'update']);
select pg_temp.rls_pm_lee('avance');
select pg_temp.rls_pm_crea('avance', true);
create policy "pm corrige su avance" on public.avance for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and creado_por = (select public.miembro_actual()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()));

select pg_temp.rls_dueno('mano_obra', array['select', 'insert', 'update']);
select pg_temp.rls_pm_lee('mano_obra');
select pg_temp.rls_pm_crea('mano_obra', true);
create policy "pm corrige su cuadrilla" on public.mano_obra for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and creado_por = (select public.miembro_actual()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()));

select pg_temp.rls_dueno('inspecciones', array['select']);
select pg_temp.rls_pm_lee('inspecciones');
select pg_temp.rls_pm_crea('inspecciones', true);
select pg_temp.rls_dueno('inspeccion_respuestas', array['select']);
select pg_temp.rls_pm_lee('inspeccion_respuestas');
select pg_temp.rls_pm_crea('inspeccion_respuestas', false);

select pg_temp.rls_dueno('pruebas_agua', array['select']);
select pg_temp.rls_pm_lee('pruebas_agua');
select pg_temp.rls_pm_crea('pruebas_agua', true);
create policy "pm cierra sus pruebas de agua" on public.pruebas_agua for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and creado_por = (select public.miembro_actual()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()));

-- El punch list lo escribe el PM en el recorrido con el cliente, y lo cierra.
select pg_temp.rls_dueno('punch_list', array['select', 'insert', 'update']);
select pg_temp.rls_pm_lee('punch_list');
select pg_temp.rls_pm_crea('punch_list', true);
create policy "pm edita el punch de sus obras" on public.punch_list for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()));

-- Fotos: el PM ve las de bitácora, inspecciones, pruebas de agua y punch de sus obras, y las de SUS gastos y SUS
-- avisos. Nunca los recibos de las compras de la oficina ni las fotos de órdenes de cambio.
select pg_temp.rls_dueno('fotos', array['select', 'insert']);
create policy "pm lee las fotos de sus obras" on public.fotos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and (ref_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch')
              or (ref_tipo = 'gasto' and ref_id in (select g.id from public.gastos g
                                                    where g.creado_por = (select public.miembro_actual())
                                                      and g.origen = 'pm'))
              or (ref_tipo = 'aviso' and ref_id in (select a.id from public.avisos a
                                                    where a.creado_por = (select public.miembro_actual())))));
create policy "pm sube fotos a sus obras" on public.fotos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()) and ref_tipo <> 'orden_cambio');

-- Gastos: el PM ve solo los que él registró, nunca las compras de la oficina (aunque sean de su obra). Como en
-- el legacy, también los de obras ya entregadas (D-025).
select pg_temp.rls_dueno('gastos', array['select', 'insert', 'update']);
create policy "pm lee sus gastos" on public.gastos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and origen = 'pm'
         and creado_por = (select public.miembro_actual()) and (select public.rol_actual()) = 'pm');
create policy "pm registra gastos en sus obras" on public.gastos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and origen = 'pm' and creado_por = (select public.miembro_actual()) and revision is distinct from 'revisado'
              and estado = 'vigente');
create policy "pm corrige sus gastos" on public.gastos for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and origen = 'pm'
         and creado_por = (select public.miembro_actual()) and obra_id in (select public.obras_del_pm()))
  with check (empresa_id = (select public.empresa_actual()) and origen = 'pm'
              and creado_por = (select public.miembro_actual()) and obra_id in (select public.obras_del_pm()));

-- Avisos: el PM ve los que él levantó, con su respuesta. Responderlos es del dueño.
select pg_temp.rls_dueno('avisos', array['select', 'insert', 'update']);
create policy "pm lee sus avisos" on public.avisos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and creado_por = (select public.miembro_actual())
         and (select public.rol_actual()) = 'pm');
create policy "pm levanta avisos en sus obras" on public.avisos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()) and estado = 'abierto' and respuesta is null
              and respondido_por is null);

-- Órdenes de trabajo: el PM ve las emitidas, confirmadas y aprobadas de sus obras. Nunca las pagadas ni las
-- canceladas: "pagada" revela pagos (D-017). El servidor confirma, marca llegada y aprueba a su nombre, sin
-- poder llevarlas a pagada o cancelada.
select pg_temp.rls_dueno('ordenes_trabajo', array['select', 'insert', 'update']);
create policy "pm lee las ordenes vigentes de sus obras" on public.ordenes_trabajo for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and estado in ('emitida', 'confirmada', 'aprobada'));
create policy "pm confirma y aprueba ordenes de sus obras" on public.ordenes_trabajo for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and estado in ('emitida', 'confirmada', 'aprobada'))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and estado in ('emitida', 'confirmada', 'aprobada'));

-- Órdenes de cambio: el PM las lee por la vista ordenes_cambio_pm, sin condición de pago ni fecha de cobro.
select pg_temp.rls_dueno('ordenes_cambio', array['select', 'insert', 'update']);

-- Correcciones: el dueño las lee. Las escribe el servidor junto con la corrección, a nombre de quien corrige.
select pg_temp.rls_dueno('correcciones', array['select']);
create policy "el servidor deja el rastro" on public.correcciones for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and creado_por = (select public.miembro_actual()));

-- ------------------------------------------------------------------ vistas para el PM (D-013)
-- Columnas que el PM sí necesita de tablas que no puede leer completas. Las vistas son del dueño de la base
-- (no security_invoker) y por eso cada una filtra por sí misma: la empresa de la sesión y, donde aplica, las
-- obras del PM. security_barrier: los filtros de quien consulta no se evalúan antes que los de la vista.
create view public.empresa_actual_datos with (security_barrier = true) as
  select id, nombre, zona_horaria, idioma from public.empresas
  where id = (select public.empresa_actual());

create view public.configuracion_pm with (security_barrier = true) as
  select empresa_id, limite_compra_pm, horas_sin_recibo, sla_bloqueo_horas from public.configuracion
  where empresa_id = (select public.empresa_actual());

create view public.subcontratistas_pm with (security_barrier = true) as
  select id, empresa_id, nombre, oficio_id, telefono, activo from public.subcontratistas
  where empresa_id = (select public.empresa_actual());

create view public.entregas_pm with (security_barrier = true) as
  select obra_id, empresa_id, fecha_entrega from public.entregas
  where empresa_id = (select public.empresa_actual())
    and (obra_id in (select public.obras_del_pm()) or (select public.es_dueno_o_admin()));

-- Sin estado: "facturada" revela cobros. Para el PM, una orden autorizada o facturada es una orden que ejecutar.
create view public.ordenes_cambio_pm with (security_barrier = true) as
  select id, empresa_id, obra_id, folio, descripcion, dias_impacto, autorizada_en from public.ordenes_cambio
  where empresa_id = (select public.empresa_actual())
    and obra_id in (select public.obras_del_pm())
    and estado in ('autorizada', 'facturada');

revoke all on public.empresa_actual_datos, public.configuracion_pm, public.subcontratistas_pm,
              public.entregas_pm, public.ordenes_cambio_pm from public, anon, authenticated, servidor_app;
grant select on public.empresa_actual_datos, public.configuracion_pm, public.subcontratistas_pm,
                public.entregas_pm, public.ordenes_cambio_pm to authenticated;

-- ------------------------------------------------------------------ Storage: las fotos
-- Un bucket privado. La ruta de cada archivo empieza con empresa/obra/… (D-007). Los usuarios SUBEN directo (las
-- fotos pesan y la señal es mala) pero no leen directo: el servidor revisa que el usuario pueda ver la fila de
-- `fotos` y le da un enlace firmado de pocos minutos (D-026). Así un enlace no sobrevive a una baja, y los
-- recibos de la oficina no se ven por la carpeta de la obra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy "pm sube fotos a sus obras" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
              and (storage.foldername(name))[1] = (select public.empresa_actual())::text
              and (storage.foldername(name))[2] in (select o::text from public.obras_del_pm() o));

create policy "dueno sube fotos de su empresa" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (select public.es_dueno_o_admin())
              and (storage.foldername(name))[1] = (select public.empresa_actual())::text
              and (storage.foldername(name))[2] in (select o.id::text from public.obras o
                                                    where o.empresa_id = (select public.empresa_actual())));
-- Sin políticas de lectura, edición ni borrado: una foto subida no se reemplaza ni se borra, y se ve solo por
-- un enlace firmado del servidor.

-- Las plantillas eran solo para esta migración.
drop function pg_temp.rls_pm_crea(text, boolean);
drop function pg_temp.rls_pm_lee(text);
drop function pg_temp.rls_catalogo(text);
drop function pg_temp.rls_dueno(text, text[]);
