-- Uso de la app (D-101): de cada empresa, cuántas obras ha cerrado (con "Cerrar la obra", D-085), cuántas en el periodo
-- y cuántas lleva en curso, y su ticket promedio: el contrato final de las cerradas y el contrato de las que van en curso
-- (D-111). Solo conteos y promedios, para quien administra la plataforma.
create function public.plataforma_obras_de_empresas(p_desde date)
returns table (empresa_id uuid, cerradas integer, cerradas_periodo integer, en_curso integer,
               ticket_cerradas numeric, ticket_en_curso numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform plataforma.exigir_admin();
  return query
    select e.id,
           (select count(*)::int from public.obras_cerradas c where c.empresa_id = e.id),
           (select count(*)::int from public.obras_cerradas c where c.empresa_id = e.id and c.fecha_fin_real >= p_desde),
           (select count(*)::int from public.obras o where o.empresa_id = e.id and o.estado = 'en_obra'),
           (select round(avg(c.contrato_final), 2) from public.obras_cerradas c where c.empresa_id = e.id),
           (select round(avg(f.contrato_original), 2) from public.obras o
            join public.obras_finanzas f on f.obra_id = o.id
            where o.empresa_id = e.id and o.estado = 'en_obra')
    from public.empresas e;
end $$;

revoke all on function public.plataforma_obras_de_empresas(date) from public, anon, authenticated, servidor_app;
grant execute on function public.plataforma_obras_de_empresas(date) to servidor_app;
