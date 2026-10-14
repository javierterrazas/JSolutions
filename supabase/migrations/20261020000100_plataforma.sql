-- La plataforma (D-080; lo pidió quien la desarrolla): las suscripciones de las empresas, sus pagos y quien administra
-- la plataforma. Quien la administra ve de cada empresa su plan, su precio, su vencimiento, sus pagos y cuánto la
-- usa (cuántos PMs y obras, cuándo entró alguien), pero NO sus obras, sus clientes ni su dinero: todo lo suyo pasa
-- por funciones de la base que devuelven solo eso.
--
-- El vencimiento: 7 días antes se avisa al dueño; al vencer hay 7 días de gracia en los que todo sigue igual; después
-- la empresa queda en SOLO LECTURA (ve y descarga todo, no guarda nada). Suspendida (empresas.activa = false) nadie
-- entra. Nada se borra.

-- ------------------------------------------------------------------ quien administra la plataforma
-- No es de ninguna empresa, así que vive fuera de public. Nadie lo lee ni lo escribe desde la app: se da de alta con
-- packages/servidor/scripts/admin-plataforma.ts, conectado directo a la base.
create schema plataforma;
revoke all on schema plataforma from public;

create table plataforma.administradores (
  user_id uuid primary key references auth.users (id),
  creado_en timestamptz not null default now()
);
revoke all on plataforma.administradores from public;

create function public.es_admin_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from plataforma.administradores where user_id = auth.uid())
$$;

-- ------------------------------------------------------------------ la suscripción de cada empresa
create table public.suscripciones (
  empresa_id uuid primary key references public.empresas (id),
  plan text not null default 'basico' check (plan in ('basico', 'pro', 'empresa')),
  -- lo que paga por ciclo; el precio puede ser especial (de fundador)
  precio numeric(12, 2) not null default 0 check (precio >= 0),
  ciclo text not null default 'mensual' check (ciclo in ('mensual', 'anual')),
  en_prueba boolean not null default false,
  -- el último día pagado; sin fecha, no vence
  vence_el date,
  notas text check (notas is null or length(notas) <= 500),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
select public.preparar_tabla('public.suscripciones');

-- Lo que la empresa le paga a la plataforma: a mano (Zelle, transferencia, efectivo) hasta que llegue Stripe.
create table public.pagos_plataforma (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  monto numeric(12, 2) not null check (monto > 0),
  pagado_el date not null,
  metodo text not null check (metodo in ('zelle', 'transferencia', 'efectivo', 'tarjeta', 'otro')),
  referencia text check (referencia is null or length(referencia) <= 120),
  -- el vencimiento antes y después del pago: el pago extiende la suscripción
  vencia_el date,
  vence_el date not null,
  -- quien administra la plataforma (un usuario de Auth, no un miembro de la empresa)
  registrado_por uuid references auth.users (id),
  creado_en timestamptz not null default now()
);
select public.preparar_tabla('public.pagos_plataforma');
create index on public.pagos_plataforma (empresa_id, pagado_el);

-- El dueño ve la suscripción y los pagos de su empresa; nadie de la app los escribe (solo las funciones de abajo).
create policy "dueno lee" on public.suscripciones for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno lee" on public.pagos_plataforma for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));

-- Las empresas que ya existen no vencen hasta que se les ponga fecha.
insert into public.suscripciones (empresa_id) select id from public.empresas on conflict do nothing;

-- ------------------------------------------------------------------ el estado de una suscripción
-- Días de aviso antes de vencer y días de gracia después.
create function public.estado_suscripcion(p_empresa uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not e.activa then 'suspendida'
    when s.vence_el is null then 'activa'
    when hoy > s.vence_el + 7 then 'solo_lectura'
    when hoy > s.vence_el then 'gracia'
    when hoy > s.vence_el - 7 then 'por_vencer'
    when s.en_prueba then 'prueba'
    else 'activa'
  end
  from public.empresas e
  left join public.suscripciones s on s.empresa_id = e.id
  cross join lateral (select (now() at time zone e.zona_horaria)::date as hoy) h
  where e.id = p_empresa
$$;

-- La suscripción de la empresa de la sesión, para los avisos de su inicio: su estado y su vencimiento (no es dinero).
create function public.mi_suscripcion()
returns table (estado text, vence_el date, en_prueba boolean)
language sql stable security definer set search_path = '' as $$
  select public.estado_suscripcion(e.id), s.vence_el, coalesce(s.en_prueba, false)
  from public.empresas e left join public.suscripciones s on s.empresa_id = e.id
  where e.id = public.empresa_actual()
$$;

-- El nombre de la empresa suspendida del usuario de la sesión, para decirle por qué no entra. Null si no lo es.
create function public.mi_empresa_suspendida() returns text
language sql stable security definer set search_path = '' as $$
  select e.nombre from public.miembros m join public.empresas e on e.id = m.empresa_id
  where m.user_id = auth.uid() and m.activo and not e.activa
$$;

-- ------------------------------------------------------------------ solo lectura
-- Vencida la gracia, la empresa no guarda nada. Lo revisa un trigger por sentencia en cada tabla de la empresa,
-- solo para lo que escribe el servidor a nombre de un miembro (servidor_app): las funciones de la base (entrar con
-- el PIN, el portal del cliente, la plataforma) corren como su dueño y no se detienen.
create function public.exigir_suscripcion_vigente() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'servidor_app'
     and public.estado_suscripcion(public.empresa_actual()) = 'solo_lectura' then
    raise exception 'suscripcion_vencida';
  end if;
  return null;
end $$;

create function public.proteger_con_suscripcion(t regclass) returns void
language plpgsql set search_path = '' as $$
begin
  execute format('create trigger exigir_suscripcion_vigente before insert or update or delete on %s
                  for each statement execute function public.exigir_suscripcion_vigente()', t);
end $$;

do $$
declare
  t record;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'empresa_id' and x.table_type = 'BASE TABLE'
      and c.table_name not in ('suscripciones', 'pagos_plataforma')
  loop
    perform public.proteger_con_suscripcion(('public.' || t.table_name)::regclass);
  end loop;
end $$;

-- Las tablas nuevas de la empresa nacen protegidas.
create or replace function public.preparar_tabla(t regclass) returns void
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
  if 'empresa_id' = any(cols) then
    perform public.proteger_con_suscripcion(t);
  end if;
end $$;

-- ------------------------------------------------------------------ lo que hace quien administra la plataforma
create function plataforma.exigir_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_admin_plataforma() then
    raise exception 'solo_plataforma';
  end if;
end $$;

-- Quien administra la plataforma puede ser también miembro de una empresa (el dueño de IJM). Lo que hace en OTRA
-- empresa no lleva su identidad: los triggers que ponen el autor (fijar_autor) o que no dejan al dueño activar su
-- empresa (proteger_empresa) lo verían como miembro. Se suelta la identidad mientras tanto y se recupera al final;
-- si algo falla, la transacción revierte también esto.
create function plataforma.soltar_identidad() returns text[]
language plpgsql set search_path = '' as $$
declare
  antes text[] := array[current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)];
begin
  perform set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
  return antes;
end $$;

create function plataforma.recuperar_identidad(p text[]) returns void
language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p[1], ''), true),
          set_config('request.jwt.claims', coalesce(p[2], ''), true);
end $$;

-- Las empresas, con su suscripción y cuánto la usan. Sin nada de sus obras ni de su dinero.
create function public.plataforma_empresas()
returns table (id uuid, nombre text, ciudad text, activa boolean, creada_en timestamptz, plan text, precio numeric,
               ciclo text, en_prueba boolean, vence_el date, notas text, estado text, dueno text, correo text,
               pms integer, obras_en_curso integer, obras integer, ultimo_uso timestamptz, ultimo_pago date,
               ultimo_monto numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  return query
    select e.id, e.nombre, e.ciudad, e.activa, e.creado_en, coalesce(s.plan, 'basico'), coalesce(s.precio, 0),
           coalesce(s.ciclo, 'mensual'), coalesce(s.en_prueba, false), s.vence_el, s.notas,
           public.estado_suscripcion(e.id),
           d.nombre, d.correo::text,
           (select count(*)::int from public.miembros m where m.empresa_id = e.id and m.rol = 'pm' and m.activo),
           (select count(*)::int from public.obras o where o.empresa_id = e.id
              and o.estado in ('lista_para_arranque', 'en_obra', 'en_cierre')),
           (select count(*)::int from public.obras o where o.empresa_id = e.id),
           (select max(x.ultimo_uso) from public.dispositivos x where x.empresa_id = e.id),
           p.pagado_el, p.monto
    from public.empresas e
    left join public.suscripciones s on s.empresa_id = e.id
    left join lateral (
      select m.nombre, u.email as correo from public.miembros m join auth.users u on u.id = m.user_id
      where m.empresa_id = e.id and m.rol = 'dueno' order by m.activo desc, m.creado_en limit 1) d on true
    left join lateral (
      select x.pagado_el, x.monto from public.pagos_plataforma x where x.empresa_id = e.id
      order by x.pagado_el desc, x.creado_en desc limit 1) p on true
    order by e.nombre;
end $$;

create function public.plataforma_pagos(p_empresa uuid)
returns table (id uuid, monto numeric, pagado_el date, metodo text, referencia text, vencia_el date, vence_el date,
               creado_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  return query
    select x.id, x.monto, x.pagado_el, x.metodo, x.referencia, x.vencia_el, x.vence_el, x.creado_en
    from public.pagos_plataforma x where x.empresa_id = p_empresa
    order by x.pagado_el desc, x.creado_en desc;
end $$;

create function public.plataforma_guardar_suscripcion(p_empresa uuid, p_plan text, p_precio numeric, p_ciclo text,
                                                      p_en_prueba boolean, p_vence_el date, p_notas text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  if not exists (select 1 from public.empresas where id = p_empresa) then
    raise exception 'empresa_no_encontrada';
  end if;
  insert into public.suscripciones (empresa_id, plan, precio, ciclo, en_prueba, vence_el, notas)
    values (p_empresa, p_plan, p_precio, p_ciclo, p_en_prueba, p_vence_el, nullif(btrim(p_notas), ''))
  on conflict (empresa_id) do update
    set plan = excluded.plan, precio = excluded.precio, ciclo = excluded.ciclo, en_prueba = excluded.en_prueba,
        vence_el = excluded.vence_el, notas = excluded.notas;
end $$;

-- Un pago: queda anotado y la suscripción vence en la fecha que cubre. Deja de estar a prueba.
create function public.plataforma_registrar_pago(p_empresa uuid, p_monto numeric, p_pagado_el date, p_metodo text,
                                                 p_referencia text, p_vence_el date)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  antes date;
  nuevo uuid;
begin
  perform plataforma.exigir_admin();
  if not exists (select 1 from public.empresas where id = p_empresa) then
    raise exception 'empresa_no_encontrada';
  end if;
  insert into public.suscripciones (empresa_id) values (p_empresa) on conflict do nothing;
  select vence_el into antes from public.suscripciones where empresa_id = p_empresa for update;
  insert into public.pagos_plataforma (empresa_id, monto, pagado_el, metodo, referencia, vencia_el, vence_el,
                                       registrado_por)
    values (p_empresa, p_monto, p_pagado_el, p_metodo, nullif(btrim(p_referencia), ''), antes, p_vence_el,
            auth.uid())
    returning id into nuevo;
  update public.suscripciones set vence_el = p_vence_el, en_prueba = false where empresa_id = p_empresa;
  return nuevo;
end $$;

-- Suspender (nadie entra) o reactivar una empresa.
create function public.plataforma_cambiar_activa(p_empresa uuid, p_activa boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  yo text[];
begin
  perform plataforma.exigir_admin();
  yo := plataforma.soltar_identidad();
  update public.empresas set activa = p_activa where id = p_empresa;
  if not found then
    raise exception 'empresa_no_encontrada';
  end if;
  perform plataforma.recuperar_identidad(yo);
end $$;

-- El alta de una empresa con su dueño y su suscripción, desde la pantalla (antes, el script alta-empresa.mjs). El
-- usuario de Auth del dueño lo crea el servidor con la llave secreta.
create function public.plataforma_alta_empresa(p_nombre text, p_ciudad text, p_zona text, p_idioma public.idioma,
                                               p_dueno_user uuid, p_dueno_nombre text, p_token text,
                                               p_expira timestamptz, p_plan text, p_precio numeric, p_ciclo text,
                                               p_en_prueba boolean, p_vence_el date)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  emp uuid;
  yo text[];
begin
  perform plataforma.exigir_admin();
  -- un usuario, una empresa (D-016)
  if exists (select 1 from public.miembros where user_id = p_dueno_user) then
    raise exception 'correo_ya_registrado';
  end if;
  yo := plataforma.soltar_identidad();
  emp := public.alta_empresa(p_nombre, p_ciudad, p_zona, p_idioma, p_dueno_user, p_dueno_nombre, p_token, p_expira);
  insert into public.marcas_empresa (empresa_id) values (emp) on conflict do nothing;
  insert into public.suscripciones (empresa_id, plan, precio, ciclo, en_prueba, vence_el)
    values (emp, p_plan, p_precio, p_ciclo, p_en_prueba, p_vence_el);
  perform plataforma.recuperar_identidad(yo);
  return emp;
end $$;

-- Otra invitación para el dueño de una empresa (antes, el script invitar-de-nuevo.ts). Anula las que no usó.
create function public.plataforma_reinvitar_dueno(p_empresa uuid, p_token text, p_expira timestamptz)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  m public.miembros;
  yo text[];
begin
  perform plataforma.exigir_admin();
  select * into m from public.miembros
    where empresa_id = p_empresa and rol = 'dueno' and activo order by creado_en limit 1;
  if m.id is null then
    raise exception 'sin_dueno';
  end if;
  yo := plataforma.soltar_identidad();
  update public.invitaciones set anulada_en = now()
    where miembro_id = m.id and usada_en is null and anulada_en is null;
  insert into public.invitaciones (empresa_id, miembro_id, token_hash, expira_en)
    values (p_empresa, m.id, public.hash_secreto(p_token), p_expira);
  perform plataforma.recuperar_identidad(yo);
  return m.nombre;
end $$;

-- ------------------------------------------------------------------ quién ejecuta qué
revoke all on function public.es_admin_plataforma(), public.estado_suscripcion(uuid), public.mi_suscripcion(),
  public.mi_empresa_suspendida(), public.exigir_suscripcion_vigente(), public.proteger_con_suscripcion(regclass),
  plataforma.exigir_admin(), plataforma.soltar_identidad(), plataforma.recuperar_identidad(text[]),
  public.plataforma_empresas(), public.plataforma_pagos(uuid),
  public.plataforma_guardar_suscripcion(uuid, text, numeric, text, boolean, date, text),
  public.plataforma_registrar_pago(uuid, numeric, date, text, text, date),
  public.plataforma_cambiar_activa(uuid, boolean),
  public.plataforma_alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz, text, numeric, text,
                                 boolean, date),
  public.plataforma_reinvitar_dueno(uuid, text, timestamptz)
  from public, anon, authenticated, servidor_app;

-- el trigger corre como quien escribe (servidor_app): necesita leer el estado
grant execute on function public.estado_suscripcion(uuid) to servidor_app;
grant execute on function public.es_admin_plataforma(), public.mi_suscripcion(), public.mi_empresa_suspendida(),
  public.plataforma_empresas(), public.plataforma_pagos(uuid),
  public.plataforma_guardar_suscripcion(uuid, text, numeric, text, boolean, date, text),
  public.plataforma_registrar_pago(uuid, numeric, date, text, text, date),
  public.plataforma_cambiar_activa(uuid, boolean),
  public.plataforma_alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz, text, numeric, text,
                                 boolean, date),
  public.plataforma_reinvitar_dueno(uuid, text, timestamptz)
  to servidor_app;
