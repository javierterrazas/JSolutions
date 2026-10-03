-- Paso 4 · Correcciones de la segunda revisión independiente (D-027).
-- La API ya estaba cerrada. Lo que se cierra aquí es lo que el SERVIDOR podía hacer a nombre de un usuario más
-- allá de lo que D-026 promete, más algunas fugas menores.

-- ------------------------------------------------------------------ el usuario de base del servidor (A3)
-- El servidor se conecta con este usuario, nunca con postgres: si un camino de código olvida el set role o hace
-- reset role, se queda sin permisos en lugar de saltarse RLS. noinherit: solo tiene los permisos de servidor_app
-- después de `set local role servidor_app`. La contraseña la pone quien despliega; no va en el repositorio.
create role ijm_servidor login noinherit nobypassrls;
grant servidor_app to ijm_servidor;

-- ------------------------------------------------------------------ la importación es solo para el importador (A1)
-- Antes bastaba con que cualquier rol fijara ijm.importando. Ahora solo cuenta para una sesión que no tomó un rol
-- de usuario: el importador (service role) o una conexión administrativa. Nunca para servidor_app ni la API.
create or replace function public.importando() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('ijm.importando', true), '') = 'si'
     and current_setting('role') in ('none', 'service_role')
$$;

-- Al importar un folio, el contador avanza hasta él: lo que el servidor cree después no choca.
create or replace function public.asignar_folio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if public.importando() and new.folio is not null then
    n := nullif(substring(new.folio from '^' || tg_argv[0] || '-([0-9]+)$'), '')::integer;
    if n is not null then
      insert into public.folios as f (empresa_id, prefijo, ultimo) values (new.empresa_id, tg_argv[0], n)
      on conflict (empresa_id, prefijo) do update set ultimo = greatest(f.ultimo, excluded.ultimo);
    end if;
  else
    new.folio := public.siguiente_folio(new.empresa_id, tg_argv[0], tg_argv[1]::integer);
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ quién y cuándo los pone la base (M1, M3)
-- Al crear, creado_por es el miembro de la sesión y creado_en es ahora, mande lo que mande el servidor. Sin
-- sesión de usuario (migraciones, datos de prueba, importador) se respeta lo que venga.
create function public.fijar_autor() returns trigger
language plpgsql set search_path = '' as $$
declare
  yo uuid := public.miembro_actual();
begin
  if public.importando() then
    return new;
  end if;
  if yo is not null then
    new := jsonb_populate_record(new, jsonb_build_object('creado_por', yo));
  end if;
  if to_jsonb(new) ? 'creado_en' then
    new := jsonb_populate_record(new, jsonb_build_object('creado_en', now()));
  end if;
  return new;
end $$;

-- La obra de un registro tampoco cambia después: corregirla es anular y volver a registrar (M2).
create or replace function public.proteger_columnas_fijas() returns trigger
language plpgsql set search_path = '' as $$
declare
  antes jsonb := to_jsonb(old);
  despues jsonb := to_jsonb(new);
  c text;
begin
  if public.importando() then
    return new;
  end if;
  foreach c in array array['empresa_id', 'obra_id', 'creado_por', 'creado_en', 'folio'] loop
    if antes ? c and antes -> c is distinct from despues -> c then
      raise exception 'La columna % no se puede cambiar', c using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- ------------------------------------------------------------------ lo que el PM puede cambiar (A2, M2)
-- Cuando el usuario de la sesión es PM, cada tabla que él edita (vía servidor) tiene una lista cerrada de
-- columnas. Cualquier otra columna que cambie es un error. El dueño no tiene esta lista: sus ediciones dejan
-- rastro en correcciones (paso 6).
create function public.limitar_columnas_pm() returns trigger
language plpgsql set search_path = '' as $$
declare
  antes jsonb := to_jsonb(old);
  despues jsonb := to_jsonb(new);
  permitidas text[] := tg_argv || array['actualizado_en'];
  c text;
begin
  if public.rol_actual() is distinct from 'pm' then
    return new;
  end if;
  for c in select jsonb_object_keys(despues) loop
    if antes -> c is distinct from despues -> c and not c = any(permitidas) then
      raise exception 'El PM no puede cambiar %', c using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

create trigger limitar_columnas_pm before update on public.ordenes_trabajo for each row
  execute function public.limitar_columnas_pm('estado', 'confirmada_en', 'se_presento', 'aprobada_en', 'aprobada_por');
create trigger limitar_columnas_pm before update on public.espacios for each row
  execute function public.limitar_columnas_pm('pies2_verificados', 'pies_lineales_verificados', 'verificado_por',
                                              'verificado_en');
-- como en el legacy (EDITABLE): monto, partida, categoría, proveedor, descripción; y anular
create trigger limitar_columnas_pm before update on public.gastos for each row
  execute function public.limitar_columnas_pm('monto', 'partida_obra_id', 'espacio_id', 'categoria', 'proveedor',
                                              'descripcion', 'estado');
create trigger limitar_columnas_pm before update on public.bitacora for each row
  execute function public.limitar_columnas_pm('incidencia', 'estado');
create trigger limitar_columnas_pm before update on public.avance for each row
  execute function public.limitar_columnas_pm('estado_registro');
create trigger limitar_columnas_pm before update on public.mano_obra for each row
  execute function public.limitar_columnas_pm('cantidad', 'partida_obra_id', 'estado');
create trigger limitar_columnas_pm before update on public.pruebas_agua for each row
  execute function public.limitar_columnas_pm('fin', 'resultado');
create trigger limitar_columnas_pm before update on public.punch_list for each row
  execute function public.limitar_columnas_pm('item', 'origen', 'responsable', 'fecha_compromiso', 'estado',
                                              'cerrado_en');

-- La orden de trabajo, además: el PM la confirma y la aprueba a SU nombre, y nunca la regresa (A2).
drop policy "pm confirma y aprueba ordenes de sus obras" on public.ordenes_trabajo;
create policy "pm confirma y aprueba ordenes de sus obras" on public.ordenes_trabajo for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and estado in ('emitida', 'confirmada', 'aprobada'))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and estado in ('emitida', 'confirmada', 'aprobada')
              and (aprobada_por is null or aprobada_por = (select public.miembro_actual())));

create function public.orden_no_regresa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.rol_actual() = 'pm'
     and array_position(array['emitida', 'confirmada', 'aprobada'], new.estado::text)
       < array_position(array['emitida', 'confirmada', 'aprobada'], old.estado::text) then
    raise exception 'El PM no puede regresar una orden de % a %', old.estado, new.estado using errcode = '42501';
  end if;
  return new;
end $$;
create trigger orden_no_regresa before update on public.ordenes_trabajo for each row
  execute function public.orden_no_regresa();

-- Un gasto que el dueño ya revisó, el PM no lo toca (M2).
drop policy "pm corrige sus gastos" on public.gastos;
create policy "pm corrige sus gastos" on public.gastos for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and origen = 'pm' and revision is distinct from 'revisado'
         and creado_por = (select public.miembro_actual()) and obra_id in (select public.obras_del_pm()))
  with check (empresa_id = (select public.empresa_actual()) and origen = 'pm' and revision is distinct from 'revisado'
              and creado_por = (select public.miembro_actual()) and obra_id in (select public.obras_del_pm()));

-- ------------------------------------------------------------------ tablas hijas y fotos del PM (M4, B4)
-- Lo que el PM cuelga de un registro tiene que colgar de algo suyo o visible para él. Las subconsultas corren con
-- su RLS: lo que no puede ver, no existe para él.
drop policy "pm crea en sus obras" on public.bitacora_partidas;
create policy "pm crea en sus obras" on public.bitacora_partidas for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and bitacora_id in (select b.id from public.bitacora b
                                  where b.creado_por = (select public.miembro_actual()) and b.estado = 'vigente'));

drop policy "pm crea en sus obras" on public.bitacora_subs;
create policy "pm crea en sus obras" on public.bitacora_subs for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and bitacora_id in (select b.id from public.bitacora b
                                  where b.creado_por = (select public.miembro_actual()) and b.estado = 'vigente')
              and orden_trabajo_id in (select o.id from public.ordenes_trabajo o));   -- solo las que ve

drop policy "pm crea en sus obras" on public.inspeccion_respuestas;
create policy "pm crea en sus obras" on public.inspeccion_respuestas for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and inspeccion_id in (select i.id from public.inspecciones i
                                    where i.creado_por = (select public.miembro_actual()))
              and punto_control_id in (select p.id from public.puntos_control p
                                       join public.inspecciones i on i.hito_id = p.hito_id
                                       where i.id = inspeccion_id));

drop policy "pm sube fotos a sus obras" on public.fotos;
create policy "pm sube fotos a sus obras" on public.fotos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual())
              and (ref_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch')
                   or (ref_tipo = 'gasto' and ref_id in (select g.id from public.gastos g
                                                         where g.creado_por = (select public.miembro_actual())
                                                           and g.origen = 'pm'))
                   or (ref_tipo = 'aviso' and ref_id in (select a.id from public.avisos a
                                                         where a.creado_por = (select public.miembro_actual())))));

-- validar_foto: no sirve de oráculo (revisa primero la empresa y las obras de la sesión, con un solo mensaje) y
-- falla cerrado si aparece un tipo de foto nuevo sin su regla (B3).
create or replace function public.validar_foto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  existe boolean;
  mensaje constant text := 'La foto no corresponde a un registro de su obra';
begin
  if public.miembro_actual() is not null and not public.importando() and (
       new.empresa_id is distinct from public.empresa_actual()
       or not (public.es_dueno_o_admin() or new.obra_id in (select public.obras_del_pm()))
       or (public.rol_actual() = 'pm' and new.ref_tipo = 'orden_cambio')) then
    raise exception '%', mensaje using errcode = '23514';
  end if;
  if new.storage_path not like new.empresa_id::text || '/' || new.obra_id::text || '/%'
     or new.storage_path like '%..%' then
    raise exception '%: la ruta debe ser empresa/obra/…', mensaje using errcode = '23514';
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
  if existe is not true then
    raise exception '%', mensaje using errcode = '23514';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ la empresa la activa o desactiva el sistema (B7)
create function public.proteger_empresa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.miembro_actual() is not null and new.activa is distinct from old.activa then
    raise exception 'Activar o desactivar la empresa no es una edición del dueño' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_empresa before update on public.empresas for each row
  execute function public.proteger_empresa();

-- ------------------------------------------------------------------ el PIN, solo para el service role (observación)
revoke select on public.dispositivos from servidor_app;
grant select (id, empresa_id, miembro_id, nombre, verificado_en, ultimo_uso, revocado_en, revocado_por, creado_en,
              actualizado_en)
  on public.dispositivos to servidor_app;

-- ------------------------------------------------------------------ las vistas no se escriben (M5)
-- El permiso por defecto de servidor_app también alcanzaba a las vistas nuevas, que son de postgres y por eso se
-- saltan RLS. Ya no hay permisos por defecto para servidor_app: cada migración que cree una tabla le da los suyos.
alter default privileges in schema public revoke all on tables from servidor_app;
revoke insert, update, delete on public.empresa_actual_datos, public.configuracion_pm, public.subcontratistas_pm,
                                  public.entregas_pm, public.ordenes_cambio_pm from servidor_app;

-- ------------------------------------------------------------------ disparadores en las tablas
do $$
declare
  t record;
begin
  for t in select distinct table_name as tabla from information_schema.columns
           where table_schema = 'public' and column_name = 'creado_por'
             and table_name in (select table_name from information_schema.tables
                                where table_schema = 'public' and table_type = 'BASE TABLE') loop
    execute format('create trigger fijar_autor before insert on public.%I
                    for each row execute function public.fijar_autor()', t.tabla);
  end loop;
  -- las tablas sin creado_por igual fijan su creado_en
  for t in select distinct table_name as tabla from information_schema.columns
           where table_schema = 'public' and column_name = 'creado_en'
             and table_name in (select table_name from information_schema.tables
                                where table_schema = 'public' and table_type = 'BASE TABLE')
             and table_name not in (select table_name from information_schema.columns
                                    where table_schema = 'public' and column_name = 'creado_por') loop
    execute format('create trigger fijar_autor before insert on public.%I
                    for each row execute function public.fijar_autor()', t.tabla);
  end loop;
end $$;
