-- Paso 5a · El calendario laboral de cada empresa (D-028): qué días de la semana se trabaja y qué feriados se
-- descansan. El legacy contaba solo de lunes a viernes; IJM también trabaja el sábado.

-- ------------------------------------------------------------------ preparar una tabla nueva
-- Lo que toda tabla de negocio necesita y que, desde la segunda revisión del paso 4, ya no llega por omisión:
-- RLS, permisos explícitos (la API lee; el servidor crea y edita; nadie borra) y los disparadores de auditoría.
-- Cada migración que cree una tabla la pasa por aquí; una prueba (pnpm test:rls) falla si alguna queda sin esto.
create function public.preparar_tabla(t regclass) returns void
language plpgsql set search_path = '' as $$
declare
  cols text[] := array(select attname::text from pg_attribute where attrelid = t and attnum > 0 and not attisdropped);
begin
  execute format('alter table %s enable row level security', t);
  execute format('revoke all on %s from anon, authenticated, servidor_app', t);
  execute format('grant select on %s to authenticated', t);
  execute format('grant select, insert, update on %s to servidor_app', t);
  if 'actualizado_en' = any(cols) then
    execute format('create trigger fijar_actualizado_en before update on %s
                    for each row execute function public.fijar_actualizado_en()', t);
  end if;
  if 'creado_por' = any(cols) or 'creado_en' = any(cols) then
    execute format('create trigger fijar_autor before insert on %s for each row execute function public.fijar_autor()', t);
  end if;
  if cols && array['empresa_id', 'obra_id', 'creado_por', 'creado_en', 'folio'] then
    execute format('create trigger proteger_columnas_fijas before update on %s
                    for each row execute function public.proteger_columnas_fijas()', t);
  end if;
end $$;

-- ------------------------------------------------------------------ días laborables
-- ISO 8601: 1 = lunes … 7 = domingo. Por defecto, de lunes a sábado.
alter table public.configuracion
  add column dias_laborables smallint[] not null default '{1,2,3,4,5,6}'
    check (cardinality(dias_laborables) between 1 and 7 and dias_laborables <@ '{1,2,3,4,5,6,7}');

-- ------------------------------------------------------------------ feriados
-- Un feriado se descansa salvo que la empresa decida trabajarlo (se_trabaja). Nada se borra: un feriado que ya no
-- aplica se marca como trabajado.
create table public.feriados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  dia date not null,
  nombre_es text not null check (btrim(nombre_es) <> ''),
  nombre_en text,
  se_trabaja boolean not null default false,
  creado_en timestamptz not null default now(),
  creado_por uuid,
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, dia),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
select public.preparar_tabla('public.feriados');

-- Todo miembro de la empresa lo lee (el PM lo necesita para su semana y sus días sin cierre); el dueño lo edita.
create policy "la empresa lee" on public.feriados for select to authenticated
  using (empresa_id = (select public.empresa_actual()));
create policy "dueno crea" on public.feriados for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno edita" on public.feriados for update to servidor_app
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()))
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

-- El PM necesita los días laborables (configuracion_pm); se rehace la vista con la columna nueva.
create or replace view public.configuracion_pm with (security_barrier = true) as
  select empresa_id, limite_compra_pm, horas_sin_recibo, sla_bloqueo_horas, dias_laborables
  from public.configuracion
  where empresa_id = (select public.empresa_actual());
