# Simulación de un mes de trabajo (D-088)

10 obras simuladas en IJM Construction con `packages/servidor/scripts/simular-obras.ts`, del 8 de septiembre al 15 de
octubre de 2026, con el catálogo real de la empresa (41 partidas, 7 subs) y precios de Austin de gama media (costo por
pie²: baño $235, cocina $195, closet $95; generales $1,350; margen 35%). Cada paso usa las mismas funciones que la app,
a nombre del dueño o del PM, día por día, siguiendo el cronograma de cada obra.

## Resultado en la nube

| Folio | Obra | Estado al 15 de octubre |
| --- | --- | --- |
| OB-003 | Familia Johnson | entregada y cerrada |
| OB-004 | Familia García | entregada y cerrada |
| OB-005 | Smith Residence | entregada y cerrada |
| OB-006 | Familia Martínez | entregada y cerrada (cambió de PM) |
| OB-007 | Brown Family | en obra (atrasada por la condición oculta) |
| OB-008 | Lee Residence | entregada y cerrada |
| OB-009 | Familia Hernández | en obra |
| OB-010 | Wilson Home | en obra |
| OB-011 | Davis Family | en obra |
| OB-012 | Familia Rodríguez | lista para arranque |

~200 cierres del día, ~240 gastos y compras, 53 órdenes de trabajo con sus pagos, 6 órdenes de cambio, ~300 fotos.
OB-001 y OB-002 son las obras reales de la empresa: no se tocaron.

## Qué se simuló

| Obra | Qué es | PM | Lo que pasa |
| --- | --- | --- | --- |
| Familia Johnson | Baño 65 ft² | Ricardo Salinas | Orden de cambio con margen bajo (la app avisa; se emite así) y aprobada con firma en el portal |
| Familia García | Cocina 180 ft² | Marco Treviño | Orden de cambio pedida por el cliente, aprobada en papel |
| Smith Residence | Baño 45 + closet 32 | Daniel Ortiz | Cambio de selección que el cliente rechaza en el portal |
| Familia Martínez | Cocina 210 ft² | Ricardo → Daniel | **Cambio de PM a media obra**; aviso de material (gabinetes retrasados) |
| Brown Family | Baño 80 ft² | Marco Treviño | Tubería galvanizada al demoler: aviso → respuesta → orden de cambio por condición oculta, aprobada con firma; se pasa del costo |
| Lee Residence | Closet 40 ft² | Daniel Ortiz | Obra corta, de principio a fin |
| Familia Hernández | 2 baños | Ricardo Salinas | Nicho adicional aprobado en el portal; un día sin cuadrilla disponible |
| Wilson Home | Cocina 160 ft² | Marco Treviño | Orden de cambio sin respuesta del cliente; margen de 30% |
| Davis Family | Baño 60 ft² | Daniel Ortiz | Arranca la última semana |
| Familia Rodríguez | Cocina 190 ft² | Ricardo Salinas | Solo alta y presupuesto: lista para arranque |

En cada una: alta con presupuesto (costo y margen por etapa), depósito del 30%, enlace del portal, cierres diarios con
partidas, cuadrilla (8 trabajadores repartidos) y subs, inspecciones con fotos (10% con defectos que se repiten al día
siguiente), prueba de inundación de 24 h en los baños, órdenes de trabajo (el dueño emite, el PM confirma y aprueba, el
dueño paga anticipo y liquidación), gastos del PM con recibo (algunos sin recibo, y los que pasan su límite los revisa
el dueño), compras grandes de la oficina, fotos para el cliente, cobro de avance al 50%, plan de la semana congelado
cada lunes, y al terminar: medida verificada, punch, cobro final y cierre de la obra.

## Lo que funcionó bien

- **El flujo completo cierra sin trabas:** ninguna regla de la app impidió un paso normal en ~190 cierres del día.
- **Cambio de PM:** desde ese momento el PM anterior ya no ve la obra ni puede cerrarle el día (`obra_no_encontrada`);
  el nuevo sigue con los cierres, las órdenes de trabajo y la cuadrilla. Lo capturado por el anterior se queda.
- **Las alertas avisan lo que deben:** margen bajo en órdenes de cambio (sugiere el precio), papeles de los subs,
  anticipo antes de confirmar, inspecciones obligatorias antes de terminar, prueba de inundación de 23 h o más.
- **Los indicadores reaccionan:** cumplimiento del plan 87%, presentación de subs 98%, inspecciones con defectos en
  rojo, margen de órdenes de cambio 38%.

## Hallazgos: flujos que no cierran

1. **Resuelto en D-089.** **Las órdenes de cambio nunca pasan a "facturada".** No hay ningún paso en la app que lo haga (ni el cobro con
   concepto "orden de cambio"). Al cerrar cada obra, la revisión avisa como grave "órdenes aprobadas sin facturar",
   aunque ya se hayan cobrado. *Propuesta:* que el cobro de una orden de cambio la marque facturada (eligiendo la
   orden al cobrar), o quitar el estado "facturada" y el aviso.
2. **Resuelto en D-090.** **No hay dónde registrar retrabajos ni reclamos de garantía** (`no_calidad`). Los indicadores de costo de no calidad
   y garantías siempre salen en cero, y el histórico no puede contar reclamos.
3. **Resuelto en D-090.** **No hay dónde marcar la reseña del cliente** (ni pedirla). El indicador de reseñas sale en rojo para siempre.
4. **Resuelto en D-091.** **El estado "en cierre" no se usa:** ninguna acción lleva una obra a "en cierre"; pasa de "en obra" a "entregada" al
   cerrarla. Sobra, o falta el paso (por ejemplo, al terminar todas las partidas).

## Hallazgos: datos que se guardan y nadie llena

- **Resuelto en D-090.** En la entrega: `autoriza_fotos`, `resena_pedida`, `resena_recibida`, `referido_pedido`,
  `visita_11m` (del legacy).
- En los miembros: `tarjeta_ultimos4` (se copia a cada gasto, pero no hay pantalla para ponerla).
- La fecha de entrega se guarda tres veces (`obras.fecha_fin_real`, `entregas.fecha_entrega`,
  `obras_cerradas.fecha_fin_real`); el contrato dos (`obras_finanzas`, `obras_cerradas`, este como foto al cierre, que
  sí tiene sentido).

## Hallazgos: pasos que se repiten o pesan

- **La revisión de gastos del PM:** con el límite de $300, el dueño tuvo que revisar ~14% de los gastos del PM (uno o
  dos al día con 10 obras). *Propuesta:* subir el límite o revisar en lote.
- **Resuelto en D-091.** **Las órdenes de trabajo llevan muchos toques:** emitir (dueño) → confirmar (PM) → anticipo (dueño) → reportar que
  llegó (PM, cada día) → aprobar (PM) → liquidar (dueño). Seis pasos por partida subcontratada; en un baño son 6
  partidas. *Propuesta:* que el PM confirme y apruebe desde su cierre del día, y que la liquidación se proponga sola al
  aprobar.
- **Resuelto en D-092 (se queda así, a propósito).** **La misma inspección sirve para dos partidas:** en la cocina, gabinetes y countertop usan el mismo punto de control
  (PC4); la app deja terminar la segunda con la inspección de la primera. *Propuesta:* exigir una inspección hecha
  después de que la partida arrancó.
- **La cuadrilla no alcanzó** un día con 8 trabajadores para 9 obras activas, y la app no lo anticipa: no hay vista de
  quién va a qué obra mañana.
- **Las horas de un trabajador en dos obras:** del 10 al 15 de octubre, Jose Luna ya tenía 10 horas en la obra real
  OB-001; la app no dejó cargarle más de 16 en el día y rechazó esos cierres de Wilson Home (bien). Pero el PM se
  entera hasta que envía su cierre. *Propuesta:* al capturar la cuadrilla, mostrar las horas que ese trabajador ya
  lleva hoy en otras obras.

## Artefactos de la simulación (no son de la app)

- Los avisos se respondieron "al instante" y los gastos no llevan 72 h sin recibo: la base pone la hora real del
  registro, no la del día simulado, así que esos indicadores salen perfectos.
- Las fotos son imágenes con texto, no fotos reales.
- Los 3 PMs simulados quedaron con su invitación pendiente: no entran a la app. Se pueden dar de baja en Managers.
- La simulación usó también a la cuadrilla real de la empresa (además de 4 trabajadores nuevos): sus horas en las obras
  simuladas aparecen en "Cuadrilla".
- Las obras simuladas dicen "Obra simulada para probar la app (D-088)" en sus notas.
