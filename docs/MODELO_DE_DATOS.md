# Modelo de datos

De las 28 hojas del libro de Google Sheets a 44 tablas de PostgreSQL. **La fuente de verdad son las migraciones
de `supabase/migrations/`**; este documento las explica. El esquema de Drizzle (`packages/db/src/esquema/`) se
genera desde ellas con `pnpm db:esquema`.

## Principios

- **Llave primaria `uuid`** en todas las tablas, más un **folio legible por empresa** donde una persona lo lee o
  lo cita: `OB-001`, `BIT-0001`, `GTO`, `BLQ`, `PUN`, `OT`, `PAG`, `OC`, `NC`, `COB`. Los da
  `siguiente_folio(empresa, prefijo, dígitos)` dentro de la misma transacción, con bloqueo de renglón (D-005).
- **`empresa_id` en toda tabla de negocio**, y **llaves foráneas compuestas** `(empresa_id, x_id)`: la base
  misma impide que un registro de una empresa apunte a algo de otra. Lo que cuelga de una obra lleva además
  `obra_id`, con llaves `(obra_id, x_id)`; y lo que cuelga de un espacio, `(espacio_id, partida_obra_id)`. Así un
  avance no puede apuntar a la partida de otra obra, ni la mano de obra de un baño a una partida de la cocina
  (D-018).
- **Nada se borra.** Los registros anulables llevan `estado` (`vigente` / `anulado`): bitácora, avance, mano de
  obra, gastos, pagos y cobros. Las ediciones y anulaciones quedan en `correcciones`.
- **Auditoría:** `creado_en`, `creado_por` (el **miembro** que capturó) y `actualizado_en`, que un disparador
  renueva en cada edición.
- **Fechas:** `date` para días de negocio y `timestamptz` para momentos (D-006).
- **Dinero en `numeric(12,2)`**; ninguna columna usa punto flotante.
- **Estados y listas fijas como `enum`**, con los valores del legacy (D-020).
- **Lo que se muestra y lo captura cada empresa, en dos idiomas:** `nombre_es` (obligatorio) y `nombre_en`
  (D-015).
- **RLS activado en todas las tablas.** Sin políticas, nadie con sesión de usuario lee ni escribe nada: las
  políticas llegan en el paso 4. Una prueba falla si una tabla queda sin RLS.

## Quién lee qué

Leyenda: **D** = dueño y administrador · **PM** = el PM, solo en sus obras asignadas · **—** = sin acceso ·
💲 = tabla con dinero, solo dueño y administrador (D-002). Las columnas que el PM no debe ver en tablas que sí
lee se le dan por **vistas** (D-013, paso 4).

La escritura de los flujos importantes pasa por funciones del servidor que validan las reglas; RLS es la última
línea de defensa, no la única.

### Empresa y usuarios

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `empresas` | Config | `nombre`, `ciudad`, `zona_horaria` (por defecto `America/Chicago`), `idioma` | lee y escribe | vista: `nombre`, `zona_horaria` |
| `configuracion` | Config | una fila por empresa: `impuesto`, `limite_compra_pm`, `sla_bloqueo_horas`, `sla_oc_horas`, `umbral_oc_menor`, `margen_minimo_oc`, `horas_sin_recibo` | lee y escribe | vista: `limite_compra_pm`, `horas_sin_recibo`, `sla_bloqueo_horas` |
| `metas_indicadores` | Config (`META_*`, `MAX_*`) y metas fijas del código | `indicador`, `meta`; sin renglón vale la del legacy (D-019) | lee y escribe | — |
| `miembros` | Usuarios | `user_id` (Supabase Auth, único: una empresa por usuario, D-016), `rol` (`dueno`/`admin`/`pm`), `nombre`, `telefono`, `idioma`, `activo`, `tarjeta_ultimos4`, `correo_avisos` | lee y escribe | lee su propio renglón |
| `dispositivos` | (nueva) | los celulares que verificó cada miembro: `nombre`, `pin_hash`, `intentos_fallidos`, `bloqueado_hasta`, `verificado_en`, `ultimo_uso`, `revocado_en` (D-024) | lee y revoca | los suyos |
| `folios` | (nueva) | `prefijo`, `ultimo` | solo el servidor | solo el servidor |

`admin` y `dueno` tienen hoy los mismos permisos; quedan separados para poder distinguirlos después (decisión
pendiente 5 del plan). El PIN del legacy, que valía en cualquier teléfono, se reemplaza por Supabase Auth más un
PIN por dispositivo verificado (D-024).

**Quién es el usuario de la sesión.** Las políticas usan estas funciones, que leen `miembros` en cada consulta:
dar de baja a un miembro, o desactivar su empresa, le corta el acceso en ese instante (D-016).

| Función | Devuelve |
| --- | --- |
| `miembro_actual()` | el miembro activo de la sesión, de una empresa activa; nulo si no hay |
| `empresa_actual()` | su empresa |
| `rol_actual()` | su rol: `dueno`, `admin` o `pm` |
| `es_dueno_o_admin()` | si ve todo el negocio de su empresa, dinero incluido |
| `es_pm_de(obra)` | si es el PM asignado a esa obra y la obra no se ha entregado (como `misObras_` del legacy) |

### Catálogo

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `tipos_espacio` | Partidas_Catalogo.tipo_obra | Baño, Cocina, Closet…; `es_generales` marca "Generales de obra" (uno por empresa) | lee y escribe | lee |
| `oficios` | Subcontratistas.oficio, Partidas_Catalogo.quien | Plomería, Eléctrico, Tile…; `requiere_licencia` (Texas: plomería, electricidad, HVAC) | lee y escribe | lee |
| `etapas` | Partidas_Catalogo.etapa | etapas del presupuesto: Demolición, Plomería, Tile… | lee y escribe | lee |
| `hitos_calidad` | Checklist_Calidad.hito | `clave` (`PC1`…), `nombre`; `exige_prueba_agua` (el PC3) | lee y escribe | lee |
| `puntos_control` | Checklist_Calidad | las preguntas de cada hito, `requiere_foto` | lee y escribe | lee |
| `plantillas_partida` | Partidas_Catalogo | por tipo de espacio: `orden`, `nombre`, `hito_id`, `peso`, `dias`, `responsable` (`cuadrilla`/`pm`/`subcontratista` + `oficio_id`), `paralelo`, `espera`, `etapa_id` | lee y escribe | — |
| `subcontratistas` | Subcontratistas | `nombre` (único), `oficio_id`, `telefono`, `contacto`, `correo`, `seguro_vence`, `licencia`, `licencia_vence`, `w9`, `activo` | lee y escribe | vista: `nombre`, `oficio`, `telefono` |
| `trabajadores` | Trabajadores | `nombre`, `puesto`, `tipo_pago` (`hora`/`dia`), `telefono`, `activo` | lee y escribe | lee |
| `tarifas_trabajador` 💲 | Trabajadores.tarifa | `trabajador_id`, `tarifa`, `vigente_desde`: un aumento no cambia el costo de lo pasado | lee y escribe | — |

El legacy deducía cosas del texto: el tipo "Generales", la licencia por la palabra "plomer" en el oficio, el PC3
porque su nombre empieza con "PC3", y si una partida la hace un sub porque `quien` no dice "Cuadrilla" ni "PM".
Aquí son columnas (D-021).

### Obras

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `obras` | Proyectos | `folio`, `cliente`, `telefono_cliente` (10 dígitos o más), `direccion`, `pm_id`, `fecha_inicio`, `fecha_fin_estimada` (no antes del inicio), `fecha_fin_real`, `estado`, `notas` | lee y escribe | lee |
| `obras_finanzas` 💲 | Proyectos.contrato_original | `contrato_original` (mayor a cero) | lee y escribe | — |
| `espacios` | Areas | `tipo_espacio_id`, `nombre`, `orden`; **dos medidas** (D-014): `pies2_cotizados`, `pies_lineales_cotizados` y `pies2_verificados`, `pies_lineales_verificados` con `verificado_por` y `verificado_en` | lee y escribe | lee; verifica la medida mediante el servidor |
| `partidas_obra` | Partidas_Obra | la copia de la plantilla (`plantilla_id` de origen) o una partida solo de esta obra; `estado` (`activa`/`quitada`) | lee y escribe | lee |
| `presupuesto_etapas` 💲 | Presupuesto | `espacio_id`, `etapa_id` (nulo = "Otras partidas"), `monto`, `notas`; uno por espacio y etapa | lee y escribe | — |
| `plan_semanal` | Plan_Semanal | `semana` (lunes), `partida_obra_id`, `fin_previsto`: lo que el cronograma preveía, congelado | lee | — |

La etiqueta de la obra ("Baño + Closet") y los pies² totales no se guardan: salen de sus espacios.
`presupuesto_etapas` no guarda cantidad ni unidad: son los pies² vigentes del espacio (D-014).

### Lo que registra el PM

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `bitacora` | Bitacora | `folio`, `obra_id`, `dia`, `sin_trabajo` + `motivo_sin_trabajo` (obligatorio si no hubo trabajo), `incidencia`, `tardio`, `fotos_comprometidas` (0 a 10), `estado`, `enviado_en`. **Un solo cierre vigente por obra y día** | lee y escribe | lee y crea |
| `bitacora_partidas` | Bitacora.partidas | las partidas trabajadas ese día | lee | lee y crea |
| `bitacora_subs` | Bitacora.subs_presentes | `orden_trabajo_id`, `llego` | lee | lee y crea |
| `avance` | Avance | `partida_obra_id`, `estado` (`en_progreso`/`terminada`), `dia`, `bitacora_id` (D-022), `estado_registro` | lee y escribe | lee y crea |
| `mano_obra` | Mano_Obra | `espacio_id`, `partida_obra_id` (opcional), `trabajador_id`, `cantidad` (horas, o días si cobra por día), `dia`, `bitacora_id`, `estado` | lee y escribe | lee y crea |
| `gastos` | Gastos | `folio`, `espacio_id` (D-022), `partida_obra_id` (opcional), `dia`, `categoria`, `proveedor`, `descripcion`, `monto`, `metodo_pago`, `tarjeta_ultimos4`, `origen` (`pm`/`oficina`), `revision`, `estado` | lee y escribe | los que él registró |
| `avisos` | Bloqueos | `folio`, `tipo`, `descripcion` (10 caracteres o más), `detiene_avance`, `estado`, `respuesta`, `respondido_en`, `respondido_por` | lee y escribe | los que él levantó (D-017) |
| `inspecciones` | Calidad | `espacio_id`, `hito_id`, `partida_obra_id`, `resultado`, `puntos_ok`, `puntos_total`, `realizada_en`; aprobado si y solo si todos los puntos que aplican cumplen | lee y escribe | lee y crea |
| `inspeccion_respuestas` | Calidad.defectos y no_aplica | por pregunta: `respuesta` (`cumple`/`no_cumple`/`no_aplica`) y el texto de la pregunta como estaba ese día | lee | lee y crea |
| `pruebas_agua` | Pruebas_Agua | `espacio_id`, `inicio`, `fin`, `resultado` (`en_curso`/`sin_fugas`/`con_fuga`); una en curso por espacio. Las horas se calculan | lee | lee y crea |
| `punch_list` | Punch_List | `folio`, `item`, `origen` (`defecto`/`cambio_alcance`/`expectativa`), `responsable`, `fecha_compromiso`, `estado`, `cerrado_en` | lee y escribe | lee y escribe |
| `fotos` | todos los `*_url` y `fotos_pendientes` | `ref_tipo`, `ref_id`, `indice`, `storage_path`, `tomada_en`; **`unique (ref_tipo, ref_id, indice)`** | lee | lee y crea en sus obras |

Las fotos pendientes de un cierre son `bitacora.fotos_comprometidas` menos las fotos que llegaron. El número
(`indice`) garantiza que un reintento sin señal no duplique una foto. Las fotos de la prueba de agua: índice 1
al inicio, 2 al final. El recibo de un gasto es una foto con `ref_tipo = 'gasto'`.

### Subcontratos y cambios

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `ordenes_trabajo` | Ordenes_Trabajo | `folio`, `subcontratista_id`, `espacio_id`, `partida_obra_id` (obligatoria: sin partida no hay costeo), `alcance`, `inicio_programado`, `fin_programado`, `estado`, `confirmada_en`, `se_presento`, `aprobada_en`, `aprobada_por`, `faltas` | lee y escribe | emitidas, confirmadas y aprobadas (D-017); confirma, marca llegada y aprueba mediante el servidor |
| `ordenes_trabajo_precios` 💲 | Ordenes_Trabajo.precio | `precio` (cerrado, mayor a cero) | lee y escribe | — |
| `pagos_sub` 💲 | Pagos_Sub | `folio`, `orden_trabajo_id`, `fecha`, `concepto` (`anticipo`/`parcial`/`liquidacion`), `monto`, `metodo`, `referencia`, `estado` | lee y escribe | — |
| `ordenes_cambio` | Ordenes_Cambio | `folio`, `fecha_hallazgo`, `motivo`, `descripcion`, `dias_impacto`, `estado` (`propuesta`/`autorizada`/`rechazada`/`facturada`), `emitida_en`, `autorizada_en`, `facturada_en`, `condicion_pago`, `aviso_id` | lee y escribe | vista: autorizadas y facturadas, sin `condicion_pago` ni `facturada_en` (D-017) |
| `ordenes_cambio_montos` 💲 | Ordenes_Cambio | `costo_estimado`, `precio_cliente` | lee y escribe | — |
| `no_calidad` 💲 | No_Calidad | `folio`, `tipo` (`retrabajo`/`garantia`), `causa`, `subcontratista_id`, `costo`, `dias_perdidos`, `descripcion`, `estado`, `cerrado_en` | lee y escribe | — |

El margen de una orden de cambio se calcula (`(precio - costo) / precio`); no se guarda. Si de un aviso sale una
orden de cambio, la orden apunta al aviso (`aviso_id`); el legacy marcaba además el aviso (`genera_oc`), que
aquí se deduce.

### Dinero y cierre

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `cobros` 💲 | Cobros | `folio`, `fecha`, `concepto`, `monto`, `metodo`, `referencia`, `estado` | lee y escribe | — |
| `entregas` | Entrega | una por obra: `fecha_entrega`, `garantia_meses`, `garantia_vence`, `autoriza_fotos`, `resena_pedida`, `resena_recibida`, `referido_pedido`, `visita_11m`, `notas` | lee y escribe | vista: `fecha_entrega` |
| `obras_cerradas` 💲 | Obras_Cerradas | la foto fija del cierre: fechas, días de ciclo, contrato, órdenes de cambio, presupuesto, materiales, cuadrilla, subcontratos, costo total, margen, desvío, cobrado, no calidad, días reportados, pies² | lee | — |
| `historico_etapas` 💲 | (nueva) | al cerrar: por espacio y etapa, presupuestado, costo real, pies² y costo por pie² | lee | — |
| `historico_duraciones` | (nueva) | al cerrar: días planeados y reales de cada partida | lee | — |

### Sistema

| Tabla | Viene de | Qué guarda | D | PM |
| --- | --- | --- | --- | --- |
| `correcciones` | Correcciones | `tabla`, `registro_id`, `accion` (`editar`/`anular`/`agregar`/`quitar`/`dia_olvidado`/`medida_verificada`), `campo`, `antes`, `despues`, `motivo` (5 caracteres o más), quién y cuándo | lee | — (la escribe el servidor) |

**Lo que no se traslada:** la hoja `Errores` se reemplaza por un servicio de registro de errores; el sello
`ULTIMO_CAMBIO` por Supabase Realtime; los respaldos y el chequeo de salud del libro por los respaldos del
proveedor y las restricciones de la base; `ID_CARPETA_DRIVE` por Supabase Storage.

## Lo que se calcula y no se guarda

- El avance ponderado de cada obra y espacio, y el estado actual de cada partida.
- El cronograma: plan, previsión, atraso previsto, "Esta semana".
- Los costos por etapa y por pie² de una obra en curso.
- Las horas de una prueba de agua, el margen de una orden de cambio, las horas de respuesta a un aviso.
- Los indicadores.

Estos cálculos viven en `packages/core` como funciones puras, con sus pruebas de paridad contra el legacy.

## Lo que la base garantiza por sí misma

Probado en `packages/db/pruebas/integracion/modelo.test.ts`: ninguna llave cruza empresas; un solo cierre vigente
por obra y día; "sin trabajo" exige motivo; una foto con el mismo número no entra dos veces; la entrega no antes
del inicio; el teléfono con 10 dígitos; la medida verificada con quién y cuándo; dinero en `numeric(12,2)` y
fuera de las tablas que leerá el PM. Y en `folios.test.ts`: 100 escrituras simultáneas reciben 100 folios
distintos.

## Pendiente

- Qué columnas exactas usa `Obras_Cerradas` en cada indicador del histórico: se confirma al trasladar los
  indicadores (paso 5).
- Las vistas del PM y las políticas RLS: paso 4.
