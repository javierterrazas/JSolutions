-- Los miembros se dan de alta con su celular, no con su correo (D-083; lo pidió el dueño). Su cuenta de Auth lleva
-- una dirección interna que sale del número (15125550101@celular.invalid): nadie la ve ni recibe nada. El celular se
-- guarda en miembros.telefono, para verlo en "Managers" y en la plataforma; el correo, si lo dan, en correo_avisos.
-- Las versiones de antes (sin celular) se quedan mientras la app que las usa sigue publicada; se quitan después.

-- Invitar a un PM, con su celular y, si lo dan, su correo.
create function public.invitar_pm(p_user_id uuid, p_nombre text, p_idioma public.idioma, p_token text,
                                  p_expira timestamptz, p_telefono text, p_correo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  nuevo uuid := public.invitar_pm(p_user_id, p_nombre, p_idioma, p_token, p_expira);
begin
  update public.miembros set telefono = p_telefono, correo_avisos = nullif(btrim(p_correo), '')
    where id = nuevo;
  return nuevo;
end $$;

-- El alta de una empresa desde la plataforma, con el celular del dueño y, si lo dan, su correo.
create function public.plataforma_alta_empresa(p_nombre text, p_ciudad text, p_zona text, p_idioma public.idioma,
                                               p_dueno_user uuid, p_dueno_nombre text, p_token text,
                                               p_expira timestamptz, p_plan text, p_precio numeric, p_ciclo text,
                                               p_en_prueba boolean, p_vence_el date, p_telefono text,
                                               p_correo text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  emp uuid := public.plataforma_alta_empresa(p_nombre, p_ciudad, p_zona, p_idioma, p_dueno_user, p_dueno_nombre,
                                             p_token, p_expira, p_plan, p_precio, p_ciclo, p_en_prueba, p_vence_el);
  yo text[] := plataforma.soltar_identidad();
begin
  update public.miembros set telefono = p_telefono, correo_avisos = nullif(btrim(p_correo), '')
    where empresa_id = emp and user_id = p_dueno_user;
  perform plataforma.recuperar_identidad(yo);
  return emp;
end $$;

-- La lista de la plataforma, con el celular del dueño. El correo es el que dio (el de Auth, si es de los de antes;
-- nunca la dirección interna).
drop function public.plataforma_empresas();
create function public.plataforma_empresas()
returns table (id uuid, nombre text, ciudad text, activa boolean, creada_en timestamptz, plan text, precio numeric,
               ciclo text, en_prueba boolean, vence_el date, notas text, estado text, dueno text, correo text,
               telefono text, pms integer, obras_en_curso integer, obras integer, ultimo_uso timestamptz,
               ultimo_pago date, ultimo_monto numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  return query
    select e.id, e.nombre, e.ciudad, e.activa, e.creado_en, coalesce(s.plan, 'basico'), coalesce(s.precio, 0),
           coalesce(s.ciclo, 'mensual'), coalesce(s.en_prueba, false), s.vence_el, s.notas,
           public.estado_suscripcion(e.id),
           d.nombre, d.correo, d.telefono,
           (select count(*)::int from public.miembros m where m.empresa_id = e.id and m.rol = 'pm' and m.activo),
           (select count(*)::int from public.obras o where o.empresa_id = e.id
              and o.estado in ('lista_para_arranque', 'en_obra', 'en_cierre')),
           (select count(*)::int from public.obras o where o.empresa_id = e.id),
           (select max(x.ultimo_uso) from public.dispositivos x where x.empresa_id = e.id),
           p.pagado_el, p.monto
    from public.empresas e
    left join public.suscripciones s on s.empresa_id = e.id
    left join lateral (
      select m.nombre, m.telefono,
             coalesce(m.correo_avisos,
                      case when u.email like '%@celular.invalid' then null else u.email::text end) as correo
      from public.miembros m join auth.users u on u.id = m.user_id
      where m.empresa_id = e.id and m.rol = 'dueno' order by m.activo desc, m.creado_en limit 1) d on true
    left join lateral (
      select x.pagado_el, x.monto from public.pagos_plataforma x where x.empresa_id = e.id
      order by x.pagado_el desc, x.creado_en desc limit 1) p on true
    order by e.nombre;
end $$;

revoke all on function
  public.invitar_pm(uuid, text, public.idioma, text, timestamptz, text, text),
  public.plataforma_alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz, text, numeric, text,
                                 boolean, date, text, text),
  public.plataforma_empresas()
  from public, anon, authenticated, servidor_app;
grant execute on function
  public.invitar_pm(uuid, text, public.idioma, text, timestamptz, text, text),
  public.plataforma_alta_empresa(text, text, text, public.idioma, uuid, text, text, timestamptz, text, numeric, text,
                                 boolean, date, text, text),
  public.plataforma_empresas()
  to servidor_app;
