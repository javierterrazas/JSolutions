-- El uso de la app (D-101; lo pidió quien administra la plataforma, y solo él lo ve): cuánto la usa cada miembro de
-- cada empresa. Mientras la app está abierta y a la vista, avisa cada minuto (registrar_uso); se guarda un renglón
-- por miembro y día con los minutos y las veces que entró (una vez más cuando pasan 15 minutos sin avisar). Nada de
-- lo que escribe, ni dónde está. Lo que hizo (cierres, gastos, avisos, fotos, cobros) sale de sus propios registros.
-- Además, cuánto tarda el PM en cerrar el día: el teléfono manda cuándo abrió el cierre y cuándo lo terminó.
create table public.uso_app (
  empresa_id uuid not null,
  miembro_id uuid not null,
  dia date not null,
  minutos integer not null default 0 check (minutos >= 0),
  sesiones integer not null default 0 check (sesiones >= 0),
  primer_en timestamptz not null default now(),
  ultimo_en timestamptz not null default now(),
  primary key (miembro_id, dia),
  foreign key (empresa_id, miembro_id) references public.miembros (empresa_id, id)
);
create index on public.uso_app (empresa_id, dia);
-- nadie la lee ni la escribe directo: solo con las funciones de abajo
alter table public.uso_app enable row level security;
create trigger proteger_columnas_fijas before update on public.uso_app
  for each row execute function public.proteger_columnas_fijas();

alter table public.bitacora
  add column segundos_captura integer check (segundos_captura is null or segundos_captura >= 0);

-- Un aviso de que la app está abierta y a la vista. Cuenta a lo más un minuto por minuto (dos pestañas no lo
-- duplican), y una entrada nueva cuando pasaron 15 minutos desde el último aviso. El día es el de la empresa.
create function public.registrar_uso() returns void
language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := public.miembro_actual();
  emp uuid := public.empresa_actual();
  hoy date;
begin
  if yo is null then
    return;
  end if;
  select (now() at time zone e.zona_horaria)::date into hoy from public.empresas e where e.id = emp;
  insert into public.uso_app as u (empresa_id, miembro_id, dia, minutos, sesiones)
    values (emp, yo, hoy, 1, 1)
  on conflict (miembro_id, dia) do update
    set minutos = u.minutos + case when now() - u.ultimo_en >= interval '50 seconds' then 1 else 0 end,
        sesiones = u.sesiones + case when now() - u.ultimo_en > interval '15 minutes' then 1 else 0 end,
        ultimo_en = case when now() - u.ultimo_en >= interval '50 seconds' then now() else u.ultimo_en end;
end $$;

-- El uso de cada miembro de cada empresa desde un día: los días que entró, los minutos, las veces, la última vez, lo
-- que capturó y cuánto tardó en cerrar el día (en promedio). Solo quien administra la plataforma.
create function public.plataforma_uso(p_desde date)
returns table (empresa_id uuid, empresa text, miembro_id uuid, nombre text, rol text, activo boolean, dias integer,
               minutos integer, sesiones integer, ultimo_uso timestamptz, cierres integer, gastos integer,
               avisos integer, fotos integer, cobros integer, segundos_cierre integer)
language plpgsql security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  return query
    select e.id, e.nombre, m.id, m.nombre, m.rol::text, m.activo,
           coalesce(u.dias, 0)::int, coalesce(u.minutos, 0)::int, coalesce(u.sesiones, 0)::int,
           (select max(x.ultimo_en) from public.uso_app x where x.miembro_id = m.id),
           (select count(*)::int from public.bitacora b
            where b.creado_por = m.id and b.estado = 'vigente' and b.creado_en >= p_desde),
           (select count(*)::int from public.gastos g
            where g.creado_por = m.id and g.estado = 'vigente' and g.creado_en >= p_desde),
           (select count(*)::int from public.avisos a where a.creado_por = m.id and a.creado_en >= p_desde),
           (select count(*)::int from public.fotos f where f.creado_por = m.id and f.creado_en >= p_desde),
           (select count(*)::int from public.cobros c
            where c.creado_por = m.id and c.estado = 'vigente' and c.creado_en >= p_desde),
           (select round(avg(b.segundos_captura))::int from public.bitacora b
            where b.creado_por = m.id and b.segundos_captura is not null and b.creado_en >= p_desde)
    from public.miembros m
    join public.empresas e on e.id = m.empresa_id
    left join (select x.miembro_id, count(*) as dias, sum(x.minutos) as minutos, sum(x.sesiones) as sesiones
               from public.uso_app x where x.dia >= p_desde group by x.miembro_id) u on u.miembro_id = m.id
    order by e.nombre, coalesce(u.minutos, 0) desc, m.nombre;
end $$;

revoke all on function public.registrar_uso(), public.plataforma_uso(date)
  from public, anon, authenticated, servidor_app;
grant execute on function public.registrar_uso(), public.plataforma_uso(date) to servidor_app;
