-- Las órdenes de cambio ya hechas (D-081; lo pidió el dueño): el PM marca en su inicio que ya ejecutó una orden que
-- el cliente aprobó, con una nota y una foto si quiere. El dueño lo ve en las órdenes de cambio de la obra y el
-- cliente en su portal, con la foto. Una vez por orden; no se edita.
create table public.cambios_hechos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  obra_id uuid not null,
  orden_cambio_id uuid not null unique,
  nota text check (nota is null or length(nota) <= 500),
  creado_por uuid,
  creado_en timestamptz not null default now(),
  unique (obra_id, id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  foreign key (obra_id, orden_cambio_id) references public.ordenes_cambio (obra_id, id),
  foreign key (empresa_id, creado_por) references public.miembros (empresa_id, id)
);
select public.preparar_tabla('public.cambios_hechos');

-- El dueño la lee y la registra; el PM, en sus obras y a su nombre.
create policy "dueno lee" on public.cambios_hechos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "dueno registra" on public.cambios_hechos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and (select public.es_dueno_o_admin()));
create policy "pm lee sus obras" on public.cambios_hechos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm()));
create policy "pm registra en sus obras" on public.cambios_hechos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual()));

-- Solo se marca hecha una orden que el cliente aprobó (autorizada, o ya facturada). El PM no lee ordenes_cambio:
-- lo revisa la base.
create function public.validar_cambio_hecho() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.ordenes_cambio oc
                 where oc.id = new.orden_cambio_id and oc.obra_id = new.obra_id
                   and oc.estado in ('autorizada', 'facturada')) then
    raise exception 'cambio_no_autorizado';
  end if;
  return new;
end $$;
create trigger validar_cambio_hecho before insert on public.cambios_hechos
  for each row execute function public.validar_cambio_hecho();
revoke all on function public.validar_cambio_hecho() from public, anon, authenticated, servidor_app;

-- ------------------------------------------------------------------ sus fotos
-- La de 20261004000200_endurecer.sql, con las fotos de un cambio hecho.
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
    when 'cambio_hecho' then exists (select 1 from public.cambios_hechos r where r.id = new.ref_id and r.obra_id = new.obra_id)
  end;
  if existe is not true then
    raise exception '%', mensaje using errcode = '23514';
  end if;
  return new;
end $$;

-- El PM ve también las fotos de los cambios hechos de sus obras.
drop policy "pm lee las fotos de sus obras" on public.fotos;
create policy "pm lee las fotos de sus obras" on public.fotos for select to authenticated
  using (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
         and (ref_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch', 'cambio_hecho')
              or (ref_tipo = 'gasto' and ref_id in (select g.id from public.gastos g
                                                    where g.creado_por = (select public.miembro_actual())
                                                      and g.origen = 'pm'))
              or (ref_tipo = 'aviso' and ref_id in (select a.id from public.avisos a
                                                    where a.creado_por = (select public.miembro_actual())))));

-- Y las sube, a los cambios que él marcó (la de 20261004000200_endurecer.sql, con cambio_hecho).
drop policy "pm sube fotos a sus obras" on public.fotos;
create policy "pm sube fotos a sus obras" on public.fotos for insert to servidor_app
  with check (empresa_id = (select public.empresa_actual()) and obra_id in (select public.obras_del_pm())
              and creado_por = (select public.miembro_actual())
              and (ref_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch')
                   or (ref_tipo = 'gasto' and ref_id in (select g.id from public.gastos g
                                                         where g.creado_por = (select public.miembro_actual())
                                                           and g.origen = 'pm'))
                   or (ref_tipo = 'aviso' and ref_id in (select a.id from public.avisos a
                                                         where a.creado_por = (select public.miembro_actual())))
                   or (ref_tipo = 'cambio_hecho' and ref_id in (select h.id from public.cambios_hechos h
                                                                where h.creado_por = (select public.miembro_actual())))));

-- Las fotos de un cambio hecho son para el cliente: nacen marcadas y se ven en su portal.
create or replace function public.foto_para_cliente_permitida(p_tipo public.tipo_foto) returns boolean
language sql immutable set search_path = '' as $$
  select p_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch', 'cambio_hecho')
$$;

create function public.marcar_foto_de_cambio_hecho() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ref_tipo = 'cambio_hecho' then
    new.para_cliente := true;
  end if;
  return new;
end $$;
create trigger marcar_foto_de_cambio_hecho before insert on public.fotos
  for each row execute function public.marcar_foto_de_cambio_hecho();

-- ------------------------------------------------------------------ en el portal del cliente
-- Cada orden lleva, si ya se hizo, cuándo y sus fotos.
create or replace function public.cambios_portal_cliente(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'contrato', (select f.contrato_original from public.obras_finanzas f where f.obra_id = en.obra_id),
    'ordenes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', oc.id, 'folio', oc.folio, 'motivo', oc.motivo, 'descripcion', oc.descripcion,
               'dias', oc.dias_impacto, 'condicion', oc.condicion_pago, 'estado', oc.estado,
               'emitida', oc.emitida_en, 'precio', m.precio_cliente,
               'respuesta', (select jsonb_build_object('decision', r.decision, 'nombre', r.nombre,
                                                       'cuando', r.creado_en, 'comentario', r.comentario)
                             from public.respuestas_cambio r where r.orden_cambio_id = oc.id),
               'hecho', (select jsonb_build_object(
                                  'cuando', h.creado_en,
                                  'fotos', coalesce((select jsonb_agg(f.id order by f.indice) from public.fotos f
                                                     where f.ref_tipo = 'cambio_hecho' and f.ref_id = h.id
                                                       and f.para_cliente), '[]'))
                         from public.cambios_hechos h where h.orden_cambio_id = oc.id))
             order by oc.emitida_en desc)
      from public.ordenes_cambio oc join public.ordenes_cambio_montos m on m.orden_cambio_id = oc.id
      where oc.obra_id = en.obra_id), '[]'))
  from public.enlace_cliente_vigente(p_token) en
  where en.id is not null
$$;
