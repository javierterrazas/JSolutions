-- El cierre de una obra (D-085): al cerrarla se guarda su histórico por etapa (D-008). Además de los pies², los pies
-- lineales del espacio, para cuando una etapa se cotice por pie lineal (cubiertas, zoclos).
alter table public.historico_etapas
  add column pies_lineales numeric(10, 2) not null default 0 check (pies_lineales >= 0);
