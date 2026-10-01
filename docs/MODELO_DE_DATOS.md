# Modelo de datos

De las 28 hojas del libro de Google Sheets a tablas de PostgreSQL. Este documento es la propuesta de
partida para la fase 1: ajústala donde el código de `legacy/` diga otra cosa, y anota el cambio en
`docs/DECISIONES.md`.

## Principios

- **Llave primaria `uuid`** en todas las tablas, más un **folio legible por empresa** donde el legacy lo
  tenía (`OB-001`, `BIT-0001`, `OT-0001`…). Los folios salen de una tabla `folios (empresa_id, prefijo,
  ultimo)` que se incrementa dentro de la misma transacción, con bloqueo de renglón. Nunca se calculan
  leyendo la última fila, como hacía el legacy.
- **`empresa_id` en toda tabla de negocio**, con llave foránea e índice, y RLS por empresa.
- **Relaciones reales.** Donde el legacy guardaba texto (`area_id|partida`, listas separadas por `|`,
  enlaces de fotos juntos), aquí van llaves foráneas y tablas hijas.
- **Nada se borra.** Los registros anulables llevan `estado` (`vigente` / `anulado`). Las correcciones se
  registran en `correcciones`.
- **Auditoría básica** en todas: `creado_en`, `creado_por`, `actualizado_en`.
- **Fechas:** `date` para días de negocio (el día del cierre, la fecha de inicio) y `timestamptz` para
  momentos (cuándo se envió algo). Los días de negocio se interpretan en la zona horaria de la empresa.
- **Dinero en `numeric(12,2)`**, nunca en `float`.

## Quién lee qué

Leyenda: **D** = dueño y administrador · **PM** = el PM, solo en sus obras asignadas · **—** = sin acceso.

La escritura de los flujos importantes (cerrar el día, aprobar un trabajo, inspeccionar) pasa por funciones
del servidor que validan las reglas; RLS es la última línea de defensa, no la única.

### Empresa y usuarios

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `empresas` | Config | `nombre`, `ciudad`, `zona_horaria`, `idioma` | lee y escribe | lee `nombre` |
| `configuracion` | Config | una fila por empresa: `impuesto`, `limite_compra_pm`, `sla_bloqueo_horas`, `sla_oc_horas`, `umbral_oc_menor`, `margen_minimo_oc`, `horas_sin_recibo`, metas de indicadores | lee y escribe | lee `limite_compra_pm` y `horas_sin_recibo` |
| `miembros` | Usuarios | `user_id` (Supabase Auth), `empresa_id`, `rol` (`dueno`/`admin`/`pm`), `nombre`, `telefono`, `idioma`, `activo`, `tarjeta_ultimos4`, `correo_avisos` | lee y escribe | lee su propio renglón |
| `folios` | (nueva) | `prefijo`, `ultimo` | solo el servidor | solo el servidor |

El PIN de 4 dígitos del legacy se reemplaza por Supabase Auth. Queda por decidir el método de entrada del PM
(teléfono con código, correo o PIN en un dispositivo ya verificado): ver decisiones pendientes en el plan.

### Catálogo

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `plantillas_partida` | Partidas_Catalogo | `tipo_obra`, `orden`, `partida`, `hito_calidad`, `peso`, `dias`, `quien`, `paralelo`, `espera`, `etapa` | lee y escribe | — |
| `puntos_control` | Checklist_Calidad | `hito`, `orden`, `punto`, `requiere_foto` | lee y escribe | lee |
| `subcontratistas` | Subcontratistas | `nombre`, `oficio`, `telefono`, `contacto`, `correo`, `seguro_vence`, `licencia`, `licencia_vence`, `w9`, `activo` | lee y escribe | lee `nombre`, `oficio`, `telefono` |
| `trabajadores` | Trabajadores | `nombre`, `puesto`, `tipo_pago` (`hora`/`dia`), `telefono`, `activo` | lee y escribe | lee |
| `tarifas_trabajador` 💲 | Trabajadores.tarifa | `trabajador_id`, `tarifa`, `vigente_desde` | lee y escribe | — |

El PM necesita `tipo_pago` (para ofrecer día completo o medio día), pero nunca la tarifa: por eso se separa.

### Obras

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `obras` | Proyectos | `folio`, `cliente`, `telefono_cliente`, `direccion`, `etiqueta`, `pm_id`, `fecha_inicio`, `fecha_fin_estimada`, `fecha_fin_real`, `estado`, `notas` | lee y escribe | lee |
| `obras_finanzas` 💲 | Proyectos.contrato_original | `obra_id`, `contrato_original` | lee y escribe | — |
| `espacios` | Areas | `obra_id`, `tipo`, `nombre`, `pies2`, `pies_lineales`, `orden` | lee y escribe | lee |
| `partidas_obra` | Partidas_Obra | `espacio_id`, la copia de la plantilla (`orden`, `partida`, `hito_calidad`, `peso`, `dias`, `quien`, `paralelo`, `espera`, `etapa`) y `estado` (`activa`/`quitada`) | lee y escribe | lee |
| `presupuesto_etapas` 💲 | Presupuesto | `obra_id`, `espacio_id`, `etapa`, `monto`, `cantidad`, `unidad`, `notas` | lee y escribe | — |
| `plan_semanal` | Plan_Semanal | `semana`, `obra_id`, `espacio_id`, `partida`, `fin_previsto` | lee | — |

El presupuesto del legacy tiene renglones antiguos por partida (`nivel` vacío) y nuevos por etapa
(`nivel = 'Etapa'`). El importador de la fase 3 convierte los antiguos a su etapa: aquí solo existe el
presupuesto por etapa.

### Lo que registra el PM

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `bitacora` | Bitacora | `folio`, `obra_id`, `dia` (date), `usuario_id`, `sin_trabajo`, `motivo`, `incidencia`, `tardio`, `fotos_comprometidas`, `estado`, `enviado_en` | lee y escribe | lee y crea |
| `bitacora_partidas` | Bitacora.partidas | `bitacora_id`, `partida_obra_id` | lee | lee y crea |
| `bitacora_subs` | Bitacora.subs_presentes | `bitacora_id`, `orden_trabajo_id`, `llego` | lee | lee y crea |
| `avance` | Avance | `obra_id`, `partida_obra_id`, `estado` (`en_progreso`/`terminada`), `dia`, `usuario_id`, `estado_registro` | lee y escribe | lee y crea |
| `mano_obra` | Mano_Obra | `obra_id`, `partida_obra_id`, `trabajador_id`, `horas` (días si es por día), `dia`, `usuario_id`, `estado` | lee y escribe | lee y crea |
| `gastos` | Gastos | `obra_id`, `partida_obra_id`, `categoria`, `proveedor`, `descripcion`, `monto`, `metodo_pago`, `tarjeta_ultimos4`, `origen` (`pm`/`oficina`), `revision`, `usuario_id`, `estado` | lee y escribe | los que él registró |
| `avisos` | Bloqueos | `obra_id`, `tipo`, `descripcion`, `detiene_avance`, `estado`, `respuesta`, `respondido_en`, `orden_cambio_id` | lee y escribe | lee y crea |
| `inspecciones` | Calidad | `obra_id`, `espacio_id`, `hito`, `partida_obra_id`, `resultado`, `puntos_ok`, `puntos_total`, `no_aplica`, `defectos`, `usuario_id` | lee y escribe | lee y crea |
| `pruebas_agua` | Pruebas_Agua | `obra_id`, `espacio_id`, `inicio`, `fin`, `horas`, `resultado`, `usuario_id` | lee | lee y crea |
| `punch_list` | Punch_List | `obra_id`, `item`, `origen`, `responsable`, `fecha_compromiso`, `estado`, `fecha_cierre` | lee y escribe | lee y escribe |
| `fotos` | todos los `*_url` y `fotos_pendientes` | `obra_id`, `ref_tipo` (`bitacora`/`inspeccion`/`prueba_agua`/`aviso`/`punch`/`gasto`), `ref_id`, `indice`, `storage_path`, `tomada_en`, `subida_por` | lee | lee y crea en sus obras |

Las fotos pendientes de un cierre se calculan: `bitacora.fotos_comprometidas` menos las fotos que llegaron.
La restricción `unique (ref_tipo, ref_id, indice)` garantiza que un reintento no duplique una foto, como en
el legacy. Los archivos van a Supabase Storage con ruta `empresa/obra/…` y políticas propias.

El PM ve en `gastos` solo lo que él registró; las compras de la oficina quedan fuera de su vista.

### Subcontratos y cambios

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `ordenes_trabajo` | Ordenes_Trabajo | `folio`, `obra_id`, `subcontratista_id`, `partida_obra_id`, `oficio`, `alcance`, `inicio_programado`, `fin_programado`, `estado`, `confirmada_en`, `se_presento`, `aprobada_en`, `aprobada_por`, `faltas` | lee y escribe | lee; confirma, marca llegada y aprueba mediante el servidor |
| `ordenes_trabajo_precios` 💲 | Ordenes_Trabajo.precio | `orden_trabajo_id`, `precio` | lee y escribe | — |
| `pagos_sub` 💲 | Pagos_Sub | `orden_trabajo_id`, `fecha`, `concepto`, `monto`, `metodo`, `referencia`, `estado` | lee y escribe | — |
| `ordenes_cambio` | Ordenes_Cambio | `folio`, `obra_id`, `fecha_hallazgo`, `motivo`, `descripcion`, `dias_impacto`, `estado`, `emitida_en`, `autorizada_en`, `cobrada_en`, `condicion_pago`, `aviso_id` | lee y escribe | lee solo las autorizadas |
| `ordenes_cambio_montos` 💲 | Ordenes_Cambio | `orden_cambio_id`, `costo_estimado`, `precio_cliente` | lee y escribe | — |
| `no_calidad` 💲 | No_Calidad | `obra_id`, `tipo`, `causa`, `subcontratista_id`, `costo`, `dias_perdidos`, `descripcion`, `estado` | lee y escribe | — |

El margen de una orden de cambio se calcula (`(precio - costo) / precio`); no se guarda.

### Dinero y cierre

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `cobros` 💲 | Cobros | `obra_id`, `fecha`, `concepto`, `monto`, `metodo`, `referencia`, `estado` | lee y escribe | — |
| `entregas` | Entrega | `obra_id`, `fecha_entrega`, `garantia_meses`, `garantia_vence`, `autoriza_fotos`, `resena_pedida`, `resena_recibida`, `referido_pedido`, `visita_11m`, `notas` | lee y escribe | lee `fecha_entrega` |
| `obras_cerradas` 💲 | Obras_Cerradas | la foto fija del cierre: fechas, días de ciclo, contrato, órdenes de cambio, presupuesto, costos por cubo, margen, desvío, cobrado, no calidad, pies² | lee | — |
| `historico_etapas` 💲 | (nueva) | al cerrar una obra: costo real por etapa y por pie² de cada espacio | lee | — |
| `historico_duraciones` | (nueva) | al cerrar una obra: días reales por partida | lee | — |

Las dos tablas nuevas de histórico resuelven algo que el legacy recalculaba desde cero en cada carga: los
costos unitarios y las duraciones reales se guardan una vez, al cerrar la obra.

### Sistema

| Tabla | Viene de | Columnas principales | D | PM |
| --- | --- | --- | --- | --- |
| `correcciones` | Correcciones | `usuario_id`, `tabla`, `registro_id`, `accion`, `campo`, `antes`, `despues`, `motivo` | lee | — (se escribe desde el servidor) |

**Lo que no se traslada:** la hoja `Errores` se reemplaza por un servicio de registro de errores; el sello
`ULTIMO_CAMBIO` por Supabase Realtime; los respaldos y el chequeo de salud del libro por los respaldos del
proveedor y las restricciones de la base (llaves foráneas, `not null`, `unique`).

## Lo que se calcula y no se guarda

- El avance ponderado de cada obra y espacio.
- El cronograma: plan, previsión, atraso previsto, "Esta semana".
- Los costos por etapa y por cubo (materiales, cuadrilla, subcontratos) de una obra en curso.
- Los indicadores.

Estos cálculos viven en `packages/core` como funciones puras, con sus pruebas de paridad contra el legacy.

## Pendiente de revisar en `legacy/`

- Dónde guarda el legacy las **medidas verificadas** por el PM (`pmMedida`): no hay una hoja con ese nombre.
- Qué columnas exactas usa `Obras_Cerradas` en cada indicador del histórico.
