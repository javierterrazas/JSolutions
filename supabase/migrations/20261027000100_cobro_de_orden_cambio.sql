-- El cobro de una orden de cambio (D-089; hallazgo de la simulación D-088): un cobro con concepto "orden de cambio" dice
-- de cuál es, y esa orden queda facturada. Antes ningún paso de la app la facturaba, y al cerrar cada obra la revisión
-- avisaba como grave "órdenes aprobadas sin facturar" aunque ya se hubieran cobrado.
alter table public.cobros
  add column orden_cambio_id uuid,
  add constraint cobros_orden_cambio_fkey foreign key (obra_id, orden_cambio_id)
    references public.ordenes_cambio (obra_id, id),
  add constraint cobros_orden_cambio_concepto check (orden_cambio_id is null or concepto = 'orden_cambio');
create index on public.cobros (orden_cambio_id);
