-- El asistente (D-114): el dueño conecta su asistente de IA (Claude, por MCP) a los datos de su empresa para
-- preguntarle cosas ("¿en qué meses vendemos más?", "¿en qué etapa nos pasamos del presupuesto?"). Solo lectura,
-- solo su empresa, con la identidad del dueño: el asistente ve lo mismo que él en la app (RLS). Es un módulo nuevo
-- ('asistente'), apagado hasta que quien administra la plataforma lo prende.
--
-- El dueño crea una llave en Mi empresa; la app le da un enlace con la llave adentro para pegarlo en su asistente.
-- Aquí solo se guarda su huella (hash_secreto): la llave no se puede volver a ver. Se quita cuando quiera y deja de
-- servir al instante. Cada consulta queda anotada, con un límite por minuto.

alter table public.empresas drop constraint empresas_modulos_check;
alter table public.empresas add constraint empresas_modulos_check
  check (modulos <@ '{dinero,portal,cambios,subcontratistas,calidad,nomina,indicadores,historico,desempeno,posventa,marca,asistente}'::text[]);

create table public.llaves_asistente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  miembro_id uuid not null,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  llave_hash text not null unique,
  -- el principio de la llave, para reconocerla en la lista
  inicio text not null,
  creada_en timestamptz not null default now(),
  ultimo_uso timestamptz,
  quitada_en timestamptz,
  foreign key (empresa_id, miembro_id) references public.miembros (empresa_id, id)
);
create index on public.llaves_asistente (empresa_id);

create table public.consultas_asistente (
  id bigint generated always as identity primary key,
  empresa_id uuid not null,
  llave_id uuid not null references public.llaves_asistente (id),
  herramienta text not null,
  argumentos jsonb not null default '{}',
  ok boolean not null,
  milisegundos integer not null default 0,
  en timestamptz not null default now()
);
create index on public.consultas_asistente (llave_id, en desc);
create index on public.consultas_asistente (empresa_id, en desc);

-- nadie las lee ni las escribe directo: solo con las funciones de abajo
alter table public.llaves_asistente enable row level security;
alter table public.consultas_asistente enable row level security;
create trigger proteger_columnas_fijas before update on public.llaves_asistente
  for each row execute function public.proteger_columnas_fijas();
create trigger proteger_columnas_fijas before update on public.consultas_asistente
  for each row execute function public.proteger_columnas_fijas();

-- solo el dueño, y solo si su empresa tiene el módulo
create function public.exigir_dueno_con_asistente() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.rol_actual() is distinct from 'dueno' then
    raise exception 'solo_el_dueno' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.empresas where id = public.empresa_actual() and 'asistente' = any(modulos)) then
    raise exception 'modulo_no_incluido' using errcode = 'P0001';
  end if;
end $$;

create function public.crear_llave_asistente(p_nombre text, p_llave text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  nueva uuid;
begin
  perform public.exigir_dueno_con_asistente();
  if (select count(*) from public.llaves_asistente
      where empresa_id = public.empresa_actual() and quitada_en is null) >= 10 then
    raise exception 'demasiadas_llaves' using errcode = 'P0001';
  end if;
  insert into public.llaves_asistente (empresa_id, miembro_id, nombre, llave_hash, inicio)
    values (public.empresa_actual(), public.miembro_actual(), btrim(p_nombre), public.hash_secreto(p_llave),
            left(p_llave, 8))
    returning id into nueva;
  return nueva;
end $$;

create function public.quitar_llave_asistente(p_llave uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.rol_actual() is distinct from 'dueno' then
    raise exception 'solo_el_dueno' using errcode = 'P0001';
  end if;
  update public.llaves_asistente set quitada_en = now()
    where id = p_llave and empresa_id = public.empresa_actual() and quitada_en is null;
  if not found then
    raise exception 'llave_invalida' using errcode = 'P0001';
  end if;
end $$;

-- las llaves de la empresa (las quitadas también, para ver su historial) y cuántas consultas lleva cada una
create function public.llaves_asistente_de_la_empresa()
returns table (id uuid, nombre text, inicio text, creada_en timestamptz, ultimo_uso timestamptz,
               quitada_en timestamptz, consultas integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.rol_actual() is distinct from 'dueno' then
    raise exception 'solo_el_dueno' using errcode = 'P0001';
  end if;
  return query
    select l.id, l.nombre, l.inicio, l.creada_en, l.ultimo_uso, l.quitada_en,
           (select count(*)::int from public.consultas_asistente c where c.llave_id = l.id)
    from public.llaves_asistente l
    where l.empresa_id = public.empresa_actual()
    order by l.quitada_en is not null, l.creada_en desc;
end $$;

-- las últimas consultas del asistente en la empresa
create function public.consultas_asistente_de_la_empresa(p_limite integer)
returns table (llave text, herramienta text, argumentos jsonb, ok boolean, en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.rol_actual() is distinct from 'dueno' then
    raise exception 'solo_el_dueno' using errcode = 'P0001';
  end if;
  return query
    select l.nombre, c.herramienta, c.argumentos, c.ok, c.en
    from public.consultas_asistente c join public.llaves_asistente l on l.id = c.llave_id
    where c.empresa_id = public.empresa_actual()
    order by c.en desc
    limit least(greatest(p_limite, 1), 200);
end $$;

-- De una llave, a nombre de quién se consulta. Corre sin sesión (el asistente no tiene una): la llave es la prueba.
-- Nada si la llave no existe o se quitó, si quien la creó ya no es el dueño activo, si la empresa está dada de baja o
-- ya no tiene el módulo. Más de 60 consultas en un minuto: demasiadas_consultas.
create function public.usuario_de_llave_asistente(p_llave text)
returns table (user_id uuid, llave_id uuid, empresa_id uuid, idioma text)
language plpgsql security definer set search_path = '' as $$
declare
  l public.llaves_asistente;
begin
  select x.* into l from public.llaves_asistente x
    join public.miembros m on m.id = x.miembro_id
    join public.empresas e on e.id = x.empresa_id
    where x.llave_hash = public.hash_secreto(p_llave) and x.quitada_en is null
      and m.activo and m.rol = 'dueno' and e.activa and 'asistente' = any(e.modulos);
  if l.id is null then
    return;
  end if;
  if (select count(*) from public.consultas_asistente c
      where c.llave_id = l.id and c.en > now() - interval '1 minute') >= 60 then
    raise exception 'demasiadas_consultas' using errcode = 'P0001';
  end if;
  if l.ultimo_uso is null or l.ultimo_uso < now() - interval '1 minute' then
    update public.llaves_asistente set ultimo_uso = now() where id = l.id;
  end if;
  return query
    select m.user_id, l.id, l.empresa_id, m.idioma::text from public.miembros m where m.id = l.miembro_id;
end $$;

-- Anotar una consulta del asistente. También sin sesión: así se anota aunque la consulta haya fallado.
create function public.anotar_consulta_asistente(p_llave uuid, p_herramienta text, p_argumentos jsonb, p_ok boolean,
                                                 p_milisegundos integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.consultas_asistente (empresa_id, llave_id, herramienta, argumentos, ok, milisegundos)
    select l.empresa_id, l.id, left(p_herramienta, 60), coalesce(p_argumentos, '{}'), p_ok,
           greatest(coalesce(p_milisegundos, 0), 0)
    from public.llaves_asistente l where l.id = p_llave
$$;

revoke all on function public.exigir_dueno_con_asistente(), public.crear_llave_asistente(text, text),
  public.quitar_llave_asistente(uuid), public.llaves_asistente_de_la_empresa(),
  public.consultas_asistente_de_la_empresa(integer), public.usuario_de_llave_asistente(text),
  public.anotar_consulta_asistente(uuid, text, jsonb, boolean, integer)
  from public, anon, authenticated, servidor_app;
grant execute on function public.crear_llave_asistente(text, text), public.quitar_llave_asistente(uuid),
  public.llaves_asistente_de_la_empresa(), public.consultas_asistente_de_la_empresa(integer),
  public.usuario_de_llave_asistente(text), public.anotar_consulta_asistente(uuid, text, jsonb, boolean, integer)
  to servidor_app;
