-- Fase 2, paso 3 · Lo que el inicio del PM necesita saber de sus obras ya entregadas, sin abrirle esas obras.
--
-- El PM deja de ver una obra al entregarse (D-017), con sus fotos y sus cierres. Pero sus gastos sin recibo y su
-- racha de días cerrados son SUYOS y cuentan en todas sus obras, como en el legacy (construirDatos_). Estas dos
-- funciones contestan solo eso, del miembro de la sesión, sin devolver fotos ni registros de la obra.

-- Los gastos del miembro de la sesión que no tienen foto del recibo.
create function public.mis_gastos_sin_recibo() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select g.id from public.gastos g
  where g.creado_por = public.miembro_actual() and g.estado = 'vigente'
    and not exists (select 1 from public.fotos f where f.ref_tipo = 'gasto' and f.ref_id = g.id)
$$;

-- Los días en que el miembro de la sesión cerró al menos una obra.
create function public.mis_dias_cerrados() returns setof date
language sql stable security definer set search_path = '' as $$
  select distinct b.dia from public.bitacora b
  where b.creado_por = public.miembro_actual() and b.estado = 'vigente'
$$;

revoke all on function public.mis_gastos_sin_recibo(), public.mis_dias_cerrados()
  from public, anon, authenticated, servidor_app;
grant execute on function public.mis_gastos_sin_recibo(), public.mis_dias_cerrados() to servidor_app;
