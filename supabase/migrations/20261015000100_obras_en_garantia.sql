-- Las obras terminadas del PM, mientras dura su garantía (D-060; lo pidió el dueño): la lista y sus fotos, para una
-- visita de garantía sin abrir muros. Solo lectura y sin dinero.
--
-- El PM deja de ver una obra al entregarse (D-017), y así sigue: RLS no se toca, y nada de lo que escribe puede
-- caer en una obra entregada. Estas funciones contestan solo lo de la lista y del álbum, como mis_gastos_sin_recibo
-- (20261009000100_inicio_pm.sql), con las mismas reglas de fotos que "pm lee las fotos de sus obras": nunca órdenes
-- de cambio ni compras de la oficina, y de los gastos y los avisos solo los suyos.

-- Las obras entregadas del PM de la sesión cuya garantía no ha vencido (hoy, en la zona de su empresa).
create function public.obras_del_pm_en_garantia() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select o.id from public.obras o join public.empresas em on em.id = o.empresa_id
  where o.pm_id = public.miembro_actual() and o.estado = 'entregada' and public.rol_actual() = 'pm'
    and o.empresa_id = public.empresa_actual()
    and exists (select 1 from public.entregas e
                where e.obra_id = o.id and e.garantia_vence >= (now() at time zone em.zona_horaria)::date)
$$;

-- La lista: qué obra, cuándo se entregó contra lo comprometido, hasta cuándo dura la garantía y cuántos días se cerraron.
create function public.mis_obras_en_garantia()
returns table (id uuid, folio text, cliente text, direccion text, inicio date, entrega_comprometida date,
               entregada date, garantia_vence date, dias_cerrados integer)
language sql stable security definer set search_path = '' as $$
  select o.id, o.folio, o.cliente, o.direccion, o.fecha_inicio, o.fecha_fin_estimada, e.fecha_entrega,
         e.garantia_vence,
         (select count(*)::integer from public.bitacora b where b.obra_id = o.id and b.estado = 'vigente')
  from public.obras o
  join lateral (select fecha_entrega, garantia_vence from public.entregas
                where obra_id = o.id order by garantia_vence desc limit 1) e on true
  where o.id in (select public.obras_del_pm_en_garantia())
  order by e.fecha_entrega desc, o.folio
$$;

-- Las fotos que el PM puede ver de una de esas obras.
create function public.fotos_en_garantia(p_obra uuid)
returns setof public.fotos
language sql stable security definer set search_path = '' as $$
  select f.* from public.fotos f
  where f.obra_id = p_obra and p_obra in (select public.obras_del_pm_en_garantia())
    and (f.ref_tipo in ('bitacora', 'inspeccion', 'prueba_agua', 'punch')
         or (f.ref_tipo = 'gasto' and f.ref_id in (select g.id from public.gastos g
                                                   where g.creado_por = public.miembro_actual() and g.origen = 'pm'))
         or (f.ref_tipo = 'aviso' and f.ref_id in (select a.id from public.avisos a
                                                   where a.creado_por = public.miembro_actual())))
$$;

-- El álbum de una de esas obras, como el de album.ts: las fotos agrupadas por su registro, lo más nuevo primero, con
-- lo que identifica a cada registro.
create function public.album_en_garantia(p_obra uuid, p_limite integer, p_desde integer)
returns table (ref_tipo public.tipo_foto, ref_id uuid, ultima timestamptz, fotos uuid[], dia date, folio text,
               titulo_es text, titulo_en text, detalle text, resultado text)
language sql stable security definer set search_path = '' as $$
  with g as (
    select f.ref_tipo, f.ref_id, max(f.creado_en) as ultima, array_agg(f.id order by f.indice) as fotos
    from public.fotos_en_garantia(p_obra) f
    group by f.ref_tipo, f.ref_id
  )
  select g.ref_tipo, g.ref_id, g.ultima, g.fotos,
         coalesce(b.dia, ga.dia),
         coalesce(b.folio, h.clave, pl.folio, ga.folio, a.folio),
         h.nombre_es, h.nombre_en,
         coalesce(b.incidencia, ei.nombre, ep.nombre, pl.item, ga.proveedor, a.descripcion),
         coalesce(b.estado::text, i.resultado::text, pa.resultado::text, a.tipo::text)
  from g
  left join public.bitacora b on g.ref_tipo = 'bitacora' and b.id = g.ref_id
  left join public.inspecciones i on g.ref_tipo = 'inspeccion' and i.id = g.ref_id
  left join public.hitos_calidad h on h.id = i.hito_id
  left join public.espacios ei on ei.id = i.espacio_id
  left join public.pruebas_agua pa on g.ref_tipo = 'prueba_agua' and pa.id = g.ref_id
  left join public.espacios ep on ep.id = pa.espacio_id
  left join public.punch_list pl on g.ref_tipo = 'punch' and pl.id = g.ref_id
  left join public.gastos ga on g.ref_tipo = 'gasto' and ga.id = g.ref_id
  left join public.avisos a on g.ref_tipo = 'aviso' and a.id = g.ref_id
  order by g.ultima desc
  limit p_limite offset p_desde
$$;

revoke all on function public.obras_del_pm_en_garantia(), public.mis_obras_en_garantia(),
  public.fotos_en_garantia(uuid), public.album_en_garantia(uuid, integer, integer)
  from public, anon, authenticated, servidor_app;
grant execute on function public.obras_del_pm_en_garantia(), public.mis_obras_en_garantia(),
  public.fotos_en_garantia(uuid), public.album_en_garantia(uuid, integer, integer) to servidor_app;
