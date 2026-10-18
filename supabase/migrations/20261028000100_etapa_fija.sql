-- Etapas con precio fijo por espacio (D-095; lo pidió el dueño): unas etapas crecen con el tamaño (tile por pie²,
-- gabinetes por pie lineal) y otras cuestan casi lo mismo en un espacio chico que en uno grande (plomería, appliances).
-- La unidad de la etapa, y la que guarda el histórico al cerrar, ya pueden ser 'fijo'.
alter table public.etapas drop constraint etapas_unidad_check;
alter table public.etapas add constraint etapas_unidad_check check (unidad in ('pie2', 'pie_lineal', 'fijo'));
alter table public.historico_etapas drop constraint historico_etapas_unidad_check;
alter table public.historico_etapas
  add constraint historico_etapas_unidad_check check (unidad in ('pie2', 'pie_lineal', 'fijo'));
