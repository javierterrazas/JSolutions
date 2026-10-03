-- Paso 4 · La muralla financiera y el aislamiento entre empresas.
--
-- Reglas (CLAUDE.md, D-002, D-003, D-017):
--   · toda política filtra por la empresa de la sesión;
--   · las tablas 💲 solo las leen y escriben dueño y administrador;
--   · el PM ve solo las obras que tiene asignadas, mientras no se entreguen;
--   · ninguna política permite borrar: nada se borra;
--   · lo que el PM cambia en tablas que no son suyas (confirmar o aprobar una orden de trabajo, verificar una
--     medida, cerrar una prueba de agua, anular dentro de 48 h) pasa por funciones del servidor (paso 6), no por
--     una política de edición: una política dejaría editar la fila completa.
--
-- Nunca se debilita una política para que pase una prueba.

-- ------------------------------------------------------------------ permisos de las tablas
-- Supabase da por defecto todos los permisos a anon y a authenticated, incluido TRUNCATE, y RLS no aplica a
-- TRUNCATE. anon (sin sesión) no recibe nada; authenticated puede leer, crear y editar, siempre bajo RLS, y nunca
-- borrar ni vaciar una tabla.
revoke all on all tables in schema public from anon;
revoke delete, truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke delete, truncate, references, trigger on tables from authenticated;

-- ------------------------------------------------------------------ apoyo
-- Las obras del PM de la sesión: asignadas, sin entregar. Una sola consulta por sentencia, no una por renglón.
create function public.obras_del_pm() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select o.id from public.obras o
  where o.pm_id = public.miembro_actual() and o.estado <> 'entregada' and public.rol_actual() = 'pm'
$$;
revoke all on function public.obras_del_pm() from public, anon;
grant execute on function public.obras_del_pm() to authenticated, service_role;

-- ------------------------------------------------------------------ empresa y usuarios
create policy "dueno lee su empresa" on public.empresas for select to authenticated
  using (id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno edita su empresa" on public.empresas for update to authenticated
  using (id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()))
  with check (id = (select public.empresa_actual()));

create policy "dueno lee la configuracion" on public.configuracion for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno edita la configuracion" on public.configuracion for update to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()))
  with check (empresa_id = (select public.empresa_actual()));

-- Miembros y dispositivos: el alta, la baja y la revocación son del servidor (paso 6 y fase 2).
create policy "dueno lee los miembros" on public.miembros for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "cada quien lee su miembro" on public.miembros for select to authenticated
  using (id = (select public.miembro_actual()));

create policy "dueno lee los dispositivos" on public.dispositivos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "cada quien lee sus dispositivos" on public.dispositivos for select to authenticated
  using (miembro_id = (select public.miembro_actual()));

-- folios: sin políticas. Solo el servidor numera.

-- ------------------------------------------------------------------ plantillas genéricas
-- La mayoría de las tablas sigue uno de cinco patrones. Se generan aquí para que todas digan exactamente lo
-- mismo; las excepciones van a mano más abajo.
create function pg_temp.rls_solo_dueno(t text, ops text[]) returns void language plpgsql as $$
declare
  op text;
  d text := 'empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin())';
  e text := 'empresa_id = (select public.empresa_actual())';
begin
  foreach op in array ops loop
    if op = 'select' then
      execute format('create policy "dueno lee" on public.%I for select to authenticated using (%s)', t, d);
    elsif op = 'insert' then
      execute format('create policy "dueno crea" on public.%I for insert to authenticated with check (%s)', t, d);
    elsif op = 'update' then
      execute format('create policy "dueno edita" on public.%I for update to authenticated using (%s) with check (%s)',
                     t, d, e);
    end if;
  end loop;
end $$;

-- Catálogo que todo miembro de la empresa lee y solo el dueño edita.
create function pg_temp.rls_catalogo(t text) returns void language plpgsql as $$
begin
  execute format('create policy "la empresa lee" on public.%I for select to authenticated
                  using (empresa_id = (select public.empresa_actual()))', t);
  perform pg_temp.rls_solo_dueno(t, array['insert', 'update']);
end $$;

-- Lo de una obra que el PM lee en sus obras y el dueño lee y escribe.
create function pg_temp.rls_pm_lee(t text) returns void language plpgsql as $$
begin
  perform pg_temp.rls_solo_dueno(t, array['select', 'insert', 'update']);
  execute format('create policy "pm lee sus obras" on public.%I for select to authenticated
                  using (empresa_id = (select public.empresa_actual())
                         and obra_id in (select public.obras_del_pm()))', t);
end $$;

-- Lo que el PM registra en obra: lo lee y lo crea en sus obras, a su nombre. No lo edita: las correcciones del
-- PM (48 h, con motivo) pasan por el servidor.
create function pg_temp.rls_pm_registra(t text, a_su_nombre boolean) returns void language plpgsql as $$
begin
  perform pg_temp.rls_pm_lee(t);
  execute format('create policy "pm crea en sus obras" on public.%I for insert to authenticated
                  with check (empresa_id = (select public.empresa_actual())
                              and obra_id in (select public.obras_del_pm())%s)',
                 t, case when a_su_nombre then ' and creado_por = (select public.miembro_actual())' else '' end);
end $$;

-- ------------------------------------------------------------------ catálogo
select pg_temp.rls_catalogo('tipos_espacio');
select pg_temp.rls_catalogo('oficios');
select pg_temp.rls_catalogo('etapas');
select pg_temp.rls_catalogo('hitos_calidad');
select pg_temp.rls_catalogo('puntos_control');
select pg_temp.rls_catalogo('trabajadores');            -- el PM necesita tipo_pago, nunca la tarifa
select pg_temp.rls_solo_dueno('plantillas_partida', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('subcontratistas', array['select', 'insert', 'update']);   -- el PM: vista
select pg_temp.rls_solo_dueno('metas_indicadores', array['select', 'insert', 'update']);

-- ------------------------------------------------------------------ 💲 la muralla financiera
select pg_temp.rls_solo_dueno('tarifas_trabajador', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('obras_finanzas', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('presupuesto_etapas', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('ordenes_trabajo_precios', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('pagos_sub', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('ordenes_cambio_montos', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('no_calidad', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('cobros', array['select', 'insert', 'update']);
select pg_temp.rls_solo_dueno('obras_cerradas', array['select', 'insert']);
select pg_temp.rls_solo_dueno('historico_etapas', array['select', 'insert']);

-- ------------------------------------------------------------------ obras
create policy "pm lee sus obras" on public.obras for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and id in (select public.obras_del_pm()));
select pg_temp.rls_solo_dueno('obras', array['select', 'insert', 'update']);

select pg_temp.rls_pm_lee('espacios');           -- la medida verificada: función del servidor (D-014)
select pg_temp.rls_pm_lee('partidas_obra');
select pg_temp.rls_solo_dueno('plan_semanal', array['select', 'insert']);
select pg_temp.rls_solo_dueno('historico_duraciones', array['select', 'insert']);
select pg_temp.rls_solo_dueno('entregas', array['select', 'insert', 'update']);         -- el PM: vista

-- ------------------------------------------------------------------ lo que registra el PM
select pg_temp.rls_pm_registra('bitacora', true);
select pg_temp.rls_pm_registra('bitacora_partidas', false);
select pg_temp.rls_pm_registra('bitacora_subs', false);
select pg_temp.rls_pm_registra('avance', true);
select pg_temp.rls_pm_registra('mano_obra', true);
select pg_temp.rls_pm_registra('inspecciones', true);
select pg_temp.rls_pm_registra('inspeccion_respuestas', false);
select pg_temp.rls_pm_registra('pruebas_agua', true);    -- cerrarla (24 h): función del servidor
select pg_temp.rls_pm_registra('fotos', true);

-- El punch list lo escribe el PM en el recorrido con el cliente, y lo cierra.
select pg_temp.rls_pm_registra('punch_list', true);
create policy "pm edita el punch de sus obras" on public.punch_list for update to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()))
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()));

-- Gastos: el PM ve solo los que él registró, nunca las compras de la oficina (aunque sean de su obra).
select pg_temp.rls_solo_dueno('gastos', array['select', 'insert', 'update']);
create policy "pm lee sus gastos" on public.gastos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and origen = 'pm'
         and creado_por = (select public.miembro_actual()) and (select public.rol_actual()) = 'pm');
create policy "pm registra gastos en sus obras" on public.gastos for insert to authenticated
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and origen = 'pm' and creado_por = (select public.miembro_actual()) and revision is null
              and estado = 'vigente');

-- Avisos: el PM ve los que él levantó, con su respuesta. Responderlos es del dueño.
select pg_temp.rls_solo_dueno('avisos', array['select', 'insert', 'update']);
create policy "pm lee sus avisos" on public.avisos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and creado_por = (select public.miembro_actual())
         and (select public.rol_actual()) = 'pm');
create policy "pm levanta avisos en sus obras" on public.avisos for insert to authenticated
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()) and estado = 'abierto' and respuesta is null);

-- Órdenes de trabajo: el PM ve las emitidas, confirmadas y aprobadas de sus obras. Nunca las pagadas ni las
-- canceladas: "pagada" revela pagos (D-017). Confirmar, marcar llegada y aprobar: funciones del servidor.
select pg_temp.rls_solo_dueno('ordenes_trabajo', array['select', 'insert', 'update']);
create policy "pm lee las ordenes vigentes de sus obras" on public.ordenes_trabajo for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and estado in ('emitida', 'confirmada', 'aprobada'));

-- Órdenes de cambio: el PM las lee por la vista ordenes_cambio_pm, sin condición de pago ni fecha de cobro.
select pg_temp.rls_solo_dueno('ordenes_cambio', array['select', 'insert', 'update']);

-- Correcciones: el dueño las lee; cualquiera deja rastro de lo suyo (el servidor las escribe por él).
select pg_temp.rls_solo_dueno('correcciones', array['select']);
create policy "cada quien deja rastro de sus correcciones" on public.correcciones for insert to authenticated
  with check (empresa_id = (select public.empresa_actual()) and creado_por = (select public.miembro_actual()));

-- ------------------------------------------------------------------ vistas para el PM (D-013)
-- Columnas que el PM sí necesita de tablas que no puede leer completas. Las vistas son del dueño de la base
-- (no security_invoker) y por eso cada una filtra por sí misma: la empresa de la sesión y, donde aplica, las
-- obras del PM. Sin sesión, empresa_actual() es nula y no devuelven nada.
create view public.empresa_actual_datos as
  select id, nombre, zona_horaria, idioma from public.empresas
  where id = (select public.empresa_actual());

create view public.configuracion_pm as
  select empresa_id, limite_compra_pm, horas_sin_recibo, sla_bloqueo_horas from public.configuracion
  where empresa_id = (select public.empresa_actual());

create view public.subcontratistas_pm as
  select id, empresa_id, nombre, oficio_id, telefono, activo from public.subcontratistas
  where empresa_id = (select public.empresa_actual());

create view public.entregas_pm as
  select obra_id, empresa_id, fecha_entrega from public.entregas
  where empresa_id = (select public.empresa_actual())
    and (obra_id in (select public.obras_del_pm()) or (select public.es_dueno_o_admin()));

-- Sin estado: "facturada" revela cobros. Para el PM, una orden autorizada o facturada es una orden que ejecutar.
create view public.ordenes_cambio_pm as
  select id, empresa_id, obra_id, folio, descripcion, dias_impacto, autorizada_en from public.ordenes_cambio
  where empresa_id = (select public.empresa_actual())
    and obra_id in (select public.obras_del_pm())
    and estado in ('autorizada', 'facturada');

revoke all on public.empresa_actual_datos, public.configuracion_pm, public.subcontratistas_pm,
              public.entregas_pm, public.ordenes_cambio_pm from public, anon, authenticated;
grant select on public.empresa_actual_datos, public.configuracion_pm, public.subcontratistas_pm,
                public.entregas_pm, public.ordenes_cambio_pm to authenticated;

-- ------------------------------------------------------------------ Storage: las fotos
-- Un bucket privado. La ruta de cada archivo empieza con empresa/obra/… (D-007): con eso deciden las políticas.
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
  on conflict (id) do nothing;

create policy "dueno lee las fotos de su empresa" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (select public.es_dueno_o_admin())
         and (storage.foldername(name))[1] = (select public.empresa_actual())::text);

create policy "pm lee las fotos de sus obras" on storage.objects for select to authenticated
  using (bucket_id = 'fotos'
         and (storage.foldername(name))[1] = (select public.empresa_actual())::text
         and (storage.foldername(name))[2] in (select o::text from public.obras_del_pm() o));

create policy "pm sube fotos a sus obras" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
              and (storage.foldername(name))[1] = (select public.empresa_actual())::text
              and (storage.foldername(name))[2] in (select o::text from public.obras_del_pm() o));

create policy "dueno sube fotos de su empresa" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (select public.es_dueno_o_admin())
              and (storage.foldername(name))[1] = (select public.empresa_actual())::text);
-- Sin políticas de edición ni de borrado: una foto subida no se reemplaza ni se borra.

-- Las plantillas eran solo para esta migración.
drop function pg_temp.rls_pm_registra(text, boolean);
drop function pg_temp.rls_pm_lee(text);
drop function pg_temp.rls_catalogo(text);
drop function pg_temp.rls_solo_dueno(text, text[]);
