-- La unidad de cada etapa (D-086; lo pidió el dueño): unas se cotizan por pie² (tile, pintura) y otras por pie
-- lineal (cubiertas, zoclos). El presupuesto muestra el costo por esa unidad y el cierre guarda el costo por ella,
-- para recomendar después el costo de cada etapa con el histórico de la empresa.
alter table public.etapas
  add column unidad text not null default 'pie2' check (unidad in ('pie2', 'pie_lineal'));

-- El histórico guarda la unidad que tenía la etapa al cerrar, y el costo real por ella.
alter table public.historico_etapas
  add column unidad text not null default 'pie2' check (unidad in ('pie2', 'pie_lineal')),
  add column costo_por_unidad numeric(12, 4);
update public.historico_etapas set costo_por_unidad = costo_por_pie2;
