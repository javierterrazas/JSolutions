-- Los módulos de cada empresa (D-110): quien administra la plataforma le prende o apaga a cada empresa partes de la
-- app (presupuesto y dinero, portal del cliente, órdenes de cambio, subcontratistas, calidad, nómina, indicadores,
-- histórico, desempeño, posventa, marca). La base (obras, cierre del día, gastos, avisos, fotos, bitácora, managers)
-- siempre está. Apagar un módulo no borra nada: sus pantallas se esconden y se cierran, y sus datos se quedan.
-- Las empresas que ya existen quedan con todo prendido.

alter table public.empresas
  add column modulos text[] not null
    default '{dinero,portal,cambios,subcontratistas,calidad,nomina,indicadores,historico,desempeno,posventa,marca}'
    check (modulos <@ '{dinero,portal,cambios,subcontratistas,calidad,nomina,indicadores,historico,desempeno,posventa,marca}'::text[]);

-- el dueño edita su empresa, pero sus módulos solo los cambia quien administra la plataforma (por
-- plataforma_guardar_modulos, que corre como su dueño y no como servidor_app)
create function public.proteger_modulos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.modulos is distinct from old.modulos and current_user = 'servidor_app' then
    raise exception 'solo_plataforma' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger proteger_modulos before update of modulos on public.empresas
  for each row execute function public.proteger_modulos();

-- cada miembro sabe qué módulos tiene su empresa (la sesión los lee aquí)
create or replace view public.empresa_actual_datos with (security_barrier = true) as
  select id, nombre, zona_horaria, idioma, modulos from public.empresas
  where id = (select public.empresa_actual());

-- quien administra la plataforma los lee y los cambia
create function public.plataforma_modulos(p_empresa uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  return (select modulos from public.empresas where id = p_empresa);
end $$;

create function public.plataforma_guardar_modulos(p_empresa uuid, p_modulos text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  update public.empresas set modulos = coalesce(p_modulos, '{}') where id = p_empresa;
  if not found then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;
end $$;

-- el portal del cliente no tiene sesión: el enlace dice si su empresa tiene el módulo
create function public.modulo_del_enlace(p_token text, p_modulo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p_modulo = any(e.modulos)
                   from public.enlace_cliente_vigente(p_token) en
                   join public.empresas e on e.id = en.empresa_id
                   where en.id is not null), false)
$$;

revoke all on function public.plataforma_modulos(uuid), public.plataforma_guardar_modulos(uuid, text[]),
  public.modulo_del_enlace(text, text)
  from public, anon, authenticated, servidor_app;
grant execute on function public.plataforma_modulos(uuid), public.plataforma_guardar_modulos(uuid, text[]),
  public.modulo_del_enlace(text, text)
  to servidor_app;
