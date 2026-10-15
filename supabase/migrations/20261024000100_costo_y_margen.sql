-- El presupuesto con costo y margen (D-084; lo pidió el dueño): de cada etapa se captura lo que se espera gastar
-- (costo) y el margen deseado; la app calcula el precio (costo / (1 − margen), el margen sobre el precio, como en
-- las órdenes de cambio) y el contrato sale de la suma de los precios. El seguimiento compara lo gastado contra el
-- costo, no contra el precio.
--
-- presupuesto_etapas.monto sigue siendo el PRECIO de la etapa (lo que se le cobra al cliente): así lo capturaba el
-- dueño hasta ahora, con el margen incluido. Los montos que ya existen se toman como precio y su costo se calcula con
-- el margen de la empresa; el dueño lo corrige etapa por etapa.

-- El margen con que se arma cada presupuesto nuevo: 35% sobre el precio, como el margen mínimo de las órdenes de cambio.
alter table public.configuracion
  add column margen_presupuesto numeric(5, 4) not null default 0.35
    check (margen_presupuesto >= 0 and margen_presupuesto < 1);

-- El margen que se busca en la obra (el que trae cada etapa nueva).
alter table public.obras_finanzas
  add column margen_objetivo numeric(5, 4) check (margen_objetivo is null or (margen_objetivo >= 0 and margen_objetivo < 1));

-- Lo que se espera gastar en la etapa. Sin costo (de antes, o de una versión de la app que no lo manda), el
-- seguimiento usa el precio, como antes.
alter table public.presupuesto_etapas
  add column costo numeric(12, 2) check (costo is null or costo >= 0);

update public.presupuesto_etapas p set costo = round(p.monto * (1 - c.margen_presupuesto), 2)
  from public.configuracion c where c.empresa_id = p.empresa_id;
update public.obras_finanzas f set margen_objetivo = c.margen_presupuesto
  from public.configuracion c where c.empresa_id = f.empresa_id;
