-- Los pagos del cliente en su portal (D-071): lo que la empresa le ha cobrado, para que vea cuánto lleva pagado y su
-- saldo. Solo los cobros vigentes de la obra del enlace: fecha, concepto y monto (sin el método ni la referencia).
-- Null si el enlace no sirve. Los cobros los registra el dueño (RLS de cobros, como antes).
create function public.cobros_portal_cliente(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object('folio', c.folio, 'fecha', to_char(c.fecha, 'YYYY-MM-DD'),
                                        'concepto', c.concepto, 'monto', c.monto)
                     order by c.fecha desc, c.folio desc)
    from public.cobros c where c.obra_id = en.obra_id and c.estado = 'vigente'), '[]')
  from public.enlace_cliente_vigente(p_token) en
  where en.id is not null
$$;

revoke all on function public.cobros_portal_cliente(text) from public, anon, authenticated, servidor_app;
grant execute on function public.cobros_portal_cliente(text) to servidor_app;
