-- La bitácora de la obra para el PM (D-105): qué sub llegó cada día cerrado, con su nombre, aunque su orden ya se
-- haya pagado. El PM no lee las órdenes pagadas ni la tabla de subcontratistas (sus papeles); esta vista solo dice el
-- nombre y si llegó, de las obras del PM (o de cualquiera, para el dueño). Sin dinero.
create view public.bitacora_subs_pm with (security_barrier = true) as
  select bs.bitacora_id, bs.obra_id, bs.empresa_id, coalesce(s.nombre, '') as sub, bs.llego
  from public.bitacora_subs bs
  join public.ordenes_trabajo o on o.id = bs.orden_trabajo_id
  left join public.subcontratistas s on s.id = o.subcontratista_id
  where bs.empresa_id = (select public.empresa_actual())
    and (bs.obra_id in (select public.obras_del_pm()) or (select public.es_dueno_o_admin()));

revoke all on public.bitacora_subs_pm from public, anon, authenticated, servidor_app;
grant select on public.bitacora_subs_pm to authenticated;
