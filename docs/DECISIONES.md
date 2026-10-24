# Registro de decisiones

Cada decisión de diseño, y cada diferencia intencional con el legacy, se anota aquí: qué se decidió, por qué
y qué se descartó. Antes de cambiar algo de esta lista, se discute.

## D-001 · Stack

**Decisión:** Next.js (App Router) + TypeScript, Supabase (PostgreSQL, Auth, Storage, RLS), Drizzle, Vitest,
Playwright, next-intl, Vercel; Stripe en la fase 4.
**Por qué:** el legacy es JavaScript, así que las reglas pasan casi tal cual a TypeScript; PostgreSQL con RLS
resuelve la multiempresa y la muralla financiera en la base; es el stack más común para software por
suscripción.
**Descartado:** Firebase (los datos son muy relacionales); Django o Rails (un segundo lenguaje); apps nativas
(por ahora basta una PWA).

## D-002 · La muralla financiera vive en la base de datos

**Decisión:** el dinero va en tablas propias (`obras_finanzas`, `tarifas_trabajador`, `presupuesto_etapas`,
`ordenes_trabajo_precios`, `ordenes_cambio_montos`, `pagos_sub`, `cobros`, `no_calidad`, `obras_cerradas`,
`historico_etapas`) con RLS solo para dueño y administrador.
**Por qué:** RLS filtra renglones, no columnas; separar el dinero en tablas hace que un PM no pueda leerlo
aunque el código de la app tenga un error. En el legacy la muralla dependía de que el servidor del PM no
leyera esas hojas.

## D-003 · Multiempresa

**Decisión:** `empresa_id` en toda tabla de negocio, RLS por empresa, y el `service role` solo en migraciones,
importación y tareas programadas.

## D-004 · Presupuesto solo por etapa

**Decisión:** solo existe `presupuesto_etapas`. Los renglones antiguos del legacy, por partida, se convierten a
su etapa en el importador de la fase 3.

## D-005 · Folios por empresa

**Decisión:** llave `uuid` y folio legible por empresa (`OB-001`, `BIT-0001`) desde la tabla `folios`,
incrementada dentro de la transacción.
**Por qué:** el legacy calculaba el siguiente número leyendo la última fila de la hoja, y eso llegó a repetir
números cuando había notas al pie.

## D-006 · Días de negocio en la zona horaria de la empresa

**Decisión:** `date` para días de negocio y `timestamptz` para momentos; "hoy", días hábiles y plazos en la
zona de la empresa (por defecto `America/Chicago`). Una fecha capturada `2026-10-30` es ese día local.
**Por qué:** el legacy tuvo un error de un día al interpretar fechas capturadas como medianoche UTC.

## D-007 · Fotos en su propia tabla

**Decisión:** tabla `fotos` con `unique (ref_tipo, ref_id, indice)`; los archivos en Supabase Storage.
Las fotos pendientes de un cierre se calculan contra `bitacora.fotos_comprometidas`.
**Por qué:** conserva la garantía del legacy — un reintento nunca duplica una foto — sin guardar enlaces
concatenados en texto.

## D-008 · Históricos guardados al cierre

**Decisión:** al cerrar una obra se guardan su costo real por etapa (`historico_etapas`) y sus duraciones
reales por partida (`historico_duraciones`).
**Por qué:** el legacy los recalculaba desde cero en cada carga, y eso crece con el tiempo.

## D-009 · Lo que no se traslada

La hoja `Errores` (se reemplaza por un servicio de registro de errores), el sello `ULTIMO_CAMBIO` (Supabase
Realtime), los respaldos y el chequeo de salud del libro (respaldos del proveedor y restricciones de la base),
y los parches de Apps Script: candados, memoria por ejecución, numeración por última fila.

## D-010 · El dominio en español

**Decisión:** tablas, tipos y funciones del dominio en español sin acentos (`obras`, `espacios`, `etapas`,
`bitacora`); comentarios en español; textos visibles siempre por i18n.
**Por qué:** es el idioma del negocio y del legacy; traducir el dominio al inglés introduce errores de
significado.

## D-011 · Herramientas del repositorio

**Decisión:** Node 22.12 o más reciente (`.nvmrc` y `engines`), pnpm 10 fijo en `packageManager`, TypeScript
6.0 con `strict` y `noUncheckedIndexedAccess`, ESLint 9 con typescript-eslint y la configuración de Next,
Prettier, y Vitest 5 con cuatro proyectos: `unidad`, `paridad`, `rls` e `integracion`. La CLI de Supabase es
dependencia de desarrollo del repositorio. Los paquetes internos (`@ijm/core`, `@ijm/db`) se publican como
TypeScript sin compilar y Next los transpila.
**Por qué:** Node 20 dejó de tener soporte en abril de 2026. TypeScript 7 todavía no es compatible con
typescript-eslint (que pide menos de 6.1). `noUncheckedIndexedAccess` atrapa el error típico del legacy: leer
`fila[9]` de una columna que no existe. Con la CLI en el repositorio, todos usan la misma versión.
**Descartado:** instalar la CLI de Supabase de forma global; compilar los paquetes internos (un paso más sin
beneficio mientras solo los use `apps/web`).

## D-012 · La paridad carga el legacy construido, en Node, sin Python

**Decisión:** las pruebas de paridad cargan `legacy/app/App_Dueno.gs` y `App_PM.gs` en una máquina virtual de
Node (`packages/core/pruebas/paridad/legacy.ts`), con una simulación mínima de Apps Script y un "ahora"
controlable. Corren con `TZ=America/Chicago`.
**Por qué:** son los archivos que de verdad se publican. `legacy/correr_pruebas.sh` depende de rutas fijas de
Linux (`/tmp`, `/home/claude`) y de Python con openpyxl; el legacy es de solo lectura, así que no se adapta: se
reproduce su `harness.js` en TypeScript.

## D-013 · Columnas que el PM no debe ver

**Decisión:** el dinero siempre va en tablas propias (D-002). Las columnas que no son dinero pero que el PM no
debe ver, en tablas que sí lee (`configuracion`, `subcontratistas`, `empresas`, `entregas`,
`ordenes_cambio`), se le exponen mediante **vistas** con solo las columnas permitidas; la tabla completa queda
solo para dueño y administrador. Las vistas son `empresa_actual_datos`, `configuracion_pm`, `subcontratistas_pm`,
`entregas_pm` y `ordenes_cambio_pm`.
**Corregida en el paso 4:** la primera versión decía vistas `security_invoker`. Así no funcionan: una vista
`security_invoker` aplica el RLS del que consulta, y como el PM no puede leer la tabla completa, la vista le
devolvería cero renglones. Las vistas son del dueño de la base y **cada una filtra por sí misma** (la empresa de
la sesión y, donde aplica, las obras del PM). Por eso cada vista tiene su prueba en `pnpm test:rls`.
**Por qué:** RLS filtra renglones, no columnas. Partir cada tabla por cada columna sensible llena el esquema de
tablas de una sola fila; los permisos por columna (`GRANT` por columna) son frágiles con Supabase y fáciles de
romper al agregar una columna.
**Descartado:** permisos por columna; una tabla aparte por cada grupo de columnas que no son dinero.

## D-014 · Dos medidas por espacio: la cotizada y la verificada

**Decisión:** cada espacio guarda los pies² (y pies lineales) **cotizados**, capturados por el dueño en el alta,
y los **verificados** en sitio por el PM, con quién y cuándo. El PM los captura mediante una función del
servidor, que deja rastro en `correcciones`. Los costos unitarios usan la verificada cuando existe.
`presupuesto_etapas.cantidad` no se guarda: se calcula de la medida vigente.
**Diferencia con el legacy:** `pmMedida` sobrescribía `Areas.pies2` y la medida cotizada se perdía (solo quedaba
en `Correcciones`). El presupuesto copiaba los pies² al guardarse y quedaba desactualizado al corregirlos.

## D-015 · Traducción de los datos del catálogo y de los mensajes

**Decisión:** los nombres que captura cada empresa (partidas, etapas, tipos de espacio, puntos de control y sus
preguntas) se guardan con `nombre_es` y `nombre_en`; se muestra el del idioma del usuario y, si falta, el otro.
`packages/core` y la capa del servidor no devuelven textos: devuelven un **código con sus datos** (por ejemplo
`{ codigo: 'faltan', campos: ['cliente', 'fecha_entrega'] }`), y la pantalla los traduce con next-intl.
**Por qué:** regla 8 de `CLAUDE.md`: ningún texto visible queda fijo en el código. El legacy traducía en el
navegador con un diccionario (`idioma_en.py`), sin poder traducir lo que el dueño agregaba.
**Paridad:** se compara el código y sus datos contra el mensaje del legacy, no el texto.

## D-016 · Una empresa por usuario

**Decisión:** en las fases 1 a 3 cada usuario pertenece a una sola empresa (`miembros.user_id` es único).
`empresa_actual()` y `rol_actual()` se leen de `miembros` en cada consulta, para el usuario de la sesión, si el
miembro y su empresa están activos.
**Ajustada en el paso 3:** la primera versión leía la empresa y el rol de los datos de la sesión de Auth
(`app_metadata`). Se descartó porque esos datos viven en el token hasta una hora: un PM dado de baja seguiría
entrando. Leyendo `miembros`, la baja corta el acceso en ese instante, como en el legacy (`usuarioActivo_`).
**Por qué:** es lo que necesitan los contratistas piloto, y simplifica las políticas. Se puede ampliar a varias
empresas con un selector sin cambiar las tablas de negocio, porque todas llevan `empresa_id`.

## D-017 · Lo que ve el PM sigue al legacy

**Decisión:** donde el modelo de datos y el legacy no coincidían, manda el legacy:
- **Órdenes de trabajo:** el PM ve solo las emitidas, confirmadas y aprobadas. Nunca las pagadas ni las
  canceladas: el estado "pagada" revela pagos.
- **Órdenes de cambio:** el PM ve las autorizadas y las facturadas, con descripción, días de impacto y fecha
  de autorización; nunca costo, precio, margen, condición de pago ni fecha de cobro.
- **Avisos:** el PM ve solo los que él levantó, con su respuesta.

## D-018 · Llaves foráneas compuestas: la base impide cruzar empresas y obras

**Decisión:** cada tabla de negocio tiene `unique (empresa_id, id)` y se referencia con llaves compuestas
`(empresa_id, x_id)`. Lo que cuelga de una obra se referencia con `(obra_id, x_id)`, y las partidas desde un
espacio con `(espacio_id, partida_obra_id)`.
**Por qué:** RLS evita que un usuario **lea** otra empresa, pero no evita que un error del servidor **escriba**
un registro de la empresa A que apunte a algo de la B, ni un avance de una obra sobre la partida de otra. Con
llaves compuestas, la base lo rechaza. Cuesta un índice único más por tabla.
**Descartado:** llaves simples confiando en el servidor; disparadores de validación.

## D-019 · Metas de los indicadores en su propia tabla

**Decisión:** `metas_indicadores (empresa_id, indicador, meta)`. Sin renglón, vale la meta del legacy, que vive
en `packages/core`. Se conservan en `configuracion` `IMPUESTO` y `UMBRAL_OC_MENOR`, aunque el código del legacy
no los usa: están en su libro y el dueño los captura.
**Por qué:** solo 5 de las 19 metas estaban en Config (`META_*`, `MAX_*`); las demás estaban fijas en el código
(por ejemplo, PPC = 0.8). `CLAUDE.md` pide metas configurables.

## D-020 · Listas fijas como `enum`, con los valores del legacy

**Decisión:** estados y listas fijas son tipos `enum` de PostgreSQL, en forma canónica sin acentos
(`condicion_oculta`, `tarjeta_empresa`), traducidos al mostrarse (D-015). Los valores salen del código del
legacy y de sus pantallas: categorías de gasto, tipos de aviso, orígenes del punch list, motivos de orden de
cambio, conceptos y métodos de pago, causas de no calidad, motivos de "hoy no hubo trabajo".
**Cuidado:** a un `enum` se le pueden agregar valores, pero quitar uno exige una migración más cuidadosa.
Lo que cada empresa define (tipos de espacio, oficios, etapas, puntos de control) es tabla, no `enum`.

## D-021 · Lo que el legacy deducía del texto ahora son columnas

**Decisión:** `tipos_espacio.es_generales` (antes, el tipo se llamaba "Generales"); `oficios.requiere_licencia`
(antes, una expresión sobre el nombre del oficio); `hitos_calidad.exige_prueba_agua` (antes, el nombre empezaba
con "PC3"); `responsable` = `cuadrilla` / `pm` / `subcontratista` con su `oficio_id` (antes, el texto de
`quien`). Tipos de espacio, oficios, etapas y puntos de control son tablas con nombre en dos idiomas.
**Por qué:** con los nombres traducibles (D-015), deducir reglas del texto se rompe en cuanto alguien renombra
algo o lo escribe en inglés. **Paridad:** el importador de la fase 3 llena estas columnas con las mismas reglas
del legacy.

## D-022 · Ajustes al modelo propuesto

- **`espacio_id` en `gastos` y `mano_obra`**, con la partida opcional: un gasto sin partida va a Generales de
  obra, como en el legacy.
- **`bitacora_id` en `avance` y `mano_obra`:** anular un cierre encuentra sus registros por la llave, no por
  obra, día y usuario.
- **Un solo cierre vigente por obra y día**, con un índice único parcial. El legacy lo revisaba en el código.
- **`inspeccion_respuestas`**, una tabla hija con la respuesta a cada pregunta y su texto de ese día, en lugar
  de listas de defectos y de "no aplica" en texto.
- **La orden de cambio apunta al aviso** del que salió (`aviso_id`), y el aviso no apunta a la orden: la misma
  información en un solo sentido, sin llaves circulares.
- **`creado_por` es el miembro** que capturó el registro; quién lo hizo dentro de la empresa, no la cuenta de
  Auth.
- **Folios** solo donde una persona los lee o los cita: OB, BIT, GTO, BLQ, PUN, OT, PAG, OC, NC, COB.
  El cierre tardío del dueño ya no usa prefijos propios (BIA, AVA, MOA): con transacciones no hace falta.

## D-023 · El esquema de Drizzle se genera desde las migraciones

**Decisión:** las migraciones SQL son la fuente de verdad. `pnpm db:esquema` genera
`packages/db/src/esquema/generado/schema.ts` desde la base local (drizzle-kit pull) y corrige lo que el
generador deja mal (la referencia a `auth.users`, un archivo de relaciones inválido). Una prueba compara tablas,
columnas y nulos del esquema contra la base, y falla si alguien cambió una migración sin regenerarlo.
**Por qué:** escribir el mismo esquema dos veces, en SQL y en TypeScript, garantiza que tarde o temprano digan
cosas distintas. RLS, funciones y políticas solo se pueden expresar en SQL.
**Descartado:** escribir el esquema de Drizzle a mano; generar las migraciones desde Drizzle (no expresa RLS ni
las llaves compuestas con la claridad que hace falta revisar).

## D-024 · El PM entra con un PIN en un dispositivo verificado

**Decisión del dueño (decisión pendiente 2 del plan).** El dueño invita al PM por teléfono o correo; la primera
vez, el PM abre la invitación en **su** celular y ese dispositivo queda verificado. Ahí elige un PIN, y desde
entonces entra en ese celular solo con el PIN.
**Cómo se arma:** el PIN desbloquea la sesión de Supabase Auth guardada en ese dispositivo; no sirve en otro
aparato. Así el PM también puede abrir la app sin señal. Cuando hay conexión, el servidor revisa el PIN contra
su hash (`dispositivos.pin_hash`), con límite de intentos: 5 fallidos seguidos bloquean 15 minutos, como en el
legacy (un PIN de 4 dígitos sin límite se adivina). El dueño ve los dispositivos de cada PM y puede revocar uno
(`revocado_en`) sin tocar los demás.
**En la fase 1:** solo la tabla `dispositivos`. La invitación, la verificación y la entrada con PIN se construyen
con las pantallas del PM (fase 2). Los usuarios de prueba entran con correo y contraseña.
**Descartado:** código por mensaje cada vez (la señal en obra es mala); correo y contraseña (lento en el
teléfono, al final del día).

## D-025 · Permisos de base

**Decisión** (ajustada por D-026 en el mismo paso 4):
- `anon` (sin sesión) no tiene ningún permiso: ni tablas, ni vistas, ni funciones, ni secuencias.
- `authenticated` (la API) **solo lee**, siempre bajo RLS. Nunca crea, edita, borra ni vacía (`truncate`).
  Supabase daba por defecto todos los permisos a los dos roles, incluido `truncate`, al que RLS no aplica.
- `servidor_app` (D-026) crea y edita bajo RLS, y nunca borra: nada se borra (regla 4).
- **Lo que se cree después nace cerrado.** Los permisos por defecto de tablas, vistas, secuencias y funciones
  nuevas no dan nada a `anon` ni a la API. Cuidado: el permiso de ejecutar que toda función nueva da a PUBLIC
  es global, y `alter default privileges in schema public` no lo quita. Hace falta la forma sin esquema. Una
  prueba crea una función, una vista, una secuencia y una tabla dentro de una transacción revertida y revisa
  que nazcan cerradas.
- **El PIN** (`dispositivos.pin_hash`, intentos y bloqueo) no lo lee nadie por la API, ni el propio miembro: se
  da `select` solo sobre las demás columnas (D-024).
- **Paridad:** gastos y avisos se muestran al PM por quién los registró, no por obra, como en el legacy
  (`sinRecibo`, `bloqueos`). Se ven también los de obras ya entregadas.

## D-026 · Por la API solo se lee; toda escritura pasa por el servidor

**Contexto:** la revisión independiente del paso 4 encontró que, con políticas de escritura para
`authenticated`, el PM podía saltarse las reglas escribiendo directo por la API. Lo comprobó ejecutando cada
caso:
- una prueba de agua "sin fugas" cerrada en 60 segundos;
- una inspección aprobada sin preguntas;
- 48 horas de un trabajador en un día;
- un gasto de $9,999,999;
- folios elegidos por él (y apartados);
- el autor y la fecha del punch list cambiados;
- correcciones falsas en la auditoría.

El dueño también editaba sin dejar rastro. Esas reglas cruzan renglones o viven en `packages/core`: RLS no
puede expresarlas.

**Decisión:**
- Por la API (rol `authenticated`), los usuarios **solo leen**.
- **Toda escritura la hace el servidor de la app** después de validar con `packages/core`:
  1. se conecta a la base;
  2. en cada transacción toma el rol **`servidor_app`** (`set local role servidor_app`);
  3. toma la identidad del usuario (`request.jwt.claims` con su `sub`);
  4. escribe junto con su rastro en `correcciones`.
- **RLS sigue protegiendo esas escrituras.** Las políticas de escritura son `to servidor_app` y repiten la regla
  completa (empresa, obras del PM, `creado_por` = el miembro de la sesión, estados permitidos). Un error del
  servidor no deja escribir en la obra de otro PM, cruzar empresas, llevar una orden a "pagada" ni registrar una
  compra de la oficina a nombre del PM. PostgREST no puede tomar `servidor_app`: el rol `authenticator` no es
  miembro de ese rol.
- **La base asigna y protege:**
  - el folio lo pone siempre un disparador, y lo que mande el servidor se ignora;
  - `empresa_id`, `creado_por`, `creado_en` y `folio` no se pueden cambiar después;
  - una foto vive en la carpeta de su empresa y su obra y apunta a un registro de esa misma obra.
  - El importador (fase 3) conserva folios y autores del legacy con `set local ijm.importando = 'si'`.
- **Fotos:**
  - Los usuarios **suben** directo a Storage (pesan y la señal es mala), solo a la carpeta de su obra, con
    límite de 15 MB e imágenes o PDF.
  - **No las leen directo:** el servidor revisa que el usuario pueda ver la fila de `fotos` (RLS) y le da un
    enlace firmado de pocos minutos. Así un enlace no sobrevive a una baja ni a la entrega de la obra.
  - Los recibos de la oficina y las fotos de órdenes de cambio no se le muestran al PM aunque estén en la
    carpeta de su obra.
- **Registro abierto apagado** (`enable_signup = false`): los miembros entran por invitación (D-024).

**Por qué:** "RLS es la última línea de defensa, no la única". Con escritura directa por la API era la única, y
no alcanza para las reglas de negocio. Así, las reglas las valida el servidor y la base sigue impidiendo lo
peor aunque el servidor falle.

**Consecuencias para el paso 6:**
- las funciones del servidor usan `servidor_app` con la identidad del usuario, nunca el `service_role` para
  operaciones de usuarios;
- escriben su rastro en `correcciones`;
- dan los enlaces firmados de las fotos.

**Descartado:**
- mantener las políticas de escritura para `authenticated` y agregar disparadores para cada regla: duplica
  `packages/core` en SQL;
- escribir con el `service_role`: RLS dejaría de proteger las escrituras;
- funciones `security definer` por cada flujo: la lógica de negocio quedaría en SQL y no en `packages/core`.

## D-027 · Lo que el servidor puede hacer a nombre de un usuario (segunda revisión del paso 4)

**Contexto:** una segunda revisión independiente confirmó que por la API nadie escribe, lee dinero, ve obras
ajenas ni ve otra empresa. Encontró que, actuando como el servidor con la identidad de un usuario, la base dejaba
hacer más de lo que D-026 promete. Todo se corrigió en `20261004000200_endurecer.sql`, con una prueba por hallazgo
en `packages/db/pruebas/rls/servidor.test.ts`.

**Decisión:**
- **El servidor se conecta con su propio usuario de base, `ijm_servidor`, nunca con `postgres`.** El usuario no
  hereda nada por sí solo y solo puede tomar `servidor_app`, así que un `reset role` o un camino que olvide el
  `set role` se queda sin permisos en lugar de saltarse RLS. La contraseña la pone quien despliega.
- **La marca de importación (`ijm.importando`)** solo cuenta para una sesión sin rol de usuario (el importador
  con el service role, o una conexión administrativa), nunca para `servidor_app`. Al importar un folio, el
  contador avanza hasta él.
- **La base pone `creado_por` (el miembro de la sesión) y `creado_en` (ahora) al crear**, mande lo que mande el
  servidor. Nadie, ni el dueño, crea registros a nombre de otro ni con fecha inventada.
- **`obra_id` tampoco cambia después**, igual que empresa, autor, fecha de creación y folio. Corregir la obra de
  un registro es anularlo y volver a registrarlo. **Diferencia con el legacy:** su corrección permitía cambiar
  `proyecto_id` de un gasto o de la mano de obra.
- **Lo que el PM edita, vía servidor, es una lista cerrada de columnas por tabla:**
  - órdenes de trabajo: estado, confirmación, llegada y aprobación. La aprobación va a su nombre, y una orden
    nunca regresa de estado;
  - espacios: solo la medida verificada;
  - gastos: lo que el legacy dejaba corregir, y nunca uno ya revisado;
  - bitácora: incidencia y anulación, nunca el día, la hora de envío ni la marca de tardío;
  - avance, cuadrilla, pruebas de agua y punch list: lo suyo.

  El dueño no tiene lista: sus ediciones las valida el servidor y dejan rastro en `correcciones`.
- **Lo que el PM cuelga de otro registro** (partidas o subs de un cierre, respuestas de una inspección, fotos)
  tiene que colgar de algo suyo o visible para él.
- **`validar_foto` no sirve de oráculo:** revisa primero la empresa y las obras de la sesión, da un solo
  mensaje, y falla cerrado si aparece un tipo de foto nuevo sin su regla.
- **La empresa la activa o desactiva el sistema**, no el dueño ni el admin.
- **El PIN solo lo lee el service role**, tampoco el servidor.
- **Las vistas no se escriben** y ya no hay permisos por defecto para `servidor_app`: cada migración que cree
  una tabla le da los suyos.

**Aceptado, con su razón:**
- **Una URL firmada de subida dura 2 h** y sobrevive a una baja. Solo sirve para subir a la carpeta de su obra,
  no para leer, y lo que se suba no se registra en `fotos` sin pasar por el servidor.
- **`Prefer: count=planned` deja ver el tamaño aproximado de tablas ajenas,** también de las de dinero. Es la
  estimación del planificador de PostgreSQL. No revela ningún dato.
- **Los huecos en los folios revelan cuántos registros que el PM no ve hay en su empresa,** por ejemplo
  órdenes pagadas o compras de la oficina. Es el costo de folios legibles y seguidos (D-005).
- **`servidor_app` puede bloquear una tabla** (`lock table`) porque edita. El servidor es código propio, y con
  `ijm_servidor` una inyección no pasa de lo que `servidor_app` puede hacer.
- **Las llaves foráneas distinguen un uuid que existe de uno inventado.** Exige conocer el uuid, que nunca se
  muestra fuera de su empresa.

**Para el paso 6 (el servidor):**
- conectarse como `ijm_servidor`;
- en **cada** transacción, `set local role servidor_app` y fijar **las dos** variables de identidad:
  `request.jwt.claims` y `request.jwt.claim.sub`. `auth.uid()` lee primero la segunda; si quedara puesta de
  antes, mandaría sobre la primera;
- generar rutas de foto aleatorias, no predecibles;
- dar enlaces firmados de lectura de pocos minutos.

**Antes de producción** (no está en `config.toml`, se configura en el proyecto de Supabase):
- contraseñas con requisitos, cambio de contraseña seguro, confirmación de correo y MFA para dueño y admin;
- nunca cargar `supabase/seed.sql` (sus usuarios comparten una contraseña conocida);
- no instalar extensiones en el esquema `public`: lo que crea `supabase_admin` ahí nace abierto, y la prueba
  de "nace cerrado" solo cubre lo que crean las migraciones;
- Realtime: sin canales públicos.

## D-028 · El calendario laboral es de cada empresa: de lunes a sábado por defecto, con feriados opcionales

**Decisión del dueño:** en IJM se trabaja también el sábado, y los feriados se trabajan o no según se decida.
- `configuracion.dias_laborables`: los días de la semana que se trabajan (ISO: 1 = lunes … 7 = domingo). Por
  defecto, de lunes a sábado.
- `feriados (dia, nombre, se_trabaja)`: un feriado se descansa salvo que se marque `se_trabaja`.
- `packages/core` recibe el calendario como argumento (`calendario(dias, feriadosDeDescanso)`) en todo lo que
  cuenta días laborables: cronograma, fecha comprometida, atraso, "Esta semana", días sin cierre, y después la
  ventana del cierre tardío y el punch list.
- La semana de trabajo va de lunes a domingo. El legacy la cortaba el viernes (`masHab_(lunes, 4)`); con su
  calendario da lo mismo, porque una partida nunca termina en día no laborable.
- La semana del PM se pide con el número de días que se quiera mostrar. El legacy mostraba 5; con el sábado
  laborable conviene mostrar 6.

**Diferencia intencional con el legacy,** que solo contaba de lunes a viernes, sin feriados. La paridad se prueba
con `CALENDARIO_LEGACY` (lunes a viernes). El calendario real tiene sus propias pruebas en `packages/core/src`:
sábado laborable, feriados, y una obra que arranca en feriado.

**Ejemplo:** un baño que arranca el lunes 5 de octubre de 2026 sigue tomando 20 días laborables. Con el sábado
laborable se entrega el martes 27, en vez del viernes 30.

## D-029 · Cómo se prueba la paridad

**Decisión:** el legacy corre de verdad en una máquina virtual de Node (D-012) con dos fuentes de datos.
- **El libro de ejemplo** (`Gestion_Obra_IJM.xlsx`), leído con un lector propio de `.xlsx` (`zlib` de Node, sin
  dependencias), que deja las fechas como las dejaba `openpyxl`.
- **El mes simulado del legacy** (`legacy/sim/`): 5 semanas con 2 PMs y 4 obras. Corre en una copia temporal, con
  las rutas corregidas como en `correr_pruebas.sh`. En esa copia, el reloj simulado guarda una foto de todas las
  hojas al terminar cada día: 31 días, con obras arrancando, a medias, atrasadas y entregadas. El resultado se
  guarda en caché mientras el legacy no cambie. Si el reporte del mes deja algún hallazgo (su propia prueba
  exige cero), la paridad se detiene.

Las hojas del legacy se convierten a las entradas de `packages/core`
(`packages/core/pruebas/paridad/convertir.ts`) con las mismas reglas de lectura del legacy. Así se adelanta lo
que hará el importador de la fase 3: renglones anulados fuera, espacio deducido para registros viejos, y oficio
de cada partida ligado al oficio de sub que empata por texto.

**Se comprobó que las pruebas tienen dientes:** dos cambios pequeños en `packages/core` hicieron fallar 5 pruebas
de paridad.

**Aprendido:** la primera versión del lector de `.xlsx` dejaba vacías las hojas con un renglón en blanco en medio
(entre ellas `Trabajadores`), y el mes simulado lo delató con un hallazgo. Quedó una prueba para eso.

## D-030 · Avance esperado el día de inicio: el legacy tenía un error

**Diferencia conocida con el legacy:** el día de inicio de una obra, el legacy da 0 % de "avance esperado" antes
del mediodía y 1/n después. Guarda la fecha de inicio a las 12:00 y la compara con la hora actual, así que el
resultado depende de la hora a la que se abra el tablero. `packages/core` trabaja con días, no con horas, y da
1/n todo el día.

**Confirmado por el dueño:** es un error del legacy y se queda la versión nueva. La prueba de paridad acepta la
diferencia solo en ese caso exacto, y compara también a las 13:00, donde las dos versiones coinciden en todo.

## D-031 · La cuadrilla se cuesta con la tarifa vigente el día que trabajó

**Diferencia intencional con el legacy:** el legacy multiplicaba todas las horas por la tarifa **actual** del
trabajador, así que un aumento cambiaba el costo de las obras pasadas, sus desvíos y los costos unitarios con los
que se cotiza. `tarifas_trabajador` guarda la historia (`vigente_desde`), y `tarifaDelDia` toma la última vigente
a la fecha del registro.
**Paridad:** con una sola tarifa por trabajador, vigente desde siempre (que es lo que el legacy guardaba), las dos
versiones coinciden en cada costo. La historia de tarifas tiene sus propias pruebas en `packages/core/src`.

## D-032 · Montos como número, comparados con 6 decimales en la paridad

**Decisión:** en `packages/core` los montos son `number` en dólares, igual que en el legacy; la base los guarda en
`numeric(12,2)` y el servidor los convierte. Las sumas se hacen en el mismo orden que el legacy. La paridad
compara redondeando a 6 decimales para que el último bit de punto flotante no cuente como diferencia; lo que se
muestra se redondea al mostrarse.
**Descartado por ahora:** trabajar en centavos enteros. Si en la fase 3 aparece una diferencia de un centavo en
algún reporte, se revisa esta decisión.

**Aprendido en el paso 5b:**
- La paridad encontró una regla que faltaba: en una **obra cerrada** no se agregan ni se quitan partidas, y
  quitar una pide **motivo** (`exigirObraAbierta`, `falta_motivo`).
- Una regla que los datos nunca ejercitan no la detecta la paridad: un cambio en el peso por omisión de una
  partida pasó sin que ninguna prueba de paridad fallara, porque todas las partidas del legacy traen peso. Para
  eso están las pruebas de unidad.

## D-033 · Validaciones y calidad: los códigos y lo que cambia con el calendario

**Decisión:** las reglas de captura y de calidad viven en `packages/core` (`validaciones.ts`, `calidad.ts`) y
rechazan con un código y sus datos (D-015), en el mismo orden en que revisaba el legacy, para que el usuario
reciba el mismo primer problema. La paridad traduce cada mensaje del legacy a su código y compara caso por caso:
- **el alta de obra**, con las 128 combinaciones de campos faltantes;
- **la cuadrilla**, con cada trabajador y varias cantidades, en días reales del mes simulado;
- **el cierre del día y el cierre tardío**, del PM y del dueño;
- **las inspecciones, la prueba de agua y las fotos críticas.**

Cada prueba exige además que cada tipo de rechazo haya ocurrido al menos una vez: lo aprendido en D-032.

Los códigos son estos:
- **Alta de obra:** `faltan` (con los campos, en orden), `telefono_incompleto`, `pm_no_activo`,
  `entrega_antes_del_inicio`, `sin_espacios`, `faltan_pies2`, y la confirmación `obra_duplicada`.
- **Cuadrilla:** `cuadrilla_dia_o_medio`, `cuadrilla_pasa_un_dia`, `cuadrilla_pasa_16_horas`.
- **Cierre del día:** `obra_sin_presupuesto`, `falta_motivo_sin_trabajo`, `falta_foto`, `faltan_partidas`,
  `orden_de_otra_obra`, `falta_inspeccion`.
- **Cierre tardío:** `fuera_de_ventana`, `dia_ya_cerrado`. El del dueño suma `obra_cerrada`, `falta_motivo`,
  `falta_dia`, `solo_dias_anteriores` y `antes_del_inicio`.
- **Calidad:** `inspeccion_sin_foto`, `hito_sin_preguntas`, `ninguno_aplica`, `falta_prueba_agua`,
  `prueba_sin_foto`, `prueba_en_curso`, `prueba_incompleta`.

**Diferencias con el legacy:**
- **La ventana del cierre tardío** son los últimos 2 días **laborables del calendario de la empresa** (D-028).
  Con sábado laborable, el lunes el PM puede cerrar el sábado y el viernes; un feriado de descanso no gasta la
  ventana.
- **Una pregunta de inspección se identifica por su id**, no por su texto. La respuesta guarda el texto de ese
  día (D-022).
- **El PC3** se reconoce por `hitos_calidad.exige_prueba_agua`, no por el nombre (D-021).
- **No se traslada** el formato anterior del teléfono para las inspecciones (solo conteos, sin la lista de
  preguntas): el servidor siempre cuenta contra la lista real.
- **Las validaciones de los demás formularios** (orden de trabajo, orden de cambio, cobro, compra de la oficina,
  garantía, no calidad, subcontratista, trabajador, gasto del PM) usan el mismo `exigir`. Se trasladan con sus
  flujos en el paso 6 y la fase 3.

## D-034 · Los 19 indicadores

**Decisión:** `packages/core/src/indicadores.ts` calcula los 19 indicadores del legacy (`kpis_`), con la misma
regla, la misma meta y el mismo semáforo. Cada indicador sale con su clave, su proceso (P3 a P6), su valor, su
meta, su dirección, su semáforo, si todavía no hay datos y si es de los seis del lunes. Los textos que explican
qué revela cada uno son de la pantalla y se traducen (D-015); `core` solo agrega los datos que esos textos
necesitan (horas del plazo, costo de las garantías, días perdidos).

**Metas:** cada indicador tiene la del legacy por omisión (`METAS_POR_OMISION`), y la empresa puede cambiarla en
`metas_indicadores` (D-019). Dos se toman de la configuración: las horas de respuesta a avisos (el plazo de los
avisos) y el margen de las órdenes de cambio (el margen mínimo).

**Con el calendario de la empresa (D-028):** la tasa de cierre cuenta los días laborables de la última semana,
sábado incluido.

**Paridad:** contra el tablero del legacy en cada día del mes simulado y en el libro de ejemplo, a las 10:00 y a
las 21:00 (varios indicadores dependen de cuántas horas han pasado). Coinciden los 19 en valor, meta, semáforo,
"sin datos" y "principal". La prueba exige además que cada indicador haya medido algo distinto de cero en algún
caso. "Reseñas obtenidas" nunca lo hacía (en el mes simulado nadie registra una reseña), así que se agregó una
variante del último día con reseñas recibidas.

**Diferencia conocida, de los datos de ejemplo:** en el libro de ejemplo, escrito a mano, el aviso BLQ-0001 trae 3
horas de respuesta tecleadas, pero sus fechas de apertura y respuesta son el mismo día sin hora. El legacy promedia
las horas guardadas; `core` las calcula con las fechas (no hay columna de horas en el modelo nuevo). En el mes
simulado, donde el legacy guarda las horas al responder, coinciden siempre.
**Para el importador (fase 3):** si un aviso del legacy trae horas de respuesta pero sus fechas no tienen hora,
reconstruir la hora de respuesta como apertura + horas guardadas, para no perder el dato.

## D-035 · La capa del servidor

**Decisión:**
- **Dónde va:** en `packages/servidor`, un paquete propio y no dentro de `apps/web`. Así se prueba contra la base
  sin levantar Next, y en la fase 2 cada pantalla la llama con una envoltura delgada.
- **Cómo escribe** (D-026, D-027): se conecta como `ijm_servidor` y cada operación es una transacción
  (`enNombreDe`). En ella toma `servidor_app`, fija las dos variables de identidad del usuario, lee con su RLS,
  valida con `packages/core` y escribe. Si algo falla, no queda nada a medias.
- **Las entradas:** se validan con Zod. Un dato mal formado es `datos_invalidos`, con cada campo y su problema;
  las reglas son de `core`.
- **"Ahora":** cada flujo lo recibe como argumento opcional, igual que `core`, para que las pruebas sean
  repetibles.
- **Los días de negocio** llegan de la base como texto `AAAA-MM-DD`: la conexión desactiva la conversión de
  `date` a `Date`, que daría la medianoche UTC, el día anterior en Austin (regla 5).

**Los flujos:**
- **`crearObra`:** solo el dueño o el administrador. Crea la obra con su folio, el contrato, Generales primero y
  la copia de partidas de cada espacio. Un espacio sin nombre toma el de su tipo.
- **`guardarPresupuesto`:** solo el dueño. **Decisión del dueño:** nada se borra; una etapa que ya no viene queda
  en $0. Cada monto que cambia deja rastro en `correcciones`, y la obra pasa entre "sin presupuesto" y "lista
  para arranque" según quede completo. **Diferencia con el legacy:** una obra entregada ya no se presupuesta.
- **`cerrarDia`:** solo el PM, en sus obras. Valida en el orden del legacy y escribe todo junto: bitácora,
  partidas, subs que llegaron (una orden emitida que llega se confirma), avance sin repetir estado, cuadrilla, y
  el arranque de la obra con su primer día de trabajo.
  - **Diferencias con el legacy:** un solo cierre por obra y día (D-022); una partida "terminada" tiene que ser
    del día; la cuadrilla sin partida va a la primera partida del día.
  - **El tope de cuadrilla cuenta las horas de todas las obras de la empresa** con `cuadrilla_del_dia`
    (solo cantidades, sin tarifas), aunque una sea de otro PM que este no puede leer.
- **`rutaParaFoto` y `registrarFoto`:** una ruta aleatoria en la carpeta de la empresa y la obra; el teléfono
  sube directo a Storage. Al registrarla se comprueba, con `foto_subida`, que el archivo existe y que lo subió
  ese usuario. Un reintento con el mismo número devuelve la misma foto, y la foto de un cierre tiene que ser una
  de las comprometidas.
- **`enlaceDeFoto`:** un enlace firmado de 5 minutos, solo si el usuario puede ver la foto. Lo firma el service
  role, que solo se usa para eso.
- **`corregir`, `anular` y `anularCierre`:** reglas en `core/correcciones.ts`. El PM, lo suyo y en 48 h;
  el dueño, sin límite y también cobros y pagos; nada en obras cerradas; siempre con motivo y con un renglón
  por campo en `correcciones`.
  - Si cambia la partida, el registro se muda con ella a su espacio.
  - Si cambian las horas, se vuelve a revisar el tope del día.
  - Un pago anulado regresa su orden a "aprobada".
  - **Anular un cierre** anula la bitácora y el avance y la cuadrilla registrados con ella (por `bitacora_id`, no
    por obra, día y usuario como el legacy).

**Lo que necesitó la base** (`20261006000100_servidor.sql`): que el PM pueda arrancar su obra (solo de "lista
para arranque" a "en obra"), `cuadrilla_del_dia` y `foto_subida`. En los datos de prueba (solo local), la
contraseña de `ijm_servidor`.

**Para la fase 2:** verificar la sesión es de la capa web. Las funciones de este paso reciben al usuario ya
identificado (`{ userId }`); la página toma su `userId` del token de Supabase verificado (y después, del PIN del
dispositivo, D-024). Faltan también los flujos que el plan deja para después: el cierre tardío del dueño, gastos,
avisos, inspecciones, órdenes de trabajo y de cambio, cobros, entrega y cierre de obra.

**Aprendido:** las pruebas encontraron un error en el primer intento: un espacio sin nombre tomaba el **id** de su
tipo en vez de su nombre.

## D-036 · Dónde vive la app

**Decisión del dueño:** Supabase y Vercel, en Estados Unidos. El producto se llama **J Solutions**.
- **Supabase**, en us-west-2 (Oregón), donde el dueño creó el proyecto; una vez creado, no se cambia. Son dos
  proyectos: "pruebas" (plan gratuito, para las vistas previas de cada pull request) y "producción". El plan
  gratuito pausa el proyecto sin uso y no guarda respaldos diarios: ver abajo cuándo se paga.
- **Vercel**, con sus funciones en pdx1 (Portland), junto a la base, porque cada operación hace varias
  consultas. Cada pull request genera su vista previa contra el proyecto "pruebas".
- **Los correos** (la invitación del PM, decisión 2 del plan de la fase 2) salen por Resend con el dominio
  propio. El correo que trae Supabase es solo para pruebas.
- **Los secretos** (la contraseña de `ijm_servidor`, la llave del service role) viven en las variables de
  Vercel, nunca en el repositorio. Cada proyecto tiene su propia contraseña de `ijm_servidor`, distinta de la
  local.
- **El dueño crea las cuentas.** El dominio está por comprarse.
- **Se empieza gratis** (decisión del dueño): Supabase y Vercel en sus planes gratuitos mientras se desarrolla.
  Se pasa a pago cuando haga falta, no antes:
  - **Vercel Pro**, cuando la app la use la empresa de verdad (el piloto), porque el plan gratuito no permite
    uso comercial.
  - **Supabase Pro**, cuando lleguen al límite gratuito (500 MB de base, 1 GB de archivos: las fotos son lo
    primero que crece) o cuando haya datos reales sin otro respaldo. Mientras tanto, un respaldo propio cada
    noche (`pg_dump`) cubre la falta de respaldos diarios. El proyecto se pausa tras una semana sin uso; en el
    piloto se usa a diario.

## D-037 · La base de la app

**Decisión:**
- **El idioma no va en la dirección** (nada de `/es/...` o `/en/...`): la PWA abre siempre en `/`. Manda el
  idioma que eligió el usuario (una cookie); si no eligió, el del teléfono; si no, español. En el paso 2 se
  guarda también en el miembro, para que lo siga en otro dispositivo.
- **Los textos** viven en `apps/web/mensajes/`, uno por idioma, con tipos: una llave que no existe no
  compila. ESLint rechaza texto fijo en las pantallas y una prueba exige las mismas llaves en los dos idiomas.
- **El cambio de idioma es un formulario**, no un botón con JavaScript: funciona aunque la página no haya
  terminado de cargar, con poca señal.
- **El ícono** es la J sobre el color de la marca, generado en el código, hasta que haya un logo.
- **El service worker** por ahora solo hace instalable la app; la cola sin señal es el paso 5.
- **@swc/core se fija en 1.16.2.** next-intl lo trae, y desde 1.16.12 no carga en Windows si la carpeta de su
  caché da permisos a otros usuarios, como pasa en esta computadora. En Linux (la integración continua y
  Vercel) no pasa. Se quita la fijación cuando lo corrijan.

## D-038 · Entrar: la invitación, el celular verificado y el PIN

**Decisiones del dueño:** mientras no haya dominio, la invitación se manda con un botón **Copiar** (o
**Compartir**) por WhatsApp, mensaje o correo. El dueño también entra con PIN, de **6 dígitos**.

**Cómo funciona** (completa D-024):
- **La invitación.** El dueño da de alta al PM (nombre, correo e idioma) y la app le da un enlace que sirve una
  sola vez, por 7 días. La base guarda solo el hash del token. Una invitación nueva anula la que no se usó.
  Se canjea con un botón y no al abrir el enlace: WhatsApp abre los enlaces para mostrar su vista previa, y eso
  gastaría la invitación.
- **El celular verificado.** Al canjear, el servidor genera una llave al azar (32 bytes). El celular la guarda
  en una cookie de 400 días y la base guarda su hash. El servidor abre la sesión de Supabase Auth del invitado
  con un enlace mágico que genera y canjea en ese momento, sin mandar ningún correo. Las cookies de la sesión
  son httpOnly: el JavaScript de la página no ve los tokens.
- **El PIN** se cifra (bcrypt) **junto con la llave del celular**: sin el celular, el PIN no sirve, y con la base
  sola no se puede adivinar. El PM usa 4 dígitos y el dueño o administrador 6. No se aceptan un dígito repetido
  ni una escalera (1234, 9876). El PIN abre la sesión por 16 horas al PM y 12 al dueño, como el legacy
  (`HORAS_SESION`). 5 intentos fallidos seguidos bloquean 15 minutos, también como el legacy. La función que
  revisa el PIN no lanza error por un PIN equivocado: devuelve el resultado, para que la transacción guarde el
  intento fallido.
- **En cada página** se revisan juntas, en una transacción de la base, tres cosas: la sesión de Auth, la llave
  del celular y el PIN abierto (`estado_dispositivo`). También se revisa que el miembro y su empresa sigan
  activos.
- **Quitar un celular o dar de baja** corta el acceso en ese instante. Al quitar un celular también se cierra
  su sesión de Auth, como refuerzo. A quien olvidó su PIN se le manda una invitación nueva, que es otro
  celular verificado.
- **Un celular (un navegador) es de una sola persona.** Canjear en él la invitación de otro miembro reemplaza la
  llave del anterior, que pierde el acceso ahí; su cuenta sigue intacta. Pasó en el piloto: el dueño abrió en su
  celular la invitación de un PM. Desde entonces, la invitación avisa a quién le quitaría el celular antes de
  canjearse. Y si el dueño ya no puede entrar a Equipo para reinvitarse, quien administra la plataforma genera
  la invitación con `packages/servidor/scripts/invitar-de-nuevo.ts --correo …`, conectado directo a la base. Para usar
  la app como dos personas en un mismo teléfono hacen falta dos navegadores (en iPhone, la app instalada y
  Safari guardan cookies distintas).
- **Todo pasa por funciones de la base** (security definer), que solo puede ejecutar `servidor_app`. Nadie
  escribe directo en `miembros`, `dispositivos` ni `invitaciones`. Nadie lee la llave, el PIN, los intentos ni
  el token: ni la API ni el servidor.
- **El alta de una empresa** con su dueño la hace quien administra la plataforma, con
  `packages/servidor/scripts/alta-empresa.mjs`: crea el usuario en Auth con la llave secreta y la empresa con
  `alta_empresa`, que nadie de la app puede ejecutar, conectado directo a la base. Ningún usuario da de alta
  empresas en las fases 1 a 3.

**Diferencia con lo planeado:** el PIN no lo revisa el service role (D-027) sino una función de la base. Así
ningún código de la app toca el hash del PIN, y el límite de intentos no se puede saltar con dos peticiones al
mismo tiempo, porque la función bloquea el renglón mientras revisa.

**Límites conocidos** (para la revisión independiente del paso 7):
- ~~La API de Supabase (PostgREST) revisa la sesión de Auth, pero no el PIN ni el celular.~~ **Cerrado al
  terminar la fase 2** (revisión del paso 7b): el límite era más amplio de lo que decía aquí. Una sesión de Auth
  se consigue también pidiendo un código al correo del miembro, sin celular ni PIN, y dura lo que su token de
  renovación; ni "Salir", ni el PIN vencido, ni quitar el celular la cortaban para la API. Con ella se podía leer
  todo lo que el rol ve (el dueño, todo el dinero). La app nunca usó esa API (todo pasa por el servidor, y las
  fotos por Storage), así que **se apagó la API de datos en la nube** (Data API, con GraphQL), y los scripts de
  administración se conectan directo a la base (`DATABASE_URL`). Una sesión de Auth sola ya no lee nada. El
  límite de tiempo de las sesiones de Auth es del plan Pro de Supabase; con la API apagada no hace falta.
  "Salir" no cierra la sesión de Auth a propósito: el PIN la vuelve a abrir en ese celular; cerrarla obligaría a
  pedir una invitación nueva.
- Sin señal, el PIN del teléfono (paso 5) será solo un candado local: los datos no llegan a la base sin la
  revisión del servidor.

## D-039 · El catálogo de cada empresa sale de su propio libro

**Decisiones del dueño:**
1. El catálogo de IJM es **solo de IJM**. No hay una plantilla estándar: una empresa nueva nace vacía, y arma
   su catálogo con las pantallas del dueño (fase 3) o carga el de su propio libro.
2. Los datos de la empresa piloto se cargan **desde su libro del sistema actual con un script**.
3. La obra piloto se da de alta con una **pantalla mínima** "Nueva obra + presupuesto".

**Cómo se carga el libro.** El dueño descarga su Google Sheet como .xlsx, y quien administra la plataforma corre
`packages/servidor/scripts/cargar-libro.ts`, conectado directo a la base (D-038). El script convierte el libro con
`importar/libro.ts` y la base lo guarda con `cargar_libro`, una función que nadie de la app puede ejecutar:
- **Qué se carga:**
  - el catálogo: tipos de espacio, partidas con su peso, días, responsable, paralelo, espera, etapa y punto de
    control, las etapas, los oficios y los puntos de control con sus preguntas;
  - la configuración (impuesto, límite de compra, plazos);
  - las metas que difieren de las del legacy;
  - los subcontratistas con sus papeles;
  - la cuadrilla con su tarifa.
- **Las reglas de lectura del legacy:**
  - "SI" es sí;
  - "Generales" es "Generales de obra", y siempre va primero;
  - el oficio de una partida se empata con el de un sub por texto contenido en el otro;
  - la licencia la piden plomería, electricidad y aire acondicionado (`requiereLicencia_`);
  - PC3 exige la prueba de agua;
  - un renglón sin su id (`sub_id`, `trabajador_id`) es una nota, no un registro.
- **Primero muestra y después carga.** Sin `--confirmar` solo muestra lo que cargaría. Un dato que no se
  entiende detiene todo y se reporta con su hoja y su número de renglón, para corregirlo en Google Sheets.
- **Todo o nada, y una sola vez.** Una empresa que ya tiene catálogo, subcontratistas o cuadrilla se rechaza
  (`empresa_con_catalogo`): cargar dos veces duplicaría todo. Lo que haya que corregir después se corrige en las
  pantallas del dueño.
- **La tarifa del libro vale desde el 2000-01-01**, porque el libro no guarda su historia. El costo de cada día
  se calcula con la tarifa vigente ese día (D-031).
- **Los nombres en inglés quedan vacíos**: se muestra el español hasta que el dueño los capture (D-015).
- **Los acentos se ponen al cargar.** Los libros de antes del cambio de acentos traen los nombres sin acentos
  ni ñ ("Bano", "Plomeria"), como el libro real de IJM. El legacy los mostraba corregidos con un mapa exacto
  (`legacy/app/acentos.py`); el cargador los guarda ya corregidos con el mismo mapa (`importar/acentos.ts`), más
  dos etapas que le faltaban. Una prueba quita los acentos al libro de ejemplo y exige el mismo resultado.
- **Los libros con datos reales no van al repositorio**: `.gitignore` excluye los `.xlsx` de la raíz.

**La plantilla estándar de datos iniciales** (decisión del dueño): todo negocio nuevo ordena sus datos en el mismo
libro, `docs/plantilla/Plantilla_datos_iniciales_J_Solutions.xlsx`, y se carga con el mismo script. La genera el
código (`importar/plantilla.ts`, `pnpm plantilla`), y una prueba la llena con sus ejemplos y la carga; otra exige
que el archivo esté al día.
- **Las mismas hojas y el mismo orden de columnas que el libro del sistema actual**: un solo lector sirve para los
  dos formatos. El lector reconoce la plantilla por `Config → PLANTILLA`.
- **Lo que solo trae la plantilla:**
  - los nombres en inglés de partidas, preguntas y feriados;
  - la columna "Exige prueba de agua" (en el legacy era la regla de PC3);
  - `DIAS_LABORABLES`;
  - la hoja de feriados;
  - las hojas Empresa y Equipo, que no se cargan: son los datos del alta y de las invitaciones.
- **En la plantilla todo renglón con datos es un registro**, y si le falta algo se reporta. En el legacy, un
  renglón sin id era una nota.
- **Los renglones de ejemplo** (grises, empiezan con EJEMPLO) nunca se cargan.
- **Una plantilla sin partidas** se rechaza con `libro_sin_partidas`.
- El libro se escribe sin dependencias (`importar/escribir-xlsx.ts`), igual que se lee. Se probó que también lo
  abre openpyxl.

**Por qué no el importador completo:** el importador de la fase 3 trae además las obras, su historia y el
dinero. Para el piloto basta con el catálogo y los datos de la empresa, porque la obra piloto se da de alta a
mano (decisión 4 del plan de la fase 2). El lector del .xlsx se mudó a `packages/servidor/src/importar/`, donde
lo usarán los dos.

## D-040 · El inicio del PM

**Decisión:** el inicio del PM sigue al legacy (`construirDatos_`) en lo que muestra, y lo calcula con
`packages/core`:
- el avance ponderado (`avanceDeObra`);
- la entrega comprometida (`fechaComprometida`, que suma los días de las órdenes de cambio autorizadas) y la
  prevista (`cronogramaObra`);
- la semana (`semanaDelPM`, con seis días laborables, sábado incluido);
- los días sin cerrar (`diasSinCierre`);
- la racha (`rachaDeCierres`, nueva).

Lo lee con la identidad del PM, bajo RLS, y nada de dinero del negocio: de las órdenes de cambio, solo la
descripción y los días.

**La racha sigue el calendario de la empresa.** El legacy solo saltaba sábado y domingo; aquí no la cortan los
días que la empresa no trabaja, incluidos sus feriados (D-028).

**Lo suyo en obras ya entregadas.** El PM deja de ver una obra al entregarse (D-017), con sus fotos y sus
cierres. Pero sus avisos y sus gastos se siguen viendo (D-025), y su racha cuenta todos sus cierres. Para
calcular "sin recibo" y la racha sin abrirle esas obras, dos funciones de la base contestan solo eso, del miembro
de la sesión: `mis_gastos_sin_recibo()` y `mis_dias_cerrados()` (`20261009000100_inicio_pm.sql`). Antes de
ellas, el inicio mostraba como "sin recibo" un gasto que sí lo tenía, porque el PM ya no podía ver esa foto: lo
encontró la prueba. Un aviso o gasto de una obra que ya no ve se muestra sin su folio.

## D-041 · Cerrar el día desde el celular

**Decisión:** la pantalla de cierre usa el flujo de la fase 1 (`cerrarDia`), que ya valida en el orden del
legacy. Lo nuevo es cómo se captura y cómo llegan las fotos.
- **La captura:**
  - las partidas que van en curso vienen marcadas;
  - una partida se marca terminada solo si se trabajó;
  - si su punto de control no tiene la inspección aprobada, la pantalla lo dice en vez de ofrecer "terminada"
    (la regla sigue en `exigirInspecciones`);
  - a la cuadrilla se le anotan horas, o día y medio día según cómo cobra;
  - al sub esperado, "llegó" o "no llegó";
  - "Hoy no hubo trabajo" pide el motivo.
- **Las fotos se comprimen en el teléfono** (1600 px, JPEG al 75 %) y se suben **después** de guardar el
  cierre, una por una con su número (D-007). La que falla se reintenta sin repetir las demás.
- **Las fotos pasan por el servidor.** El navegador no tiene los tokens de la sesión (cookies httpOnly, D-038),
  así que una acción del servidor sube el archivo a Storage con la sesión del PM y lo registra
  (`rutaParaFoto`, `registrarFoto`). Las reglas de Storage siguen valiendo. El tope de una petición es 4 MB, y
  una foto comprimida pesa unos cientos de KB.
- **El cierre no vuelve a pintar la página.** Si lo hiciera, la pantalla vería el día ya cerrado y quitaría el
  formulario a media subida de fotos. Pasó en la prueba en el navegador.

**Pendiente para el paso 5 (la cola sin señal):** si el PM sale de la pantalla antes de que suban sus fotos,
esas fotos se pierden y el cierre queda con fotos comprometidas sin subir. La cola las guardará en el teléfono.
La cuadrilla va a la primera partida del día, como en la fase 1; anotarla por partida queda para después, si el
piloto lo pide.

## D-042 · La clave de envío de un cierre

**Decisión:** el teléfono le pone a cada cierre una clave al azar al capturarlo (`bitacora.clave_envio`, única
por empresa). Si el servidor guardó el cierre pero la respuesta no llegó al teléfono, el reintento llega con la
misma clave y recibe ese mismo cierre: no lo duplica ni choca con "ese día ya está cerrado", aunque llegue al día
siguiente. Otro cierre del mismo día con otra clave sí es un segundo cierre, y se rechaza (D-022). Las fotos de
la cola encuentran su cierre por su clave (`cierreDeClave`): no necesitan esperar el id de la bitácora.

## D-043 · La cola en el teléfono

**Decisión:** lo que el PM captura va primero al teléfono (IndexedDB, que sobrevive a cerrar la app y guarda
las fotos) y de ahí se envía, con las reglas del legacy (`procesarCola`, `prueba_cola.js`):
- **en orden**, uno por uno, y las fotos de un cierre detrás de él;
- **un error de red** no descarta nada: se cuenta el intento, y lo de atrás espera;
- **un rechazo de negocio** sale de la cola con sus fotos y se le muestra al PM con su razón, hasta que lo da
  por visto; lo de atrás sigue;
- **una sesión vencida** detiene la cola sin perder nada. Las acciones de la cola no redirigen: contestan
  `sesion`, y la cola espera a que el PM escriba su PIN.

**Cuándo se envía:** el cierre, en el momento; si una regla lo rechaza, se corrige ahí mismo en el formulario.
Sin señal o con la sesión vencida, el cierre y sus fotos van a la cola. Las fotos de un cierre enviado siempre
van a la cola. La cola se envía al abrir el inicio, al volver la señal (evento `online`) y cada 30 segundos
mientras quede algo. En el inicio se ve cuánto falta y hay un botón "Enviar ahora". Safari en iPhone no envía
en segundo plano, así que la cola avanza cuando la app está abierta.

**Las reglas de la cola** son una función pura (`apps/web/lib/cola.ts`) con sus pruebas, que incluyen los casos
de `prueba_cola.js`. IndexedDB, el envío y la pantalla van aparte.

## D-044 · Corregir un cierre

**Decisión del dueño** (lo pidió al probar el piloto): el PM corrige su cierre si se equivocó o le faltó algo.

**Cómo funciona:**
- **Dentro de 48 horas**, solo el suyo, como el legacy. "Corregir" abre el mismo formulario lleno con lo que
  capturó; cambia lo necesario, agrega lo que faltó y escribe qué corrigió.
- **En el servidor** (`corregirCierre`), en una transacción: el cierre se **anula** con su motivo
  (`anularCierre` de la fase 1, que revisa las 48 h y el autor), y se **vuelve a cerrar el mismo día** con lo
  corregido. Nada se borra: el anterior queda anulado, con su cuadrilla y su avance, y el rastro en `correcciones`.
- **Las fotos no se mueven.** Un archivo se registra una sola vez (`fotos.storage_path` es único), así que las
  fotos se quedan en el cierre donde se subieron. El cierre nuevo dice a cuál corrige (`bitacora.corrige_a`). Sus
  fotos son las suyas y las de la cadena que corrige (`fotosDelCierre`), y cuentan para la regla de "al menos
  una foto". Las fotos nuevas se suben al cierre nuevo por la cola.
- **Necesita señal.** A diferencia del cierre, la corrección no va a la cola: el PM tiene que ver en el momento
  si se aceptó.
- La pantalla ofrece otra vez lo que registró ese cierre: sus partidas terminadas y los subs que reportó
  (`datosParaCierre` con `corrige`).

## D-045 · Agregar un espacio a una obra

**Decisión del dueño:** a una obra que ya existe se le agregan espacios desde su presupuesto (legacy:
`duAgregarArea`). `agregarEspacio` lo pone al final, con las partidas de su tipo, y su presupuesto se captura ahí
mismo. Solo el dueño o el administrador; nunca en una obra entregada, nunca otro "Generales de obra", y siempre
con pies², como en el alta. El presupuesto incompleto no cambia el estado de una obra que ya arrancó.

**Lo que sigue, también pedido por el dueño:** crear desde la app tipos de trabajo nuevos (piso de cemento, masa
y pintura…) con sus partidas, en una pantalla de Catálogo aparte del presupuesto, porque son plantillas que se
usan en muchas obras.

## D-046 · El catálogo desde la app

**Decisión del dueño:** el dueño arma sus tipos de obra (piso de cemento, masa y pintura…) en una pantalla de
Catálogo, aparte del presupuesto. En pantalla se llaman **tipos de obra**, como en el legacy: en el código, "tipo de
trabajo" es una etapa.

**Qué se puede hacer** (`catalogo.ts`, solo el dueño o el administrador):
- **Un tipo nuevo en blanco** (legacy: `duCrearTipo`): su nombre, sus partidas una por renglón y su tamaño
  comparado con un baño, que se reparte parejo como peso (`partidasDeTipoNuevo`; sin tamaño, 50). Las partidas
  nacen con un día, a cargo de la cuadrilla, sin etapa ni punto de control, y se afinan después.
- **Copiar un tipo** (legacy: `duClonarSecuencia`): sus partidas activas, con todo lo suyo.
- **Agregar o editar una partida** (legacy: `duGuardarPartida`): orden, días, quién la hace (un subcontratista
  necesita su oficio), etapa, punto de control, si va junto con la anterior, espera y peso.
- **Dar de baja** una partida o un tipo, y reactivarlos. Nada se borra. Un tipo dado de baja ya no se ofrece en una
  obra nueva. Generales de obra no se da de baja.
- **Una etapa nueva** (Pintura): solo su nombre; va al final. Sin ella, las partidas de un trabajo nuevo caerían en
  "Otras partidas" del presupuesto.
- Los nombres son únicos sin importar mayúsculas, también contra los dados de baja (así lo exige la base); el
  nombre en inglés es opcional (D-015).

**Diferencia con el legacy:** el legacy "congelaba" las obras en curso antes de tocar el catálogo
(`congelarAreasDeTipo_`) y arrastraba el histórico al renombrar una partida (`renombrarPartida_`). Aquí no hace
falta: cada espacio copia sus partidas al crearse (`partidas_obra`), así que cambiar el catálogo solo afecta a los
espacios nuevos.

**Pendiente:** crear puntos de control nuevos con sus preguntas, cuando el dueño lo pida.

## D-047 · Abrir la app sin señal

**Decisión del dueño:** el PM abre la app sin señal, escribe su PIN y cierra el día de hoy con la copia que guardó
el teléfono. Al volver la señal, el cierre y sus fotos se envían solos por la cola (D-043). El legacy no abría sin
señal (era una página de Google): esto es nuevo.

**Cómo funciona:**
- **La página sin señal.** El service worker (`public/sw.js`) guarda `/sin-senal` con todo su código. Cuando una
  página no contesta en **6 segundos** (sin señal, o una señal que casi conecta), muestra la guardada. Con señal todo
  va al servidor: el service worker no guarda nada del miembro. Cada vez que el PM abre su inicio con señal, se la
  vuelve a guardar (si cambió la versión o el idioma).
- **La copia.** El inicio del PM le da al teléfono `copiaSinSenal`: sus obras con lo de la pantalla de cierre, los
  días cerrados de la última semana, los subs esperados hasta 6 días laborables adelante (con su fecha de inicio,
  para ofrecer solo los que ya empezaron) y la zona de la empresa. Se guarda en IndexedDB. **No lleva dinero**: es
  lo mismo que el PM ya ve.
- **El PIN local** (`lib/sin-senal.ts`) es solo un candado del teléfono, como anticipó D-038. Al escribir el PIN
  con señal, el teléfono guarda su huella (PBKDF2-SHA256, 100 000 vueltas, con sal), nunca el PIN; queda por
  confirmar, y el inicio la confirma solo si el servidor aceptó el PIN. Sin señal se revisa con las reglas de la
  base: 5 intentos fallidos bloquean 15 minutos, y abre por 16 horas. Con 4 dígitos no resiste a quien tenga el
  celular y sepa de computadoras; pero sin el servidor nada se escribe en la base, y la copia no tiene dinero.
- **Sin señal se cierra solo el día de hoy** (en la zona de la empresa). Un día olvidado se cierra con señal: la
  ventana de 2 días deja tiempo. Hoy no se ofrece si ya estaba cerrado o si su cierre espera en la cola. El
  servidor decide el día por la hora de captura, así que un cierre enviado al día siguiente cae en su día.
- **Sin acceso** (quitaron el celular o dieron de baja al miembro), el teléfono borra la copia y el PIN local.

**Límites conocidos:** la versión sin señal no muestra la semana ni los avisos, solo las obras y el cierre. En
iPhone, Safari puede borrar lo guardado si la app no se abre en unos 7 días; se mide en el piloto. Una página
guardada de una versión anterior no puede enviar a una versión nueva del servidor: lo que cierre espera en la cola
hasta que el PM abra la app con señal.

## D-048 · La inspección y la prueba de agua desde el celular

**Decisión del dueño:** el paso 6 va por partes; la primera (6a) es la calidad, porque sin ella el PM no puede
terminar ninguna partida con punto de control (el cierre exige la inspección aprobada, D-041).

**Cómo funciona** (`calidad.ts` en el servidor, con las reglas de `core/calidad.ts`; legacy: `pmInspeccion`,
`pmPruebaInicio`, `pmPruebaFin`):
- **La pantalla de calidad** de cada obra (`/obras/[id]/calidad`, desde el inicio del PM) muestra cada espacio con
  los puntos de control de sus partidas: aprobada, con defectos, por inspeccionar (ya empezó alguna partida) o
  todavía no. Las inspecciones pendientes del inicio y el aviso del cierre llevan a ella.
- **La inspección**, como el legacy: se marca lo que cumple; "No aplica" saca la pregunta del total pero queda
  registrada; lo que quede sin marcar es defecto, y el teléfono pide confirmarlo. El servidor la califica contra
  la lista real de preguntas (`calificarInspeccion`) y guarda cada respuesta con su texto. Pide al menos una foto
  en total, como el legacy; "requiere foto" es una indicación en la pregunta.
- **La prueba de inundación** de un espacio arranca con la foto del nivel y se cierra con otra, sin fuga o con
  fuga, después de 23 horas. Una sola en curso por espacio. El punto que la exige (PC3) no se aprueba sin una sin
  fugas en ese espacio. Se muestra en la pantalla de calidad y en la inspección de PC3.
- **Necesitan señal**, como en el legacy: el PM tiene que ver en el momento si se aprobó. El registro y sus fotos
  van en una sola transacción: si una foto no sube, no se guarda nada (el archivo que alcanzó a subir queda en
  Storage sin registro, y nadie lo ve).
- Solo el PM de la obra; el dueño las ve, no las hace.

**Diferencia con el legacy:** el legacy mandaba un correo al dueño con cada inspección con defectos o prueba con
fuga. Aquí todavía no hay correos ni pantallas del dueño para esto: queda para la fase 3.

## D-049 · Los gastos del PM, y la revisión del dueño

**Decisión del dueño:** el paso 6b trae los gastos del PM con una lista mínima para el dueño (aprobar las compras
en revisión), porque sin ella el dueño no tendría dónde verlas; sus pantallas completas siguen en la fase 3.

**Cómo funciona** (`gastos.ts`; legacy: `pmGasto`, `pmSubirRecibo`, `duRevisarGasto`):
- **Registrar un gasto** desde la obra (`/obras/[id]/gasto`): monto, partida (la que va en curso; si ninguna, la
  primera, como el legacy; sin partida va a Generales de obra), categoría, proveedor, qué se compró y la foto del
  recibo. Siempre con la tarjeta de la empresa, con los últimos 4 dígitos del miembro. El día es el de la captura.
- **Arriba del límite de compra del PM** queda pendiente de revisión: el PM lo ve al registrarlo, y al dueño le
  aparece en su inicio ("N compras por revisar", `/gastos`), donde la marca revisada. Queda en la auditoría.
- **El recibo** es una foto del gasto (`refTipo 'gasto'`). Si no se tomó, el gasto sale en "Gastos sin recibo" del
  inicio y en la pantalla de gastos, donde se adjunta después (con señal).
- **Corregir o anular** un gasto propio dentro de 48 h, con motivo, con los flujos de correcciones de la fase 1
  (monto, partida, categoría, proveedor, descripción). Un gasto no se regresa a "sin partida": se anula y se vuelve a
  registrar.
- **Sin señal va a la cola**, como en el legacy. El gasto lleva una **clave de envío** (`gastos.clave_envio`,
  migración `20261011000100`), como el cierre (D-042): un reintento recibe el gasto que ya existe. El recibo va
  detrás como foto (`de: 'gasto'`); si el gasto se rechaza, su recibo sale con él. La versión sin señal (D-047)
  ofrece "Registrar gasto" en cada obra, con la copia del teléfono (que ahora lleva el límite de compra).
- **Una foto nunca sale antes que su gasto o su cierre** en la cola, aunque haya tomado turno antes. Se encontró al
  probar: el recibo tomaba turno al armarse, antes que su gasto, y al volver la señal se habría perdido.

**Diferencia con el legacy:** el legacy guardaba el recibo como enlace en el renglón del gasto; aquí es una foto
del gasto, como las demás (D-007).

## D-050 · Los avisos del PM, y la respuesta del dueño

**Decisión del dueño:** el paso 6c trae los avisos (bloqueos) del PM con una lista mínima para el dueño (contestar
los avisos), porque sin ella el aviso no le llegaría a nadie; sus pantallas completas siguen en la fase 3.

**Cómo funciona** (`avisos.ts`; legacy: `pmBloqueo`, `duResponderBloqueo` y la cola de bloqueos del inicio del
administrador):
- **Levantar un aviso** desde la obra (`/obras/[id]/aviso`): si detiene el avance (si no se dice, se da por hecho
  que sí, como el legacy), su tipo, qué pasa y qué se necesita (al menos 10 letras) y fotos del problema. La pantalla
  muestra sus avisos de esa obra: los que esperan respuesta y las respuestas del dueño.
- **El dueño** ve en su inicio "N avisos por contestar" (en rojo si alguno ya pasó el compromiso de respuesta de
  su configuración, 24 h de inicio). En `/avisos` están los abiertos, los más viejos primero, con su obra, su PM,
  las horas que llevan, si detienen el avance y sus fotos; los contesta (al menos 5 letras) y el aviso se cierra. El
  PM ve la respuesta en su inicio y en la pantalla de avisos.
- **Sin señal va a la cola**, como el gasto (D-049): el aviso lleva su clave de envío (`avisos.clave_envio`,
  migración `20261011000200`) y sus fotos van detrás (`de: 'aviso'`). La versión sin señal ofrece "Levantar aviso"
  en cada obra; la copia del teléfono lleva el compromiso de respuesta.
- **Ver una foto** (`/fotos/[id]`): revisa con la identidad del usuario, su celular y su PIN que puede ver esa foto
  (RLS) y lo manda a un enlace firmado de 5 minutos (D-026). La llave secreta se usa solo para firmar. Lo usan los
  avisos y el recibo de las compras por revisar; lo usará el álbum.

**Diferencia con el legacy:** el legacy mandaba un correo al dueño con cada aviso. Aquí todavía no hay correos: el
aviso aparece en su inicio.

## D-051 · Las órdenes de trabajo para el PM: confirmar y aprobar

**Cómo funciona** (`ordenes.ts`; legacy: `pmConfirmarOT`, `pmAprobarOT` y las listas "Falta que confirmen" y "Subs
en obra" de la pantalla de la obra):
- Una pantalla por obra (`/obras/[id]/ordenes`, "Subs" en el inicio del PM, y las órdenes por confirmar del inicio
  llevan a ella) con lo que espera algo del PM:
  - **Por confirmar:** emitidas sin confirmar. El PM llama al sub (botón con su teléfono) y, cuando confirma por
    escrito que llega, lo marca: la orden queda confirmada con su hora.
  - **Por aprobar:** el sub ya llegó (lo marca el cierre del día) y el trabajo no se ha aprobado. El PM lo aprueba
    después de caminarlo con el sub; la app pide confirmarlo ("El sub podrá cobrar"), como el legacy. Queda aprobada a
    su nombre (la política de la base no deja aprobar a nombre de otro).
- **Sin precios:** el PM nunca ve lo que se le paga al sub (`ordenes_trabajo_precios` es de la muralla financiera).
- **Necesitan señal**, como en el legacy. Solo el PM de la obra.
- Como el legacy, el servidor no exige que el sub haya llegado para aprobar: la pantalla solo lo ofrece cuando llegó.

## D-052 · El punch list y la medida verificada desde el celular

**Cómo funciona** (`punch.ts`; legacy: `pmPunch`, `pmCerrarPunch`, `pmMedida` y la pantalla de entrega de
PM.html), en una pantalla por obra (`/obras/[id]/entrega`, "Entrega y medidas" en el inicio del PM):
- **El punch list:** en el recorrido de entrega se anota todo lo que señala el cliente, sin discutir nada en el
  momento: qué es (al menos 4 letras), si es un defecto, un cambio de alcance o una expectativa, quién lo corrige y
  una foto opcional (foto del punch). Cada detalle tiene **7 días hábiles** para corregirse, con el calendario de la
  empresa (el legacy contaba de lunes a viernes; aquí cuenta los días laborables de la empresa, D-028). Los vencidos
  se marcan en rojo con el consejo del legacy ("Agrúpalos y ve una sola vez"). "Marcar corregido" pide confirmarlo.
- **La medida verificada (D-014):** los pies² (y pies lineales) reales de cada espacio, medidos en sitio, menos
  Generales de obra. Se guardan aparte de los cotizados, con quién y cuándo, y dejan rastro en `correcciones`
  (`medida_verificada`, de la medida vigente a la nueva). Se puede volver a medir.
- **Necesitan señal**, como en el legacy. Solo el PM de la obra.

## D-053 · El álbum de fotos de la obra

**Cómo funciona** (`album.ts`; legacy: `pmAlbum` y `vFotos` de PM.html), en `/obras/[id]/album` ("Fotos" en el
inicio del PM y "Ver las fotos" en la lista de obras del dueño):
- Las fotos de la obra **agrupadas por su registro** (el cierre del día, la inspección, la prueba de agua, el
  detalle del punch, el recibo de un gasto, el aviso, y para el dueño las órdenes de cambio), con lo que identifica
  a cada uno (folio, punto de control, espacio, proveedor…), por día y lo más nuevo primero, de 20 en 20 registros.
- **Cada quien ve lo que puede** (RLS de `fotos`): el PM, las de sus obras, y de los gastos y los avisos solo las
  suyas; nunca las compras de la oficina ni las órdenes de cambio. El dueño, todas las de su empresa.
- Las fotos se abren por `/fotos/[id]` (D-050), con un enlace firmado de 5 minutos, y cargan conforme se ven.

**Diferencia con el legacy:** el legacy mostraba solo las fotos del cierre y de los avisos; aquí están todas las
del PM en su obra.

## D-054 · Lo que corrigió la revisión de seguridad de la fase 2

Una revisión independiente (paso 7b) encontró cuatro huecos que se corrigen aquí. Otros hallazgos quedan pendientes
(ver el plan de la fase 2).
- **La huella del PIN solo en el teléfono del PM.** Con 4 o 6 dígitos, la huella del PIN local (D-047) se rompe en
  minutos y revela el PIN real, que es el mismo del servidor. Solo el PM trabaja sin señal, así que solo en su
  teléfono se guarda; cuando entra alguien más, se borran la copia, el PIN local y la huella por confirmar. En el
  teléfono del PM el riesgo sigue: quien lo tenga en la mano con las herramientas del navegador puede sacar el PIN.
  Ese PIN no abre dinero: el PM no lo ve.
- **El día de una captura no va más atrás que un cierre tardío.** El día de un cierre o un gasto que llega de la
  cola lo dice la hora del teléfono (`diaDeCaptura`, como el legacy, hasta 7 días). Un teléfono con la hora atrasada
  cerraba así un día viejo sin quedar como tardío. Ahora no se acepta más atrás de los últimos 2 días laborables
  (`validarDiaDeCaptura`, error `fuera_de_ventana`); un día no laborable entre ellos y hoy sí. **Diferencia con el
  legacy.** Dentro de la ventana no se marca tardío: no se distingue de un cierre que se quedó sin señal, y la
  bitácora guarda cuándo llegó (`enviado_en`).
- **La cola del teléfono es de quien la capturó.** Cada registro lleva el miembro que entró en el teléfono, y solo
  se envía y se muestra lo suyo. Si el teléfono pasa a otro miembro, lo del anterior se aparta, sin borrarse, hasta
  que vuelva a entrar ahí. Antes, lo pendiente de un PM salía con la sesión del otro. Lo que guardó una versión
  anterior no dice de quién es, y se envía como antes.
- **Un gasto que el PM corrige arriba de su límite vuelve a la revisión del dueño** (decisión del dueño). Lo hace la
  base (`revisar_gasto_corregido`): el PM no puede cambiar `revision`, así que tampoco puede quitarse de ella. Queda
  en el rastro de la corrección. **Diferencia con el legacy**, que no lo revisaba.

## D-055 · Los hallazgos menores de la revisión de seguridad

Lo que quedaba de la revisión del paso 7b (después de D-054 y de apagar la API de datos, D-038):
- **PIN más difíciles de adivinar** (`validarPin`). Además del dígito repetido y la escalera de 1 en 1 del legacy, se
  rechazan: la escalera de 2 en 2 (2468, 1357), los de solo dos dígitos distintos (1212, 1122, 2000), de 4 dígitos
  un año (1940 a 2039), de 6 una mitad repetida (123123) o tres pares (112233), y los más usados del teclado (2580,
  147258…). Vale para los PIN que se elijan de aquí en adelante; los que ya existen siguen sirviendo. **Diferencia
  con el legacy.**
- **El bloqueo del PIN crece.** 5 intentos fallidos seguidos bloquean 15 minutos, como el legacy; si sigue fallando
  sin un PIN bueno en medio, el siguiente bloqueo es de 1 hora y los demás de 24 horas (`dispositivos.bloqueos`,
  `entrar_con_pin`). Antes se podían probar 20 PIN por hora con el celular en la mano; ahora unos 5 al día. Sin señal,
  el PIN local sigue en 15 minutos: su huella se puede atacar sin el bloqueo (D-054). **Diferencia con el legacy.**
- **Al dueño y a los administradores solo los reinvita el dueño.** Reinvitar a alguien y canjear uno mismo la
  invitación es entrar como esa persona; un administrador podía hacerlo con el dueño. Cada quien puede reinvitarse a
  sí mismo, y a los PMs los siguen reinvitando el dueño o un administrador (queda en `invitaciones.creado_por`).
- **Los textos tienen tope**: 200 caracteres los cortos (nombres, proveedor, cliente) y 2,000 los largos
  (descripciones, notas, motivos), también en las correcciones. Más largo es `datos_invalidos`.
- **Una clave de envío repetida en otra obra** es un error de negocio y no uno de la base: la cola la saca con su
  razón en lugar de reintentarla para siempre (D-043).
- **Cabeceras:** HSTS, y una política de contenido (CSP) que solo deja cargar lo de la app y las fotos de Storage.
  Las pruebas de pantalla revisan que ninguna pantalla del PM ni del dueño choque con ella. Next pone su código en la
  página, así que lleva `'unsafe-inline'`; solo en producción, porque `next dev` usa eval.

**Se quedan así:** que al revocar un celular no se cierre al instante una sesión de Auth que Supabase no deje
borrar (con la API apagada, esa sesión ya no lee nada); que al canjear en un celular la invitación de otro miembro
el celular anterior siga en Equipo hasta que el dueño lo quite; y la llave foránea simple de `corrige_a`.

## D-056 · Con señal muy mala, el envío no espera para siempre

Pendiente desde el paso 5b, y lo primero que encontraría el piloto en una obra con poca señal: una petición que casi
conecta puede no terminar nunca, y el PM se quedaba viendo "Cerrando…".
- **El límite.** El cierre, el gasto y el aviso esperan al servidor 20 segundos (`conLimite`, `ESPERA_ENVIO_MS`).
  Pasado ese tiempo se dan por perdidos y quedan en la cola, como sin señal. La cola tiene el mismo límite, para no
  quedarse en "Enviando…"; una foto, que pesa más, espera 90.
- **No se duplica.** La petición que tardó puede llegar de todos modos, y la copia de la cola después o al mismo
  tiempo. La clave de envío (D-042) ya cubría que llegaran una tras otra. Si llegan juntas, la segunda choca con la
  clave o con "un cierre por día" al guardarse; el servidor lo intenta en un savepoint y, si el que ganó es el mismo
  cierre, lo devuelve. Si es otro cierre del mismo día, es `dia_ya_cerrado` y no un error de la base.

## D-057 · Lo que se preparó para el piloto

El piloto (paso 7c) lo llevan el dueño y un PM en una obra real; la guía está en [PILOTO.md](PILOTO.md). Para él:
- **La invitación se puede pegar dentro de la app.** En el iPhone, la app instalada en la pantalla de inicio no
  comparte las cookies de Safari y no tiene barra de direcciones: abrir la invitación desde WhatsApp verificaba
  Safari, y la app seguía "sin acceso". La pantalla sin acceso tiene ahora un campo para pegar el enlace (o el mensaje
  completo; `tokenDeInvitacion` saca el token) y abrirlo ahí.
- **Exportar una obra para compararla** (`scripts/exportar-obra.ts`): un .xlsx con las hojas y columnas del libro
  actual, y una hoja con cada día desde el inicio (si se cerró, cuándo llegó y si fue tardío). Solo lee, con la
  conexión directa a la base. Lleva los gastos con su monto: es para el dueño.

## D-058 · La foto de las inspecciones, solo donde protege

**Decisión del dueño:** la app del PM tiene que ser lo más sencilla posible, y la inspección pedía demasiadas fotos.
Que las pida solo cuando son estrictamente necesarias: lo que protege a la empresa ante un reclamo o una garantía.
- **Qué preguntas piden foto.** De las 38 preguntas estándar de PC1 a PC5, solo las 9 críticas del legacy ("Foto
  solo en lo crítico", `FOTO_CRITICA_`): cómo estaba antes de empezar (estructura sin daño por agua ni termita, la
  plomería existente), lo que se tapa y no se vuelve a ver (la prueba de presión, la panorámica de cada muro antes de
  cubrir, el refuerzo de la impermeabilización, el desagüe con brida, los gabinetes anclados) y cómo se entregó (la
  plomería sin fugas, las fotos finales). La prueba de inundación lleva sus propias dos fotos, como antes. Las
  preguntas que agregó la empresa piden foto si ella lo dijo (`pideFoto`). El libro de IJM la pedía en 25; una
  migración las deja en las 9 (`20261014000100_fotos_criticas.sql`), y cargar un libro aplica la misma regla.
- **Cuándo la pide la inspección.** Una foto por cada pregunta que pide foto, aplica y se marca como cumplida
  (`fotosQuePide`). Una inspección sin ninguna así, o con defecto en ellas, se guarda sin fotos; se pueden agregar si
  el PM quiere. La pantalla dice cuántas faltan y de qué.
- **Diferencia con el legacy**, que pedía al menos una foto en toda inspección.

## D-059 · La foto del cierre del día es opcional

**Decisión del dueño**, con D-058 y por la misma razón: la app del PM tiene que ser lo más sencilla posible. Un día
con trabajo se cierra con o sin fotos; si el PM toma alguna, se sube después como siempre (D-041, D-043). La
evidencia que protege ante un reclamo o una garantía queda en las inspecciones (sus preguntas críticas) y en las dos
fotos de la prueba de inundación, que siguen siendo obligatorias. **Diferencia con el legacy**, que exigía al menos
una foto en cada cierre con trabajo (`falta_foto`).

## D-060 · Las obras terminadas del PM, mientras dura su garantía

**Decisión del dueño:** el PM ve sus obras ya entregadas mientras dura su garantía (`entregas.garantia_vence`), con
sus fotos: en una visita de garantía, las fotos muestran lo que quedó tapado sin abrir muros. Más atrás ya no le
sirve para trabajar.
- **Qué ve.** En "Obras terminadas" (`/obras/terminadas`; el inicio la ofrece si tiene alguna): cada obra con su
  dirección, cuándo se entregó contra lo comprometido, hasta cuándo dura la garantía y cuántos días se cerraron. Y su
  álbum, el mismo de las obras activas (D-053), con las mismas reglas de fotos: nunca órdenes de cambio ni compras de
  la oficina, y de los gastos y los avisos solo los suyos. Sin dinero.
- **Solo lectura, y RLS no se toca.** El PM sigue sin ver la obra entregada (D-017): no puede capturar, corregir ni
  leer nada más de ella. Lo contestan funciones de la base del miembro de la sesión, como las del inicio (D-040):
  `mis_obras_en_garantia()` y `album_en_garantia()`; `/fotos/[id]` abre también las de `fotos_en_garantia()`.
- **Diferencia con el legacy**, donde el PM dejaba de ver la obra al entregarla.

## D-061 · La cuadrilla, para el dueño

**Decisión del dueño:** en la app del dueño, un apartado para los trabajadores de la empresa: darlos de alta y de
baja, y asignarles su salario y su puesto. Es "Cuadrilla" (`/cuadrilla`), junto a "Equipo" (los PMs).
- **Cada trabajador:** nombre, puesto u oficio (texto libre, con los que ya existen como sugerencia), cómo cobra (por
  hora o por día), teléfono y salario. El nombre no se repite entre los activos: el PM los distingue por nombre en el
  cierre.
- **El salario tiene historial** (D-031): cambiarlo agrega uno desde una fecha (hoy, si no se dice), y lo trabajado
  antes se queda con el de entonces. No va más atrás del último cambio; el del mismo día se corrige y queda en
  `correcciones`. **Diferencia con el legacy**, que guardaba una sola tarifa y la sobrescribía.
- **Cómo cobra no cambia si ya tiene días anotados:** sus horas se leerían como días, o al revés. Para ese caso, se da
  de baja y se da de alta otra vez.
- **Dar de baja** lo quita del cierre del PM; lo que trabajó se queda. Se puede reactivar.
- **La muralla:** el salario solo lo ven el dueño y el administrador (RLS de `tarifas_trabajador`); el PM ve el
  nombre, el puesto y cómo cobra, para anotarlo en el cierre.

## D-062 · El seguimiento de una obra, para el dueño

**Decisión del dueño:** ver en el día a día cómo va cada obra: en qué etapa va, si va dentro del presupuesto y cuántas
horas se han trabajado. Es la primera pantalla del dueño de la fase 3, adelantada: `/obras/[id]/seguimiento`, que
se abre al tocar la obra en "Obras".
- **Cómo va:** el avance ponderado (`avanceDeObra`), las partidas terminadas, la entrega comprometida (con los días de
  las órdenes de cambio autorizadas) contra la prevista (`cronogramaObra`) y el atraso; y de cada espacio, su avance y
  en qué va: las partidas en curso y su etapa, o la etapa que sigue.
- **El presupuesto contra lo gastado**, por espacio y etapa (`costosPorEtapa`, con paridad): material (los gastos
  vigentes, del PM y de la oficina), cuadrilla (sus horas o días por la tarifa vigente ese día, D-031) y
  subcontratos (las órdenes de trabajo no canceladas, por su precio). **El semáforo** (`semaforoDePresupuesto`): rojo
  si lo gastado ya pasó el presupuesto; amarillo si lo usado le lleva más de 10 puntos al avance (se gasta más rápido
  de lo que avanza); verde si no.
- **La cuadrilla:** horas y días en total y por trabajador, con su costo.
- **El día a día**, lo más reciente primero y de 14 en 14 días: cada día cerrado con sus partidas (las terminadas
  marcadas), quién estuvo y cuánto costó, si llegó el sub, los gastos (del PM y de la oficina), las notas y las fotos;
  y los días laborables desde el arranque que no se cerraron.
- **En la lista de "Obras"**, de cada obra activa: el avance, el presupuesto usado con su color y el atraso
  (`resumenDeObras`).
- **Lleva dinero:** solo el dueño o el administrador.

## D-063 · Las compras de la oficina

**Decisión del dueño:** el dueño o el administrador registra en una obra lo que compró la oficina. Desde el
seguimiento de la obra (D-062), "Registrar compra" (`/obras/[id]/compra`; legacy: `duGasto`).
- **La compra:** monto, día (hoy por omisión; no después de hoy), partida (opcional: sin ella va a Generales de obra,
  como la del PM), categoría, proveedor, qué se compró, cómo se pagó (transferencia, tarjeta, cheque, Zelle, efectivo
  o tarjeta de la empresa) y la foto del recibo (opcional). Se guarda como gasto de `origen = 'oficina'`
  (`registrarCompraOficina`), sin la revisión de las compras del PM ni su límite. No en una obra ya cerrada.
- **Va directo**, sin la cola del teléfono: la oficina tiene señal. La compra y su recibo en una transacción.
- **Cuenta** en el presupuesto de la obra (material) y en su día a día. El día a día muestra también los días con
  gastos aunque no tengan cierre, incluidos los de antes del arranque: el material se compra antes de empezar.
- **El PM nunca la ve**, ni su recibo (RLS de gastos y de fotos, como antes).

## D-064 · Los datos del cliente, y corregirlos o cambiar de PM

**Decisión del dueño:** al ver una obra, el dueño no encontraba los datos del cliente; y quiere corregirlos si se
escribieron mal y poder cambiar de PM.
- **En el seguimiento (D-062), "Datos de la obra":** el cliente, su teléfono (se toca para llamar), la dirección (abre
  el mapa), el PM, el estado, el inicio, la entrega comprometida (si las órdenes de cambio la movieron, también la
  original del alta), el contrato original y las notas. **En la lista de "Obras"**, de cada obra activa, también su
  entrega comprometida.
- **"Corregir"** (`/obras/[id]/datos`, `editarDatosObra`): el cliente, el teléfono, la dirección, las notas y el PM,
  con los mismos requisitos del alta (teléfono con al menos 10 dígitos; el PM nuevo, activo). Solo el dueño o el
  administrador; también en una obra entregada (su garantía, D-060, pasa al PM nuevo). Las fechas y el contrato no
  se corrigen aquí: la entrega se mueve con órdenes de cambio.
- **Cambiar de PM:** desde ese momento la obra es del nuevo (la ve, la cierra, y su garantía); el anterior deja de
  verla. Lo capturado (cierres, gastos, fotos, avisos) se queda en la obra con quien lo capturó. Lo que el anterior
  tenga en la cola sin señal de esa obra ya no entra: la app se lo dice al intentar enviarlo.
- No necesita migración: la RLS ya deja al dueño actualizar sus obras.

## D-065 · Pantallas más fáciles de leer, con el nombre de la empresa

**Decisión del dueño:** las pantallas del PM tienen que ser más intuitivas: letra un poco más grande, el botón de
volver más notorio y, arriba, el nombre de la empresa que usa el sistema, no el de J Solutions.
- **La letra base pasa de 16 a 18 px** (`font-size: 112.5%` en `html`): textos, botones y espacios crecen parejo. Los
  campos y las etiquetas van en tamaño normal (antes pequeño), con bordes y textos secundarios un tono más oscuros:
  en la obra se lee al sol.
- **Volver es un botón**, arriba de todo y con flecha, en el marco de cada pantalla (`Marco`, prop `volver`), en vez
  del texto pequeño bajo el título. La obra de la pantalla ("OB-001 · Familia García") va bajo el título
  (`subtitulo`). Igual en las pantallas del dueño.
- **Arriba, el nombre de la empresa** (`empresas.nombre`, en `quienSoy`). Sin consulta extra: la revisión de acceso de
  la página ya lo leyó y lo deja para esa petición (`lib/empresa-de-la-peticion`). También en la pantalla del PIN;
  donde todavía no hay empresa (la invitación, sin acceso), sigue "J Solutions". El nombre de la app instalada en
  el teléfono no cambia.
- **En el inicio del PM**, los títulos de sección más grandes, y los seis botones de cada obra con su ícono; "Subs"
  pasa a "Subcontratistas".

## D-066 · El portal del cliente

**Decisión del dueño:** darle valor al cliente de cada empresa: un lugar donde vea el avance de su remodelación.
Las fotos que ve son solo las que marquen el PM o el dueño. (Lo siguiente: que apruebe ahí las órdenes de cambio.)
- **Un enlace privado por obra** (`/cliente/[token]`), sin cuenta ni PIN; el cliente lo abre en su celular. El dueño
  lo crea desde el seguimiento de la obra ("Portal del cliente") y lo copia o comparte. **El enlace se ve una sola
  vez**: la base guarda solo el hash del token, como en las invitaciones. Si se pierde, se crea otro y el anterior
  deja de servir; también se puede desactivar. El dueño ve cuántas veces se abrió y cuándo.
- **Lo que ve el cliente:** el avance de la obra, cada espacio con su avance y en qué va (las mismas reglas del
  seguimiento, `avanceDeLaObra`), la entrega comprometida (con los días de las órdenes de cambio autorizadas) o, ya
  entregada, el día de entrega y hasta cuándo dura la garantía; los días trabajados del último mes con sus partidas
  (las terminadas marcadas), y las fotos marcadas para él, por día. En español o inglés, según su celular.
- **Lo que nunca ve:** dinero (contrato, presupuesto, gastos, cuadrilla, subs), la fecha prevista ni el atraso, los
  días sin trabajo ni sus motivos, las notas e incidencias del PM, los avisos, los recibos ni las fotos sin marcar.
- **Las fotos para el cliente** (`fotos.para_cliente`): en el álbum de la obra, el PM (mientras la obra es suya) o el
  dueño tocan "Cliente" en cada foto. Solo las del trabajo: cierres, inspecciones, pruebas de agua y la lista de
  entrega; nunca recibos, avisos ni órdenes de cambio (`marcar_foto_cliente` lo revisa en la base).
- **Cuánto dura:** mientras la obra no se entregue y, entregada, hasta que vence su garantía.
- **Cómo se protege:** el servidor consulta sin identidad, solo con funciones de la base que reciben el token y
  contestan lo de arriba (`portal_cliente`, `foto_portal_cliente`), como al canjear una invitación. Las fotos se
  abren con un enlace firmado de pocos minutos. La página no la guardan los buscadores ni instala la app del equipo.

## D-067 · Las órdenes de cambio, aprobadas por el cliente con su firma

**Decisión del dueño:** que el cliente apruebe las órdenes de cambio en su portal (D-066), con su firma.
- **El dueño las emite** desde el seguimiento de la obra ("Órdenes de cambio", `/obras/[id]/cambios`; legacy:
  `duCrearOC`): motivo, qué se va a hacer, fecha del hallazgo (no después de hoy), costo estimado, precio al cliente,
  días que mueve la entrega y condición de pago (al aprobar, 50% al aprobar, en el siguiente avance o contra
  entrega). **El margen mínimo** de la empresa (`validarOrdenCambio`, como el legacy): si el precio deja menos, avisa
  y sugiere el precio que lo cumple; se puede usar el sugerido o emitirla así. No en una obra entregada. Ve el
  contrato original, lo que suman los cambios aprobados y el total; y de cada orden, su costo, precio y margen.
- **El cliente la aprueba en su portal:** arriba, las órdenes por aprobar, con qué se hará, el motivo, el precio
  (impuesto incluido), los días que mueve la entrega, la condición de pago y el nuevo total de su contrato. Escribe su
  nombre y firma con el dedo: la orden queda **autorizada**, mueve la entrega comprometida y el PM la ve para
  ejecutarla. O "No la apruebo", con un comentario opcional: queda **rechazada**. Una sola respuesta por orden.
- **La evidencia** (`respuestas_cambio`): quién respondió, cuándo y, desde el portal, la firma (un PNG), el IP y el
  navegador. El dueño ve la firma en la orden. Nada se edita ni se borra.
- **En papel:** si el cliente la firmó en papel o respondió por otro medio, el dueño registra la respuesta (quién y
  si la aprobó).
- **El cliente nunca ve** el costo ni el margen: del dinero, solo lo que se le cobra (el precio de cada orden y su
  contrato). Esto amplía D-066, que no le mostraba ningún monto.
- **La base revisa** que la orden sea de la obra del enlace y siga por aprobar (`responder_cambio_cliente`), como
  con el resto del portal: sin sesión, el token es la prueba.

## D-068 · Corregir y anular las compras de una obra, para el dueño

**Decisión del dueño:** corregir o anular desde la app las compras ya registradas (antes solo el servidor lo
permitía, sin pantalla).
- **En "Registrar compra"** de cada obra (`/obras/[id]/compra`), abajo, "Compras de esta obra": las vigentes, de la
  oficina y del PM (cada una dice de dónde vino), lo más nuevo primero, con su recibo o el aviso de que le falta.
- **Corregir** el monto, la partida, la categoría, el proveedor y qué se compró; **anular** la compra (sale de todos
  los cálculos, pero queda). Siempre con motivo, y cada cambio queda en `correcciones` (quién, qué, cuándo, antes,
  después y por qué), como las correcciones del PM (`corregir`, `anular`).
- **El dueño, sin el límite de 48 horas** del PM; solo mientras la obra no esté entregada ni cerrada. En una obra
  cerrada, la pantalla ya no deja registrar compras ni corregirlas.

## D-069 · En el portal, lo que está en proceso, sin los espacios

**Decisión del dueño:** en el portal del cliente (D-066), la sección de cómo va cada espacio no muestra los espacios
("Generales de obra", "Baño principal") ni su porcentaje: se llama "En qué se está trabajando" y dice "En proceso:"
con los trabajos en curso, sin repetir. Si hoy no hay ninguno, dice qué etapa sigue; con todo terminado, lo dice.
En "Lo que se ha trabajado", cada día dice solo los trabajos, sin el
espacio. El avance total de la obra sigue arriba.

## D-070 · El idioma, arriba a la derecha

**Decisión del dueño:** el botón para cambiar de idioma va arriba a la derecha de cada pantalla, pequeño y abreviado:
"ES" y "EN" (antes, dos botones grandes al final de la página). Para el lector de pantalla cada uno dice su nombre
completo ("Español", "English"). Igual en la app del equipo y en el portal del cliente.

## D-071 · Los cobros al cliente

**Decisión del dueño:** registrar lo que paga el cliente y ver cuánto falta por cobrar; y que el cliente vea en su
portal lo que lleva pagado y su saldo (legacy: `duCobro`, "cobrado contra ejecutado").
- **"Cobros"** en el seguimiento de cada obra (`/obras/[id]/cobros`): el contrato original, los cambios aprobados
  (órdenes de cambio autorizadas o facturadas, por su precio al cliente), el total, lo cobrado y lo que falta por
  cobrar, con una barra del porcentaje cobrado.
- **Registrar un pago:** monto, fecha (hoy por omisión; no después de hoy), concepto (depósito, pago de avance, orden
  de cambio, liquidación u otro), cómo pagó (transferencia, Zelle, cheque, efectivo o tarjeta; la tarjeta de la
  empresa no, esa es para comprar) y una referencia opcional (`registrarCobro`). También en una obra entregada (la
  liquidación suele llegar después); no en una cerrada.
- **Corregir** el monto, el concepto o la referencia, o **anular** el pago, siempre con motivo y con rastro
  (`corregir`, `anular`), como las compras; mientras la obra no esté entregada.
- **En el portal del cliente, "Sus pagos":** el total de su contrato con los cambios aprobados, lo pagado y su saldo,
  y cada pago con su fecha, concepto y monto (`cobros_portal_cliente`); nunca el método ni la referencia.

## D-072 · Del portal del cliente, de regreso a la app

**Decisión del dueño:** quien es del equipo y abre el enlace del cliente en su celular puede regresar a la app: en la
app instalada no hay barra de direcciones, y el dueño se quedó atrapado en el portal. Si quien abre el portal tiene
su sesión de la app en ese celular (con el PIN abierto o no), arriba sale el botón "Volver a la app", que lleva al
inicio. El cliente, sin sesión, no lo ve.

## D-073 · Los subcontratistas, para el dueño

**Decisión del dueño:** un botón en su inicio para gestionar los subcontratistas ("Subcontratistas",
`/subcontratistas`; legacy: `duGuardarSub`, `duActivarSub`).
- **Alta y edición:** nombre o empresa, oficio, teléfono (los tres obligatorios), contacto y correo, y sus papeles:
  cuándo vence su seguro, su número de licencia y cuándo vence, y si ya entregó su W-9. **El nombre no se repite**
  (dos altas del mismo sub parten su historial en dos): se edita el que hay.
- **Los papeles** (`revisarPapelesSub`, como `revisionSub_` del legacy): avisa si no tiene fecha de seguro, si venció,
  o, además del legacy, si vence en los próximos 30 días; y si su oficio requiere licencia estatal
  (`oficios.requiere_licencia`, en vez de adivinarlo por el nombre), si no la tiene o si venció. No bloquea: avisa.
- **Baja y reactivación:** nunca se borra (su historial vive en sus órdenes y pagos); de baja ya no se le emiten
  órdenes, y se dice cuántas órdenes abiertas le quedan.
- Solo el dueño o el administrador. El PM los sigue viendo por `subcontratistas_pm`, sin papeles ni dinero.

## D-074 · Las órdenes de trabajo y los pagos a subs

**Decisión del dueño:** pagarle a los subcontratistas desde la app (legacy: `duCrearOT`, `duCancelarOT`, `duPagoSub`).
Desde el seguimiento de cada obra, "Subcontratos y pagos a subs" (`/obras/[id]/subcontratos`).
- **Arriba:** lo comprometido con los subs (las órdenes no canceladas, por su precio), lo pagado y lo que falta por
  pagar.
- **Emitir una orden de trabajo** a un sub activo: la partida que cubre, el alcance, el inicio y el fin, y el **precio
  cerrado** (`validarOrdenTrabajo`). Es el compromiso de costo de esa partida. Si al sub le faltan papeles (D-073),
  lo dice y deja emitirla de todos modos. No en una obra entregada o cerrada. El PM la ve para confirmarla y
  aprobarla en su app, como antes.
- **Pagarle siempre contra su orden:** monto (el saldo por omisión), fecha (no después de hoy), concepto (anticipo,
  pago parcial o liquidación), cómo se pagó y una referencia (`registrarPagoSub`). **Los avisos del legacy**, que se
  confirman uno por uno (`validarPagoSub`): un anticipo antes de que el sub confirme por escrito, una liquidación antes
  de que el PM apruebe el trabajo, el sub sin papeles en regla, y pagar más que el precio (el extra va en una orden de
  cambio). Liquidada, la orden queda **pagada** (el PM ya no la ve, D-017).
- **Anular un pago** con su motivo (`anular`); la orden regresa de pagada a donde estaba: aprobada, confirmada o
  emitida (antes regresaba siempre a aprobada, aunque el PM no la hubiera aprobado).
- **Cancelar una orden** sin pagos: deja de contar como comprometido. Con pagos no se cancela (se ajusta el alcance).

## D-075 · Los indicadores de la empresa

**Decisión del dueño:** ver los indicadores del negocio en la app (legacy: el tablero de `kpis_`). Desde su inicio,
"Indicadores" (`/indicadores`).
- **Arriba, los seis del lunes** (D-034): días cerrados por el PM, avisos y órdenes de cambio sin respuesta a tiempo,
  gastos del PM sin recibo, saldo con los subcontratistas y costo de no calidad sobre contratos; cada uno con su
  valor, su meta y su color.
- **Abajo, los 19 por proceso** (control diario, órdenes de cambio y costos, calidad, entrega y garantía), cada uno con
  su valor, su meta, su semáforo (en la meta, cerca o lejos) y qué revela, con las palabras del legacy.
- **Las reglas son las de `calcularIndicadores`** (paridad con el legacy, D-034); `indicadoresDeLaEmpresa` lee de la
  base lo que miden, de toda la empresa, con los plazos de la configuración y las metas que la empresa haya cambiado
  (`metas_indicadores`). Solo el dueño o el administrador.
- **El cumplimiento del plan de la semana** sale "sin datos" mientras nadie congele el plan del lunes
  (`plan_semanal`): desde D-079 se congela solo.

## D-076 · Reprogramar una orden de trabajo

**Decisión del dueño:** cuando el sub no llega o cambia la fecha, se reprograma la orden en vez de cancelarla y
emitir otra (legacy: `duReprogramarOT`). En la orden, en "Subcontratos" de la obra (D-074), "Reprogramar".
- **El nuevo inicio y fin** (sin fin, de un solo día) y **el motivo**. La orden regresa a **emitida**, sin la
  confirmación del sub ni la asistencia, para que el sub la confirme otra vez y el PM marque en su cierre cuándo sí
  llegue (`reprogramarOrdenTrabajo`).
- **Si el sub no llegó** (el cierre del PM lo marcó), la falta queda contada (`faltas`, alimenta la tasa de
  presentación de subs, D-075) y el rastro lo dice. La orden muestra "El sub no llegó" y cuántas faltas lleva.
- **El cambio de fechas queda en `correcciones`** (antes, después y motivo). Solo una orden emitida o confirmada (no
  aprobada, pagada ni cancelada), y no en una obra cerrada. Solo el dueño o el administrador.

## D-077 · Las horas de la cuadrilla por etapa, repartidas entre las partidas del día

**Decisión del dueño:** en el seguimiento de la obra, ver cuántas horas trabajó cada uno de la cuadrilla en cada
etapa, aproximadamente; y que el costo de la cuadrilla por etapa se calcule igual.
- **El reparto** (`repartirCuadrilla`): el PM anota en el cierre cuántas horas (o días) trabajó cada uno, no en qué
  partida. Antes todo se cargaba a la primera partida del día. Ahora las horas de cada día se reparten **en partes
  iguales** entre las partidas que se trabajaron ese día (las del cierre), cada una con su espacio y su etapa. Sin
  cierre o sin partidas en él, se quedan en la partida con la que se guardaron.
- **En "Cuadrilla" del seguimiento,** cada trabajador se abre con un toque (una flechita; no doble toque, que en el
  celular hace zoom) y muestra sus horas por etapa, aproximadas (≈).
- **El presupuesto por etapa** (D-062) usa el mismo reparto para el costo de la cuadrilla. Las horas, los días y el
  costo total de cada trabajador no cambian; cambia a qué etapa se cargan.

## D-078 · La marca de cada empresa: su logo y su ícono

**Decisión del dueño:** que la app de cada empresa lleve su logo: el ícono en el teléfono, el nombre de la app
instalada, y el logo arriba de cada pantalla y en el portal del cliente.
- **"Mi empresa"** (`/empresa`, en el inicio del dueño): subir el logo (PNG o JPG de hasta 1 MB; se reconoce por sus
  bytes, no por el nombre), quitarlo, elegir el color de la empresa y el fondo del ícono (blanco, para logos oscuros,
  o el color de la empresa), con la vista previa del ícono. Se guarda en `marcas_empresa`; cada cambio sube su
  versión, que va en las direcciones de los íconos para que el teléfono pida los nuevos.
- **El ícono** (`/marca/{empresa}/icono/{32|180|192|512|maskable}`): el logo sobre el fondo elegido o, sin logo, las
  iniciales de la empresa ("IJM Construction" → IJM) en blanco sobre su color. **El manifiesto**
  (`/marca/{empresa}/manifest`): el nombre de la empresa, su color y esos íconos. El teléfono los pide sin las cookies
  de la app, así que van por el id de la empresa y se leen sin sesión (`marca_publica`): solo nombre, color y logo.
- **Quien entra instala la app de su empresa:** el layout pone el manifiesto, los íconos, el nombre y el color de la
  barra de la empresa de la sesión (la misma revisión de acceso de la página, una consulta por petición). Antes de
  entrar (la invitación), J Solutions en `/manifest.webmanifest`, que el service worker sigue guardando para abrir sin
  señal.
- **El logo, arriba de cada pantalla** junto al nombre de la empresa (D-065), y **en el portal del cliente** (D-066).
- **Al cambiar el logo:** quien ya instaló la app en iPhone tiene que quitarla y volver a agregarla para ver el ícono
  nuevo; en Android se actualiza sola, aunque puede tardar. La dirección de la app es la misma para todas las
  empresas.

## D-079 · Congelar el plan de la semana

**Decisión del dueño:** que el cumplimiento del plan de la semana (D-075) tenga datos. El cronograma se recorre solo
cuando algo se atrasa: comparar contra él siempre dice "vamos al día". Cada semana se guarda lo prometido, y el lunes
siguiente se compara contra lo que el PM marcó como terminado.
- **Qué se congela** (`congelarPlanSemanal`, con `planDeLaSemana` de @ijm/core): de las obras en obra, las partidas que
  el cronograma prevé terminar entre el lunes y el domingo de la semana, sin lo que ya se terminó antes de ese día.
  Se guarda en `plan_semanal`, una sola vez por semana; si dos pantallas lo congelan a la vez, la segunda no repite.
- **Cuándo:** como en el legacy (`congelarSemana_`), la primera vez que el dueño o el administrador abre su inicio o
  los indicadores en la semana; nadie tiene que acordarse. El PM no lo congela (no ve las obras de los demás). Si
  falla, el inicio se muestra igual y se vuelve a intentar al abrir otra vez. Si se abre hasta el miércoles, lo
  terminado el lunes y el martes ya no entra.
- **El detalle, en Indicadores,** debajo del cumplimiento: cuántas tareas tiene el plan de esta semana y, de la
  semana pasada, lo prometido por obra (espacio y partida, la fecha prevista) con ✓ si se terminó a más tardar el
  domingo y ✗ si no o si fue tarde (`cumplimientoDelPlan`, la misma regla que `cumplimientoSemanal`).
- **Sin migración:** la tabla y su RLS (el dueño lee y crea) ya estaban.
- **De paso:** los textos que ve el PM dicen "administrador" en vez de "dueño" (el PIN, la invitación, los errores,
  los gastos y los avisos). El rol "Dueño" del equipo se queda.

## D-080 · La plataforma: suscripciones, pagos y solo lectura

**Decisión de quien desarrolla la plataforma:** gestionar desde la app las empresas que la usan, su plan, su precio y
su vencimiento, cobrando a mano (Zelle, transferencia) hasta que llegue Stripe (fase 4).
- **Quien administra la plataforma** está en `plataforma.administradores` (fuera de `public`: no es de ninguna
  empresa), y se da de alta con `scripts/admin-plataforma.ts`. Entra con su celular y su PIN como cualquier miembro
  (puede ser el dueño de una empresa) y en su inicio le aparece **"Plataforma"** (`/plataforma`).
- **Lo que ve de cada empresa** (`plataforma_empresas`): su plan, su precio, su ciclo, si está a prueba, hasta cuándo
  está pagada, su estado, su dueño y su correo, sus pagos, cuántos PMs activos y obras en curso tiene y cuándo entró
  alguien por última vez. **No ve sus obras, sus clientes ni su dinero**: todo pasa por funciones de la base que
  devuelven solo eso, y RLS no le abre nada de otra empresa.
- **Lo que hace:** dar de alta una empresa con su dueño y su suscripción (le da el enlace para el dueño, como el
  script `alta-empresa.mjs`), cambiar la suscripción, anotar un pago (ya trae el monto y hasta cuándo cubre: desde el
  vencimiento si no ha pasado, o desde hoy; se puede cambiar), reinvitar al dueño (como `invitar-de-nuevo.ts`) y
  suspender o reactivar la empresa. Lo que hace en otra empresa no lleva su identidad de miembro
  (`plataforma.soltar_identidad`), para que los triggers no lo tomen por autor.
- **El estado** lo calcula la base (`estado_suscripcion`), con el día de la empresa: sin fecha, **activa** (las
  empresas que ya existían); **a prueba**; **por vencer** los 7 días antes; **en gracia** los 7 días después, con todo
  funcionando; **solo lectura** después; **suspendida** (`empresas.activa = false`).
- **Solo lectura:** un trigger por sentencia en cada tabla de la empresa (`exigir_suscripcion_vigente`; las nuevas lo
  reciben en `preparar_tabla`) rechaza lo que escribe el servidor a nombre de un miembro, con `suscripcion_vencida`.
  Se ve y se descarga todo; se sigue entrando con el PIN (son funciones de la base). La cola del PM no pierde lo
  capturado: se detiene y lo envía cuando se renueve.
- **Los avisos, en el inicio:** al dueño, a prueba, por vencer, en gracia (hasta cuándo) y en solo lectura; al PM, solo
  en solo lectura, para que avise al administrador. **Suspendida,** nadie entra y se les dice por qué (`/suspendida`,
  sin borrar la copia del celular).
- **Nada se borra** al vencer ni al suspender.
- **Pendiente (fase 4):** Stripe para el cobro con tarjeta y automático; el registro en línea con prueba.

## D-081 · Marcar hecha una orden de cambio, con su foto para el cliente

**Decisión del dueño:** que el PM marque que ya ejecutó una orden de cambio aprobada, y que el cliente lo vea en su
portal con la foto. (El legacy solo le mostraba al PM las autorizadas, sin forma de cerrarlas.)
- **En el inicio del PM,** cada orden aprobada por hacer tiene **"Ya la hice"**: una nota opcional y fotos con la
  cámara; "Marcar hecha" la guarda (`marcarCambioHecho`, en `cambios_hechos`) y queda "✓ Hecha el …". Necesita señal,
  como la inspección: la orden y sus fotos van en una sola transacción.
- **Solo una orden que el cliente aprobó** (autorizada o facturada), una vez, por el PM de la obra o el dueño. El PM
  no lee `ordenes_cambio`: la base lo revisa (`validar_cambio_hecho`). No se edita ni se desmarca (si hiciera falta,
  se pide).
- **El dueño** lo ve en las órdenes de cambio de la obra: quién la marcó, cuándo, su nota y sus fotos; las aprobadas
  que faltan dicen "el PM todavía no la marca hecha".
- **El cliente** lo ve en su portal, en la orden: "Cambio realizado el …" con las fotos. Las fotos de un cambio hecho
  (`cambio_hecho`, un tipo de foto nuevo) nacen marcadas para el cliente y también salen en su galería; en el álbum
  se pueden desmarcar como las demás.

## D-082 · El logo llena todo el ícono

**Decisión del dueño:** el ícono de la app es el logo completo, sin margen ni recuadro (con margen, un logo que trae
su propio fondo se veía chico y con un borde). Cambia D-078.
- **El logo llena todo el ícono,** en todos sus tamaños (también el "maskable" de Android, que el teléfono recorta en
  círculo o en gota: lo de las orillas puede quedar fuera). Si no es cuadrado, se recorta al centro; lo transparente
  de un PNG queda en blanco. En "Mi empresa" se pide una imagen cuadrada.
- **Ya no se elige el fondo del ícono:** se quitó `fondo_blanco` de `marcas_empresa` y de `marca_publica`.
- **Sin logo,** el ícono sigue siendo las iniciales de la empresa sobre su color, con su margen.

## D-083 · Los miembros se dan de alta con su celular, no con su correo

**Decisión del dueño:** al registrar un manager (y al dueño de una empresa nueva en la plataforma) se pide su
**celular**; el correo queda opcional. Casi todos tienen celular y muchos no usan o no recuerdan su correo.
- **Por qué hacía falta el correo:** la cuenta de Auth de cada miembro se identifica por correo, y la sesión del
  celular verificado se abre con un enlace mágico que la app genera y canjea en ese momento (D-038), algo que Supabase
  solo hace con correo; con número pide mandar un SMS (un proveedor con costo por mensaje).
- **Cómo queda:** la cuenta lleva una **dirección interna que sale del número** (`15125550101@celular.invalid`,
  `correoDeCelular`). Nadie la ve ni recibe nada en ella (el dominio `.invalid` no existe); solo sirve para abrir la
  sesión, como antes. No se manda ningún SMS: el enlace se sigue mandando por WhatsApp.
- **El celular** se normaliza (`normalizarCelular`): 10 dígitos son de EE. UU. (+1); de otro país, con su +. Se guarda
  en `miembros.telefono` y se ve en "Managers" (con enlace para llamar) y en la plataforma. El correo, si lo dan, va a
  `miembros.correo_avisos`. El mismo celular, escrito como sea, no se da de alta dos veces (`celular_ya_registrado`).
- **Los que ya estaban** siguen entrando igual, con su correo. Los scripts de respaldo (`invitar-de-nuevo.ts`,
  `admin-plataforma.ts`) buscan por `--celular` o por `--correo`.
- **En la base:** versiones nuevas de `invitar_pm` y `plataforma_alta_empresa` con el celular y el correo; las de
  antes se quitan cuando ya no las use ninguna versión publicada de la app. `plataforma_empresas` devuelve el
  celular del dueño y, como correo, el que dio (nunca la dirección interna).

## D-084 · El presupuesto con costo y margen

**Decisión del dueño:** capturar en el presupuesto el **costo** de cada etapa y el **margen** deseado, y que el precio
salga solo. Antes cada etapa llevaba un solo monto, que el dueño capturaba con el margen incluido, y el seguimiento
comparaba lo gastado contra ese precio: el rojo se prendía cuando ya se perdía dinero, no cuando se comía el margen.
- **El margen es sobre el precio** (como en las órdenes de cambio): precio = costo / (1 − margen)
  (`precioConMargen`). Con $10,000 de costo y 35%, el precio es $15,384.62.
- **De cada etapa,** su costo y, si quiere, su propio margen; sin él, el **margen de la obra**
  (`obras_finanzas.margen_objetivo`), que nace con el de la empresa (`configuracion.margen_presupuesto`, 35%). El
  servidor calcula el precio; `presupuesto_etapas.monto` sigue siendo el precio y `costo` es nuevo.
- **El contrato** sigue a la suma de los precios mientras el dueño no lo cambie (por ejemplo, para redondearlo), y se
  ve con qué margen queda. Se guarda con su rastro en `correcciones`. El del alta se ajusta aquí.
- **El seguimiento compara lo gastado contra el costo** (sin costo, contra el precio, como antes), y muestra el
  **margen esperado** (contrato contra costos) y el **proyectado**: si lo que falta se gasta como se presupuestó, con
  lo ya pasado como se gastó (`margenProyectado`). Cada etapa dice también cuánto se cobra.
- **Las obras de antes:** sus montos se tomaron como precio y su costo se calculó con el margen de la empresa (35%);
  el dueño lo corrige etapa por etapa.
- El PM no ve nada de esto. Las órdenes de cambio llevan su propio costo y precio (D-067) y no entran aquí.

## D-085 · Cerrar una obra al entregarla

**Decisión del dueño:** que la app cierre la obra al entregarla y guarde su histórico, para que más adelante recomiende
el costo por pie² (o por pie lineal) de cada etapa con los datos de la empresa. Desde el seguimiento de la obra,
**"Cerrar la obra"** (`/obras/[id]/cerrar`; legacy: `duPreCierre` y `duCerrarObra`).
- **La revisión** (`revisionDeCierre`): el contrato original, las órdenes de cambio, el contrato final, lo cobrado, el
  costo presupuestado (los costos de D-084) contra el real (material, cuadrilla y subs, con las reglas del
  seguimiento), el costo de no calidad, el margen bruto, la desviación y los días cerrados por el PM. Y **lo que
  falta**, lo grave primero, como el legacy: dinero por cobrar, órdenes de cambio sin respuesta o sin facturar,
  partidas sin terminar (graves); dinero por pagarle a los subs, órdenes de trabajo sin aprobar, punch abierto,
  gastos sin recibo, sin presupuesto (revisar); costos sin partida (nota).
- **Cerrar** (`cerrarObra`): el día de la entrega (no después de hoy ni antes del arranque) y los meses de garantía
  (12). Con algo grave pendiente, primero se confirma. En una transacción: la **entrega** con su garantía, la obra
  **entregada** con su fecha real, su **resumen** en `obras_cerradas` y su **histórico** (D-008): de cada etapa de
  cada espacio, lo presupuestado, el costo real, los pies², los **pies lineales** (columna nueva) y el costo por pie²
  (`historico_etapas`); y de cada partida terminada, sus días planeados y reales (`historico_duraciones`).
- Los días de la obra son de calendario, del arranque a la entrega, como en el legacy. Cerrada, no se cierra otra
  vez, no se edita (las pantallas ya lo revisaban) y su pantalla muestra el resumen.
- **Pendiente:** la unidad de cada etapa (pie² o pie lineal) en el catálogo, y la recomendación de costo en el
  presupuesto cuando haya obras suficientes. La revisión de puntos de control y pruebas de inundación del legacy
  queda para después.

## D-086 · Cada etapa se cotiza por pie² o por pie lineal

**Decisión del dueño:** que cada etapa diga cómo se cotiza, para que el presupuesto y el histórico hablen en esa unidad
y más adelante se recomiende su costo con las obras de la empresa.
- **En el catálogo,** cada etapa del presupuesto tiene su unidad: **pie²** (tile, pintura; la de siempre) o **pie
  lineal** (cubiertas, zoclos). Se elige al crearla y se cambia ahí mismo (`etapas.unidad`, `cambiarUnidadEtapa`).
- **En el presupuesto,** cada espacio muestra sus pies² y, si alguna de sus etapas va por pie lineal, pide sus **pies
  lineales** (los cotizados, con su rastro en `correcciones`; antes solo se capturaban al verificar la medida). Cada
  etapa con costo dice su costo y su precio por su unidad ("Costo $50/ft lineal · Precio $76.92/ft lineal").
- **Al cerrar** (D-085), el histórico guarda la unidad de cada etapa y su costo real por ella
  (`historico_etapas.unidad`, `costo_por_unidad`); el costo por pie² se sigue guardando.
- **Pendiente:** la recomendación del costo de cada etapa con ese histórico, cuando haya obras suficientes.

## D-087 · El histórico de las obras cerradas

**Decisión del dueño:** ver juntas sus obras cerradas (legacy: el histórico del tablero, `duHistorico`). Desde su
inicio, **"Histórico"** (`/historico`), con lo que guardó el cierre (D-085). Solo el dueño o el administrador.
- **Arriba:** el margen, la desviación y la duración promedio, y lo que cobra y le cuesta cada pie²; debajo de cada
  uno, la **tendencia**: sus últimas 3 obras contra las 3 anteriores (verde si mejora, rojo si empeora).
- **Por tipo de obra** (los tipos de sus espacios, "Baño + Closet") y **por mes de entrega:** cuántas, el margen,
  la desviación, la duración, los contratos y el costo.
- **Lo que cuesta cada etapa** por su unidad (D-086), por tipo de espacio: el promedio, el rango y en cuántas obras
  (`costosPorUnidad`). De aquí saldrá la recomendación al cotizar.
- **Garantías y reseñas:** los reclamos de garantía, su costo, cuántos siguen abiertos y cuántos clientes dejaron
  reseña.
- **Cada obra cerrada** con su tipo, su entrega, sus días, su contrato, su costo, su margen y su desviación; lleva a
  su cierre.
- Promedios simples, como el legacy: cada obra pesa lo mismo (`resumenHistorico`, en @ijm/core).

## D-088 · Un mes de trabajo simulado

**Decisión del dueño:** correr 10 obras de inicio a fin con datos de mercado para encontrar pasos de más, datos que
sobran y flujos que no cierran, y ver la app con datos. Se cargaron **en IJM Construction, en la nube** (lo eligió el
dueño, sabiendo que la app no borra), con `packages/servidor/scripts/simular-obras.ts`: usa las mismas funciones que
la app, a nombre del dueño y de 3 PMs nuevos, día por día con el cronograma de cada obra. Las obras simuladas lo dicen
en sus notas. Los resultados y los hallazgos están en `docs/SIMULACION.md`.

## D-089 · El cobro de una orden de cambio la factura

**Hallazgo de la simulación (D-088):** ningún paso de la app pasaba una orden de cambio a "facturada", y al cerrar cada
obra la revisión avisaba como grave "órdenes aprobadas sin facturar", aunque ya se hubieran cobrado.
- **El cobro con concepto "orden de cambio" dice cuál** (`cobros.orden_cambio_id`): en Cobros, al elegir ese concepto,
  se elige la orden (las aprobadas, primero las que les falta cobrar) y el monto se llena con lo que le falta.
- **Cobrada, aunque sea una parte** (como "50% al aprobar"), la orden queda **facturada**. Si ese cobro se anula y no
  le queda otro, regresa a autorizada. El cobro de una orden no cambia de concepto: se anula y se registra de nuevo.
- **Al cerrar la obra,** el aviso queda como "órdenes de cambio aprobadas sin cobrar", que ahora sí significa eso.
- Las órdenes de antes que ya se cobraron sin decir cuál siguen "autorizadas"; el cierre las avisa una vez.

## D-090 · Retrabajos, garantías y lo de después de la entrega

**Hallazgos de la simulación (D-088):** no había pantalla para `no_calidad` ni para los pasos de la entrega, así que
el costo de no calidad y las garantías salían en cero y las reseñas en rojo para siempre. Sin migración: las tablas
ya existían (del legacy: duNoCalidad, duGarantia, duCerrarGarantia y la cosecha). Solo el dueño o el administrador.
- **Retrabajos y garantías** (`/obras/[id]/retrabajos`, desde el seguimiento): un **retrabajo** es un error propio que
  se paga (no una orden de cambio, que paga el cliente); nace cerrado, con su costo, los días perdidos, la causa y, si
  fue de uno, el subcontratista. Una **garantía** es un reclamo del cliente después de la entrega: solo en una obra
  entregada, nace abierta y se cierra ("Atendida") con lo que costó.
- **Después de la entrega** (en el cierre de la obra, ya cerrada): las fotos autorizadas, la reseña pedida y
  recibida y el referido, cada uno con un toque; y el botón para registrar un reclamo. La visita de los 11 meses del
  legacy no: el dueño no la quiere (`entregas.visita_11m` se queda sin usar).
- **En el inicio del dueño,** "N pendientes después de la entrega" (rojo si hay un reclamo abierto) lleva a
  `/posventa`: los reclamos abiertos y las obras entregadas hace 3 días o más sin reseña.

## D-091 · Sin "en cierre" y órdenes de trabajo con menos toques

**Hallazgos de la simulación (D-088), decisión del dueño:**
- **El estado "en cierre" se quita de la app:** ningún paso llevaba una obra ahí y nadie lo leía. La etapa entre
  terminar el trabajo y cerrar la obra ya la cubren el punch list del PM y la revisión de "Cerrar la obra". La obra va
  de "en obra" a "entregada". El valor sigue en el tipo de la base (Postgres no quita valores de un enum sin rehacerlo),
  sin uso.
- **Órdenes de trabajo: de 6 toques a 3** (emitir → confirmar → anticipo → llegó → aprobar → liquidar):
  - **El dueño emite varias de una vez:** elige el sub, palomea sus partidas (cada una con sus fechas y su precio) y
    escribe un alcance para todas (`emitirOrdenesTrabajo`; todas o ninguna).
  - **El PM ya no confirma ni aprueba a mano** (se quitan `/obras/[id]/ordenes`, `confirmarOrden` y `aprobarOrden`):
    en su cierre del día, marcar que el sub **llegó** confirma la orden, y **terminar la partida** (ya con su
    inspección) la **aprueba** a su nombre: el trabajo se recibió. Si ese cierre se anula y la partida ya no queda
    terminada, la orden regresa (si no se ha liquidado).
  - **El dueño liquida con un toque:** la orden recibida dice "Trabajo recibido: falta pagarle $X" y el botón
    "Liquidar $X" (hoy, por transferencia). El anticipo y los pagos parciales siguen en "Registrar pago".
  - El pago ya no avisa de "anticipo antes de que el sub confirme": esa confirmación ya no existe. Sigue el aviso de
    liquidar antes de recibir el trabajo.
  - **En el inicio del PM**, "Subs por llegar" (los de los próximos 2 días, o los que ya debían llegar, sin marcar),
    con su teléfono para llamarles; es un recordatorio, no un paso.

## D-092 · Inspeccionar solo lo necesario

**Decisión del dueño:** que el PM inspeccione lo menos posible, sin que se le haga demasiado trabajo. Hallazgo de la
simulación (D-088): la inspección de gabinetes (PC4) servía también para el countertop.
- **Una inspección por punto de control y espacio:** si dos partidas del espacio llevan el mismo punto (gabinetes y
  countertop con PC4), la aprobada sirve para las dos. Se queda así a propósito: la propuesta de exigir otra
  inspección después de arrancar la segunda partida se descarta, porque duplica el trabajo.
- **"Todo cumple":** un toque marca todas las preguntas (menos las que no aplican); el PM solo desmarca lo que falla.
- **Volver a inspeccionar solo lo que falló:** si la última inspección salió con defectos, la siguiente muestra solo
  esas preguntas; lo demás queda como estaba, y la foto de lo que ya cumplía cuenta (no se vuelve a pedir). Puede ver
  todas si quiere. Si la última estaba aprobada, se inspecciona desde cero (algo cambió en la obra).
- **"No aplica" se recuerda por tipo de espacio:** lo que no aplicó la última vez en ese punto, en un espacio del mismo
  tipo (un closet no lleva tile), ya viene marcado.
- Sin migración: las respuestas de cada pregunta ya se guardaban (`inspeccion_respuestas`).
- Del catálogo (lo decide el dueño en Catálogo): el closet lleva PC1 y PC4, con preguntas pensadas para baño; con lo
  de "No aplica" recordado pesa menos, pero se puede quitar el punto de control de esas partidas.

## D-093 · El cierre dice lo que cada trabajador ya lleva en otras obras

**Hallazgo de la simulación (D-088):** el PM se enteraba de que un trabajador pasaba de 16 horas (o de un día) hasta
enviar su cierre, que la app rechazaba. Ahora, en la cuadrilla del cierre, cada uno dice lo que ya lleva ese día en
otras obras, aunque sean de otro PM ("Ya lleva 10 h en otra obra: le quedan 6 h"); si se pasa, el campo se marca
en rojo con lo máximo que se le puede poner, y al que cobra por día solo se le ofrece lo que le queda (medio día, o
nada). La regla sigue en el servidor (`validarCuadrilla`); esto solo la anticipa. Sin señal, el dato es el de cuando
se guardó la copia.

## D-094 · Las horas de la semana de la cuadrilla

**Decisión del dueño:** un resumen semanal con las horas de cada trabajador y, al tocar su nombre, en qué obras
trabajó. En Cuadrilla, "Horas de la semana" (`/cuadrilla/semana`, `semanaDeLaCuadrilla`): de lunes a domingo, cada
uno con sus horas (o días, si cobra por día) y lo que cuesta con la tarifa vigente de cada día (para la nómina); al
tocarlo, sus obras con sus horas y qué días. Arriba, el total de la cuadrilla y su costo; se navega a la semana
anterior y a la siguiente (no al futuro). Solo el dueño o el administrador: lleva salarios.

## D-095 · Lo que cuesta cada etapa según el tamaño

**Decisión del dueño:** encontrar la mejor forma de calcular el costo por pie² o por pie lineal, y saber qué etapas
mueven más el precio y cuáles casi no cambian con el tamaño.
- **El modelo:** cada etapa cuesta `base + tarifa × medida`. El tile crece casi todo con los pies²; los gabinetes, con
  los pies lineales; la plomería cuesta casi lo mismo en un baño chico que en uno grande (3 salidas son 3 salidas).
- **Una unidad más: "Fijo por espacio"** (`etapas.unidad = 'fijo'`, migración `20261028000100_etapa_fija`). Su costo
  por unidad en el histórico es el costo por espacio.
- **El análisis** (`analizarCostosEtapa`, en @ijm/core): por tipo de espacio y etapa, con las obras cerradas, ajusta
  base + tarifa por mínimos cuadrados contra los pies² y contra los pies lineales (el histórico guarda los dos). Hace
  falta 5 obras de tamaños distintos (al menos 15% de variación); con menos, solo la mediana del costo por unidad (o
  por espacio, si es fija). De ahí: qué parte del costo crece con el tamaño, cuánto sube por cada 10 unidades más (lo
  que más mueve el precio) y si conviene cotizarla de otra forma (fija si el tamaño explica menos del 30% de su costo;
  por la otra medida si la explica claramente mejor; por su medida si es fija y el tamaño explica más del 60%).
- **En el histórico:** "Lo que más mueve el precio" y, en "Lo que cuesta cada etapa", su costo típico, su base +
  tarifa, qué tanto depende del tamaño y la sugerencia.
- **En el presupuesto:** cada etapa con historia dice "Sugerido: $X (de N obras cerradas)", calculado con las medidas
  del espacio, y se usa con un toque.
- **La clasificación inicial de IJM Construction** (la aprobó el dueño): por pie², tile, carpintería y muros,
  impermeabilización, pintura, piso, demolición (su base sale del ajuste) y muros y pintura del closet; por pie lineal,
  vanity y countertop, gabinetes, countertop, backsplash y sistema de closet; fijas, generales de obra, plomería,
  eléctrico, vidrio y accesorios y appliances.
- Las 5 obras cerradas de la simulación (D-088) no sirven para esto: su costo se generó proporcional a los pies². El
  análisis empieza a decir algo con las obras reales.

## D-096 · Sin las funciones de antes del celular

D-083 dejó en la base las versiones de `invitar_pm` (5 argumentos) y `plataforma_alta_empresa` (13 argumentos) sin
celular, mientras la app que las usaba seguía publicada. Ya nadie las usa: se quitan (migración
`20261029000100_quitar_funciones_viejas`). Las de ahora las llamaban por dentro, así que primero se reescriben con todo
su cuerpo (con las mismas firmas, sus permisos se quedan) y después se borran las viejas.

## D-097 · Editar una empresa desde la plataforma

**Lo pidió quien administra la plataforma:** poder corregir el nombre de una empresa y los datos de su dueño. En la
cuenta de la empresa, "Editar datos": el nombre y la ciudad de la empresa, y el nombre, el celular y el correo de su
dueño (`editarEmpresa`, función `plataforma_editar_empresa`, migración `20261030000100_plataforma_editar_empresa`).
- Un celular que ya es de otro miembro, de cualquier empresa, no se acepta (`celular_ya_registrado`).
- Si el dueño entra con su celular (cuenta con dirección interna `@celular.invalid`, D-083), no puede quedarse sin él
  (`falta_celular`), y si cambia, su dirección de Auth cambia con él (`cambiarCorreo`, con la API de Auth): el celular
  viejo queda libre y el nuevo, apartado. Los dueños que entran con correo (los de antes) pueden quedarse sin celular,
  y su cuenta de Auth no se toca.
- Cambiar a la persona dueña de la empresa (pasarla a otro) no está aquí: es otra cosa.

## D-098 · Después de la entrega, también "No"

**Lo pidió el dueño:** si el cliente no quiere dejar reseña (o no autoriza las fotos), el paso se quedaba sin marcar y
la alerta de "sin reseña" seguía en sus pendientes. Ahora cada paso tiene "Sí" y "No": el "No" es que el cliente no
quiso, queda resuelto y sale de los pendientes; tocar el que ya está marcado lo regresa a pendiente
(`entregas.pasos_no`, migración `20261031000100_posventa_no`; `marcarPosventa` con `valor`). Los indicadores y el
histórico siguen contando como reseña solo la que sí se recibió.

## D-099 · Qué obras mueven cada uno de los seis del lunes

**Lo pidió el dueño:** al tocar un indicador en rojo, ver qué obras lo causan. En los seis del lunes, el que no está
en verde y tiene obras detrás se abre (se ensancha a lo ancho) con cada obra, lo suyo y un enlace a donde se atiende:
- **Tasa de cierre:** los días sin cerrar de la última semana ("2 días sin cerrar: mié 7, vie 9") → su seguimiento.
- **Avisos fuera de plazo:** cuántos sin contestar a tiempo → Avisos.
- **Órdenes de cambio sin respuesta:** cuántas esperan al cliente → sus órdenes de cambio.
- **Cargos sin recibo:** cuántos y cuánto suman → su seguimiento.
- **Saldo con subcontratistas** (informativo, nunca verde): lo que se les debe en esa obra → sus subcontratos.
- **Costo de no calidad:** lo que costaron sus retrabajos y garantías → sus retrabajos.

Con las mismas reglas que el indicador (`detallePorObra`, en @ijm/core), así lo de las obras suma lo del número. Los
datos de los indicadores ya traen la obra de cada aviso, gasto, orden y registro.

## D-100 · Filtrar las obras

**Lo pidió el dueño:** filtrar la lista de obras por fecha o estado. En "Obras":
- **Pestañas por estado** con cuántas hay: **En curso** (de entrada: sin presupuesto, lista para arranque y en obra),
  **Entregadas** y **Todas**.
- **Un buscador** por folio, cliente o dirección, sin importar acentos.
- **El periodo** (Este mes, Últimos 3 meses, Este año, Cualquier fecha) y **el PM** (si hay más de uno), en dos menús lado a
  lado para que los filtros no ocupen la pantalla: en curso cuenta su inicio; entregadas, su entrega.
- **El orden:** en curso, primero las atrasadas y luego las que se entregan antes; entregadas, la más reciente primero.
- Los filtros van en la dirección (`?estado=…&q=…&periodo=…&pm=…`, sin recargar la página): al abrir una obra y
  regresar, la lista sigue igual. Se filtra en el teléfono, con todas las obras ya leídas.

## D-101 · El uso de la app, solo para quien administra la plataforma

**Lo pidió quien administra la plataforma, y solo él lo ve:** cómo usan la app los administradores y PMs de cada
empresa. En la plataforma, "Uso de la app" (`/plataforma/uso`, `usoDeLaPlataforma`, función `plataforma_uso`): por
empresa y por persona, en los últimos 7, 30 o 90 días, los días que la abrió, el tiempo, las veces que entró, la
última vez, lo que capturó (cierres, gastos, avisos, fotos, cobros) y cuánto tarda cada PM en cerrar el día (la meta
del piloto es menos de 60 segundos).
- **Cómo se mide el tiempo:** mientras la app está abierta, a la vista y con señal, avisa cada minuto
  (`registrar_uso`, tabla `uso_app`: un renglón por persona y día con los minutos y las veces; una vez más cuando pasan
  15 minutos sin avisar; dos pestañas no duplican el minuto). Sin señal no se cuenta. Nada de lo que escriben ni dónde
  están; lo que hicieron sale de sus propios registros.
- **El tiempo del cierre:** el teléfono manda cuándo abrió la pantalla del cierre (`iniciado`) y cuándo lo terminó
  (`capturado`); la bitácora guarda los segundos (`segundos_captura`; más de 3 horas no cuenta).
- `uso_app` no la lee nadie directo (RLS sin políticas): solo la plataforma, con su función. Las empresas no la ven.

## D-102 · El expediente de una obra en PDF

**Lo pidió el dueño:** un botón para guardar en PDF todo lo de una obra que quiera. En el seguimiento, "Expediente en
PDF" (`/obras/[id]/expediente`): se palomean las secciones (resumen con los números, presupuesto por etapa, órdenes de
cambio con la firma del cliente, cobros, subcontratos, el día a día completo, cuadrilla, calidad —inspecciones con sus
defectos, pruebas de agua y punch list—, retrabajos y garantías, entrega y, si se quiere, las fotos) y "Descargar PDF"
abre la opción de imprimir del teléfono o la computadora, donde se elige "Guardar como PDF".
- **Por qué así (la opción que eligió el dueño):** no cuesta servidor, sale igual que en pantalla y aguanta muchas
  fotos (las pide de donde ya están). En papel: hoja carta, el encabezado con el logo y el nombre de la empresa, sin
  los controles, y el número de página donde el navegador lo permite (Chrome).
- Lo que ninguna pantalla del dueño leía sale de `calidadDeLaObra`; el día a día completo, de `seguimientoDeObra` con
  `todos`. Las fotos, hasta 15 páginas del álbum. Lleva dinero: solo el dueño o el administrador.

## D-103 · La orden de cambio desde el aviso del PM, y corregirla antes de que el cliente responda

**Lo pidió el dueño:** el PM no hace órdenes de cambio; avisa con un aviso (cliente, condición oculta, diseño…). El
dueño la emitía aparte, volviendo a escribir todo y sin que el PM supiera.
- **"Hacer orden de cambio"** en cada aviso por contestar (`/avisos`) abre las órdenes de la obra con `?aviso=`: el
  formulario viene con lo que escribió el PM, el día en que lo levantó y el motivo que le toca (condición oculta →
  condición oculta, cliente → solicitud del cliente, diseño → cambio de selección; los demás los elige el dueño), y
  arriba el aviso con sus fotos. El dueño lo reescribe como se lo va a explicar al cliente.
- **Al emitirla** queda ligada al aviso (`ordenes_cambio.aviso_id`, que ya existía) y, si el aviso seguía abierto, se
  contesta y se cierra solo: "Se emitió la orden de cambio OC-xxxx para que el cliente la apruebe". La lista de órdenes
  muestra de qué aviso salió cada una, con sus fotos.
- **Editar** mientras el cliente no responde (`editarOrdenCambio`): motivo, descripción, hallazgo, costo, precio,
  días y condición de pago, con las mismas reglas que al emitirla (margen mínimo, hallazgo no futuro, obra no
  entregada). Respondida —en el portal o en papel— ya no cambia: lo que el cliente firmó es lo que queda.
- **La firma es de lo que vio:** el portal manda con la respuesta una huella de lo que el cliente tenía en pantalla
  (motivo, descripción, días, condición y precio). Si el dueño la editó mientras tanto, la respuesta no entra
  (`orden_cambiada`), la página se recarga con la nueva versión y el cliente vuelve a responder. Se revisa después de
  responder, con la orden ya bloqueada, y el error deshace todo. Sin migración.

## D-104 · La cuadrilla del cierre: la de la obra primero, igual que el último cierre y un buscador

**Lo pidió el dueño:** en el cierre salía toda la cuadrilla de la empresa, por nombre, en cada obra; con muchos
trabajadores el PM tenía que recorrer la lista buscando a los suyos.
- **La cuadrilla de la obra:** solo se muestran los que trabajaron en los últimos 10 cierres con cuadrilla de esa obra
  (antes del día que se cierra), el más reciente arriba. Por cierres y no por fechas: una obra parada unas semanas no
  pierde a su gente.
- **"Igual que el último cierre (lun 19 oct)":** llena de un toque lo que se puso en el último cierre con cuadrilla
  (horas o día completo / medio día, recortado a lo que le queda si ya lleva algo en otra obra, D-093), y el PM
  corrige al que cambió. No se llena solo: si alguien faltó y el PM no lo nota, se pagaría un día no trabajado. No se
  ofrece al corregir un cierre, que ya viene con lo suyo.
- **"Agregar a alguien más":** busca por nombre o puesto, sin acentos ni mayúsculas, entre los que no se muestran; y
  "Ver a toda la cuadrilla" para quien prefiera la lista completa. En una obra nueva, la primera vez se agregan con el
  buscador.
- **Sin señal:** la copia del teléfono trae la cuadrilla de la obra y el último cierre. Una copia de antes de este
  cambio no los trae y muestra a todos, como antes.

## D-105 · La bitácora de la obra para el PM

**Lo preguntó el dueño:** el PM cerraba el día y ya no lo volvía a ver; el día a día solo estaba en el seguimiento del
dueño, con dinero.
- **"Bitácora"** en cada obra del inicio del PM (`/obras/[id]/bitacora`, `bitacoraDeObra`): los días cerrados, del más
  nuevo al más viejo, de 15 en 15. De cada uno, las partidas trabajadas y las terminadas, la cuadrilla con sus horas o
  días, los subs que llegaron o no, las notas, las fotos, y si fue tardío o sin trabajo con su motivo. Sin dinero:
  ni tarifas, ni costos, ni gastos.
- El cierre que el PM todavía puede corregir (suyo, 48 horas, D-044) trae "Corregir este cierre".
- **El nombre del sub** sale de la vista `bitacora_subs_pm` (migración 20261102000100): el PM no lee las órdenes de
  trabajo ya pagadas ni la tabla de subcontratistas, y sin ella el sub de un día viejo se quedaba sin nombre. Solo da
  el nombre y si llegó, de las obras del PM.

## D-106 · El desempeño de cada manager

**Lo pidió el dueño:** datos para analizar a sus managers. En "Managers", cada PM tiene "Ver su desempeño"
(`/equipo/[id]`, `desempenoDeUnManager`; el cálculo, `desempeno` en core): diez números en cuatro grupos, de los
últimos 30 días, 90 o un año, cada uno con su meta y el de toda la empresa, y la lista de sus obras.
- **Disciplina:** días cerrados a tiempo (de cada día laborable con la obra en marcha: a tiempo, tarde o sin cerrar;
  meta la del indicador de cierre), tiempo para cerrar el día (la mediana de `segundos_captura`, D-101; meta 60 s) y
  gastos con foto del recibo.
- **Plazos:** atraso promedio de sus obras en curso (el adelanto de una no compensa el atraso de otra) y cumplimiento
  del plan semanal (lo congelado cada lunes que se terminó esa semana, solo semanas ya terminadas).
- **Dinero:** obras en curso con el semáforo del presupuesto en rojo.
- **Calidad:** inspecciones aprobadas a la primera (la primera de cada punto en cada espacio; meta 90%), punch list
  cerrado para su compromiso, pruebas de agua con fuga, y retrabajos y garantías con su costo.
- **Justo:** se mide por día, por obra o por registro, no en totales; con pocos datos (menos de 10 días, 5 cierres, 3
  gastos, 5 partidas planeadas, 3 inspecciones o 3 detalles del punch) el número se muestra sin semáforo. Las obras se
  le cuentan al PM que las lleva hoy (en curso, o entregadas en el periodo).
- Margen real por PM, rendimiento de la cuadrilla y reseñas necesitan obras cerradas: quedan para después.

## D-107 · Qué obras convienen: la ganancia por día, el ranking y dónde se fue el margen

**Lo pidió el dueño:** analizar las obras terminadas para saber cuáles dejan más margen y toman menos tiempo.
- **La ganancia por día** (`gananciaPorDia`): contrato final menos costo real, entre los días que duró la obra. Es el
  número principal del histórico: un margen alto en una obra larga puede dejar menos que uno menor en una corta. El de
  un grupo (total, por tipo) es la ganancia de todas entre todos sus días, no el promedio de cada obra.
- **El ranking** ("Qué obras convienen más", arriba en el histórico; `ordenarObrasCerradas`): las obras cerradas de la
  mejor a la peor por ganancia por día (de entrada), margen, ganancia, menos días o menos atraso. El atraso es la
  entrega real contra la comprometida (la del alta más los días laborables de las órdenes de cambio aprobadas). Sustituye
  a la lista de obras cerradas.
- **El análisis de cada obra** (`/historico/[id]`, `analisisDeObraCerrada`): lo que dejó; el costo real contra el
  presupuestado y en qué se fue (materiales, cuadrilla, subcontratistas, retrabajos y garantías); cada etapa de cada
  espacio, real contra presupuesto, la que más se pasó primero; lo que sumaron las órdenes de cambio; los días
  planeados contra los reales. De ahí, al cierre y la posventa.
- Sin migración: todo sale de lo que guarda "Cerrar la obra" (D-085). Por PM, por tamaño y la velocidad por pie²
  quedan para después.

## D-108 · Los feriados, desde Mi empresa

**Lo pidió el dueño** (salió al escribir el manual: no había pantalla y se cargaban por la plataforma). En Mi empresa
→ **Feriados** (`/empresa/feriados`): los de este año en adelante, cada uno con "Se descansa" o "Se trabaja" (un toque
lo cambia); **"Agregar los de EE. UU."** de este año o el siguiente (`feriadosDeEstadosUnidos` en core: Año Nuevo,
Memorial Day, Independencia, Labor Day, Acción de Gracias y el día después, Nochebuena y Navidad; si cae en sábado se
descansa el viernes y en domingo el lunes; los días que ya tenían uno no cambian), y agregar uno propio. Nada se
borra: un feriado que ya no aplica se marca "Se trabaja" (D-028). Sin migración.

## D-109 · Las pantallas del dueño en la computadora

**Lo pidió el dueño:** analizar los datos en una pantalla grande. La app es la misma; en una pantalla de computadora
(1024 px o más) las pantallas del dueño usan todo el ancho (`Marco` con `ancho`): el inicio en tres columnas; las obras
con los filtros al costado y las tarjetas en dos columnas; el seguimiento con los datos y lo que se hace a la izquierda y
cómo va a la derecha; los indicadores y el desempeño en columnas; el histórico con el ranking como tabla ordenable desde
el encabezado; el análisis de una obra en dos columnas; las horas de la semana como tabla de trabajador contra día.
- **En el teléfono no cambia nada:** los contenedores nuevos son `contents` hasta `lg` (no cuentan para el acomodo) y las
  tablas están ocultas; se comprobó con capturas de las ocho pantallas antes y después, iguales píxel por píxel (salvo
  la hora de creación del enlace del cliente, que cambia con cada carga de datos).
- La computadora se da de alta como un celular más: Managers → tu nombre → "Nueva invitación", abrirla en el
  navegador y elegir el PIN. Las pantallas del PM no cambian.

## D-110 · Los módulos por empresa

**Lo pidió el dueño:** entregar la app con funciones sencillas e ir agregando partes "con un botón". Quien administra
la plataforma, en Plataforma → la empresa → **Módulos**, le prende o apaga a cada empresa partes de la app, una por
una o con el plan de un toque (Básico: solo la base; Pro: dinero, portal, órdenes de cambio, subcontratistas, calidad y
nómina; Empresa: todo).
- **La base siempre está:** obras, cierre del día (con su cuadrilla y salarios), gastos, avisos, fotos, bitácora,
  managers y feriados. **Los módulos:** presupuesto y dinero; portal del cliente; órdenes de cambio; subcontratistas;
  calidad; nómina (las horas de la semana y lo que cuesta la cuadrilla); indicadores; histórico y análisis; desempeño
  de managers; cierre, posventa y garantías; marca propia.
- **Lo que necesitan** (`REQUIERE` en core): órdenes de cambio, el portal y el dinero; subcontratistas, histórico y
  posventa, el dinero. Prender uno prende lo que necesita; apagar uno apaga lo que depende de él.
- **Apagar no borra nada:** sus pantallas se esconden y se cierran (sin el módulo, la pantalla manda al inicio y la
  acción no corre: `exigirDuenoCon` / `exigirAccesoCon`), y sus datos se quedan para cuando se prenda otra vez.
- **Reglas entre módulos:** sin calidad, una partida se termina sin pedir su inspección y no hay punch list; sin
  subcontratistas, el cierre no pregunta si llegó el sub; sin portal, el enlace del cliente no abre nada; sin órdenes
  de cambio, el portal no las muestra; sin marca, la app usa su logo y color (lo que subió la empresa se queda).
- **Dónde vive:** `empresas.modulos` (migración 20261103000100), que la sesión lee de `empresa_actual_datos`. Solo
  quien administra la plataforma la cambia (`plataforma_guardar_modulos`); un disparador impide que el dueño se prenda
  módulos solo. Las empresas que ya existían quedaron con todo prendido.

## D-111 · Las obras y el ticket promedio de cada empresa en el uso de la app

**Lo pidió el dueño de la plataforma.** En Plataforma → "Uso de la app", debajo de cada empresa: cuántas obras ha
cerrado en total y cuántas en el periodo elegido (7, 30 o 90 días, por la fecha de entrega), cuántas lleva en curso, y
su **ticket promedio**: el contrato final (con órdenes de cambio) de sus obras cerradas y el contrato de las que van en
curso. Sale de `plataforma_obras_de_empresas` (migración 20261104000100), que solo devuelve conteos y promedios y solo
a quien administra la plataforma.

## D-112 · Los administradores de la empresa

**Lo preguntó el dueño:** cómo agregar a alguien que dé de alta obras y todo lo demás. El rol de administrador ya
existía (todo lo del dueño, por `es_dueno_o_admin`), pero solo se invitaban PMs.
- **En Managers**, el dueño invita a alguien eligiendo su **rol** (PM o administrador; `invitar_miembro`) y, en la
  tarjeta de cada uno, lo cambia de PM a administrador o al revés (`cambiar_rol`). Lo ya capturado no cambia. El
  administrador entra con PIN de 6 dígitos, como el dueño.
- **Solo el dueño:** invitar administradores, cambiar roles, dar de baja a un administrador, quitarle el celular al
  dueño o a un administrador (antes un administrador podía) y reinvitarlos (ya era así, 20261013000200). Así un
  administrador no le quita el control al dueño ni se da de alta a otros. Un administrador invita y maneja PMs.
- Migración 20261105000100 (`invitar_miembro`, `cambiar_rol`, y `cambiar_activo` / `revocar_dispositivo` con esas
  reglas). `invitar_pm` se queda por ahora (la versión publicada la usa); se quitará después.

## D-113 · Las secciones del seguimiento se abren al tocarlas

**Lo pidió el dueño:** en el seguimiento de una obra había que bajar mucho para pasar "En qué va cada espacio",
"Presupuesto por etapa", "Cuadrilla" y "Día a día", todo desplegado. Ahora cada una es un botón cerrado
(`<details>`, sin JavaScript) que dice cómo va y se abre al tocarlo:
- **Espacios:** cuántos van terminados de cuántos.
- **Presupuesto por etapa:** cuántas etapas se pasaron del costo (rojo) y cuántas tienen gasto sin presupuesto
  (ámbar); si no, "Todas dentro del costo".
- **Cuadrilla:** horas, días y su costo (sin costo si la empresa no tiene salarios).
- **Día a día:** cuántos días de la página no tienen cierre (ámbar).

Los datos de la obra, los botones y "cómo va" (avance, entrega, gastado y margen) siguen a la vista. Al pasar de
página en el día a día (`?pagina=…#dia-a-dia`), la sección llega abierta y la pantalla baja hasta ella. En la
computadora es igual.

## D-114 · El asistente del dueño (MCP de J Solutions)

**Lo pidió el dueño de la plataforma:** que el dueño de cada empresa conecte su asistente de IA (Claude) a sus datos
para analizarlos: "¿en qué meses vendemos más?", "¿en qué etapa nos pasamos del presupuesto?". Se descartó el MCP de
Supabase para clientes: entra como administrador de la base, se salta RLS y ve todas las empresas.
- **Un módulo nuevo, `asistente`** (necesita `dinero`), apagado hasta que quien administra la plataforma lo prende. Va
  en el plan Empresa.
- **Llaves, solo el dueño** (no el administrador): Mi empresa → "Conectar un asistente". La app da un enlace
  `…/mcp/jsa_…` con la llave adentro para pegarlo en Claude como conector personalizado; se ve una sola vez (la base
  guarda su `hash_secreto`). Hasta 10 vigentes; se quitan cuando quiera y dejan de servir al instante. También dejan
  de servir si quien la creó ya no es el dueño activo o la empresa ya no tiene el módulo. Llave en la dirección y no
  OAuth: sirve igual en Claude del celular, de la computadora y del navegador; "Iniciar sesión con J Solutions"
  (OAuth) queda para después.
- **Solo lectura, con la identidad del dueño:** cada herramienta corre en una transacción a su nombre (`enNombreDe`)
  con las mismas funciones de la app, así que ve exactamente lo que él ve (RLS, solo su empresa). Las herramientas de
  un módulo apagado no aparecen. No se le pasa el teléfono ni la dirección del cliente, ni las fotos.
- **Herramientas:** `empresa` (hoy, módulos, gente), `obras` y `etapas_de_obras` (las dos para analizar: cada obra en
  un renglón con fechas, tipo, pies², PM, contrato, órdenes de cambio, cobros, costos, márgenes, atraso, retrabajos y
  garantías; cada etapa de cada obra con presupuestado contra gastado y su desglose), `seguimiento_de_obra`,
  `analisis_de_obra_cerrada`, `historico`, `indicadores`, `desempeno_de_managers`, `horas_de_la_cuadrilla`,
  `pendientes`. "Alta" de la obra = día de la venta.
- **Registro y límite:** cada llamada a una herramienta se anota (herramienta, argumentos, si salió bien, cuánto
  tardó) y el dueño ve las últimas en la misma pantalla; más de 60 en un minuto por llave: espera (HTTP 429).
- **Protocolo:** MCP por HTTP sin estado (`app/mcp/[llave]/route.ts`): JSON-RPC por POST, contestado en JSON;
  `initialize`, `ping`, `tools/list`, `tools/call`; GET 405. Sin paquete externo: `atenderMcp` en
  `@ijm/servidor` (probado con Vitest y con una conexión real en e2e).
- Migración 20261106000100 (`llaves_asistente`, `consultas_asistente`, funciones y el módulo en el check de
  `empresas.modulos`).
