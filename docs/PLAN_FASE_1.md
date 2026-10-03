# Fase 1 — Cimientos

## Objetivo

Dejar lista la base sobre la que se construyen las pantallas: el repositorio, la base de datos con su
seguridad, las empresas y los roles, y las reglas de negocio trasladadas del legacy con pruebas que
demuestren que dan los mismos resultados.

Al terminar esta fase **todavía no hay pantallas**. Hay algo más importante: la certeza de que los datos
están bien modelados, de que un PM no puede ver dinero aunque lo intente, y de que el cronograma, el avance
y el presupuesto calculan exactamente lo mismo que el sistema que ya funciona.

## Terminado cuando

- [x] `pnpm install && supabase start && pnpm test` funciona en una computadora nueva siguiendo el README.
      (Paso 1; la integración continua lo hace desde cero en cada cambio.)
- [x] La integración continua corre todas las pruebas en cada cambio, y están en verde.
- [x] Las migraciones crean desde cero todas las tablas de `docs/MODELO_DE_DATOS.md`, con llaves foráneas,
      restricciones e índices.
- [x] **Las pruebas de RLS demuestran**: un PM no puede leer ninguna tabla marcada con 💲; no ve obras que no
      tiene asignadas; y una empresa no ve nada de otra. Con usuarios reales de Supabase Auth, no simulados.
      (Paso 4, con dos revisiones independientes: D-026, D-027.)
- [x] `packages/core` tiene las reglas de negocio de la lista del paso 5, y **las pruebas de paridad contra el
      legacy dan cero diferencias** — o cada diferencia está explicada en `docs/DECISIONES.md`.
      (Pasos 5a a 5d: D-028 a D-034.)
- [ ] Las funciones del servidor para los flujos principales pasan sus pruebas de integración contra la base
      local: crear obra, guardar presupuesto por etapa, cerrar el día, subir una foto numerada.
- [x] `docs/DECISIONES.md` registra cada decisión de diseño tomada (al día con el paso 5).

## Fuera de alcance

Las pantallas (fases 2 y 3), el importador desde Google Sheets (fase 3), la cola sin conexión de la PWA
(fase 2), el cobro con Stripe y el alta de empresas en línea (fase 4).

## Antes de empezar

- **Cuentas:** GitHub, Supabase y Vercel.
- **Herramientas:** Node 22 o más reciente (ver D-011), pnpm, la CLI de Supabase y Docker (para la base local).
- **Modelo:** Claude Opus 5.5 con esfuerzo alto para toda la fase. Para revisar las políticas RLS del
  paso 4, conviene una segunda revisión con Claude Fable 5.1, si el plan lo incluye.

## Pasos

### 1. Repositorio y herramientas

Monorepo con pnpm workspaces (`apps/web`, `packages/core`, `packages/db`), TypeScript estricto, ESLint,
Prettier, Vitest y GitHub Actions. Supabase local con `supabase init`. Un README con los pasos para correr
todo desde cero.

**Terminado cuando** una computadora nueva levanta todo con el README, y la integración continua pasa.

### 2. Modelo de datos

Las migraciones SQL de todas las tablas de `docs/MODELO_DE_DATOS.md`: tipos enumerados para los estados,
llaves foráneas, `not null` donde el negocio lo exige, `unique` donde evita duplicados (por ejemplo
`fotos (ref_tipo, ref_id, indice)`), índices por `empresa_id` y por `obra_id`. La tabla `folios` con una
función que entrega el siguiente folio dentro de la transacción. El esquema de Drizzle que corresponda.

**Terminado cuando** las migraciones corren desde cero sin errores, y una prueba verifica que los folios
nunca se repiten con escrituras simultáneas.

### 3. Empresas, usuarios y roles

Supabase Auth; la tabla `miembros` con el rol de cada usuario en cada empresa; funciones SQL de apoyo para
las políticas (`empresa_actual()`, `rol_actual()`, `es_pm_de(obra_id)`). Datos de prueba: dos empresas, y en
cada una un dueño y dos PMs.

**Terminado cuando** cada usuario de prueba entra y las funciones de apoyo devuelven su empresa y su rol.

### 4. Seguridad: la muralla financiera y el aislamiento entre empresas

Una política RLS por tabla y por operación, según la tabla de acceso del modelo de datos. Las tablas 💲
permiten solo a `dueno` y `admin`. Las del PM filtran por obras asignadas. Todas filtran por empresa.

**Pruebas de RLS** con usuarios reales, en `pnpm test:rls`:

- Un PM intenta leer cada tabla 💲: cero renglones o error, en todas.
- Un PM intenta leer una obra que no es suya: no la ve, y tampoco su bitácora, su avance ni sus fotos.
- Un usuario de la empresa A intenta leer cualquier tabla de la empresa B: nada.
- Un PM intenta modificar lo que no le corresponde (el precio de una orden, el estado de una obra): falla.
- Las políticas de Storage: un PM no puede leer fotos de otra obra ni de otra empresa.

**Terminado cuando** todas pasan y la revisión independiente de las políticas no encuentra huecos.

### 5. Las reglas de negocio en `packages/core`

Funciones puras en TypeScript — sin base de datos ni red —, trasladadas de `legacy/app/fuente/`:

| Módulo | Qué incluye | Viene de |
| --- | --- | --- |
| `fechas` | día local de la empresa, días hábiles (`sumarHabiles`, `menosHabiles`, `habilesEntre`), fecha capturada al mediodía local | `comun/utilidades.js`, `comun/cronograma.js` |
| `cronograma` | `calcularCronograma` (plan y previsión), atraso previsto, fecha de entrega propuesta | `comun/cronograma.js` |
| `semana` | subs por programar, confirmaciones faltantes, choques, PPC | `admin/servidor.js` |
| `partidas` | copia de plantillas, pesos, claves por espacio | `comun/obra.js` |
| `avance` | avance ponderado por espacio y obra | `comun/obra.js` |
| `etapas` | etapas de un espacio, presupuesto por etapa, conversión del formato antiguo, costos por etapa, costo unitario | `admin/servidor.js` |
| `validaciones` | `exigir` (un solo mensaje "Faltan: …"), horas por hora y por día sumando obras, datos obligatorios del alta, ventana del cierre tardío | `comun/validaciones.js`, `pm/servidor.js` |
| `calidad` | reglas de inspección, "No aplica", fotos críticas, bloqueo de partidas con hito | `pm/servidor.js` |
| `indicadores` | los 19 indicadores con sus metas | `admin/servidor.js` |

**Terminado cuando** cada módulo tiene pruebas de unidad y de paridad, y todas pasan.

### 6. La capa del servidor para los flujos principales

Funciones del servidor, transaccionales y con Zod en la entrada, que usan `packages/core`: crear obra (con
la copia de partidas), guardar el presupuesto por etapa (con el cambio de estado), cerrar el día (sin
pantalla: cuadrilla, avance, subs, fotos comprometidas), subir una foto numerada, y registrar una
corrección con su rastro.

**Terminado cuando** tienen pruebas de integración contra la base local, adaptadas de las pruebas
equivalentes del legacy.

### 7. Documentación

`CLAUDE.md` al día, `docs/DECISIONES.md` con lo decidido, y el plan de la fase 2 en borrador.

## Las pruebas de paridad

Es la técnica central de esta fase. El legacy es JavaScript y corre en Node dentro del simulador de Google
Sheets que ya existe (`legacy/pruebas/harness.js`). Para cada regla:

1. Se carga el legacy en una máquina virtual de Node, con los datos del libro de ejemplo y con los del mes
   simulado (`legacy/sim/`).
2. Se llama a la función del legacy — por ejemplo `cronogramaObra_` — y a su equivalente en `packages/core`
   con los mismos datos, ya convertidos al modelo nuevo.
3. Se comparan los resultados: fechas del plan y la previsión, etapas y montos, porcentajes de avance,
   valores de cada indicador.

Una diferencia es un error del traslado **o** una corrección intencional. Si es intencional — por ejemplo
el error de fechas en UTC que ya se corrigió en el legacy —, se anota en `docs/DECISIONES.md` y la prueba lo
refleja.

## Qué pasa con cada prueba del legacy

| Pruebas del legacy | En el sistema nuevo |
| --- | --- |
| `prueba_crono`, `prueba_etapas`, `prueba_avance`, `prueba_pordia`, `prueba_obligatorios`, `prueba_tardio`, `prueba_fotos_criticas` | Unidad y paridad en `packages/core` — **fase 1** |
| `prueba_rol`, `prueba_pm` (el PM no recibe dinero), `prueba_acceso` | Pruebas de RLS y de Supabase Auth — **fase 1** |
| `prueba_escritura`, `prueba_presupuesto`, `prueba_fotos_despues`, `prueba_subs`, `prueba_tipos`, `prueba_noaplica`, `prueba_dueno`, `verificacion` | Integración de la capa del servidor — **fase 1** los flujos del paso 6; el resto en la fase 3 |
| Todas las `*_ui` (incluida `prueba_calidad_ui`), `prueba_idioma`, `prueba_scroll`, `prueba_contrato`, `prueba_pin`, `prueba_cola`, `prueba_placeholder` | Playwright — **fases 2 y 3** |
| `legacy/sim` (el mes simulado) | Se corre sobre la app completa — **fase 3** |
| `prueba_velocidad`, `prueba_sistema`, `prueba_vivo`, `prueba_idioma_srv`, `prueba_mensajes`, `prueba_fotos` | Resolvían límites de Google Sheets (memoria, respaldos del libro, sello de cambios, traductor sobre el DOM): se reemplazan por lo que da el stack, con sus propias pruebas donde aplique |

## Riesgos

- **Fechas y zonas horarias.** El legacy ya tuvo un error de un día. Toda función de fechas se prueba con la
  zona de la empresa, y hay una prueba específica alrededor de medianoche y del cambio de horario.
- **Políticas RLS incompletas.** Una tabla sin política es una puerta abierta. Una prueba recorre todas las
  tablas del esquema y falla si alguna no tiene RLS activado.
- **Trasladar los parches del legacy.** Candados, numeración por última fila, memoria por ejecución: no se
  copian; se reemplazan por transacciones, secuencias y consultas bien hechas.
- **Que el alcance crezca.** La fase 1 es paridad y cimientos. Las mejoras se anotan para después.

## Decisiones pendientes del dueño

1. **Nombre del producto y dominio.**
2. ~~**Cómo entra el PM:** teléfono con código por mensaje, correo, o PIN en un dispositivo ya verificado.~~
   Decidido: PIN en un dispositivo ya verificado (D-024).
3. **Modelo de precio** para vender: por empresa, por usuario o por obra activa. Afecta el modelo de datos
   de la fase 4.
4. **Región de los datos** en Supabase: Estados Unidos, por los clientes en Texas.
5. **¿Separar "dueño" y "administrador"** como roles distintos? Por ejemplo, una asistente que registra
   pagos pero no ve márgenes.

## Primer mensaje para Claude Code

Con el repositorio abierto — `CLAUDE.md` en la raíz y el legacy en `legacy/` —:

> Lee `CLAUDE.md`, `docs/PLAN_FASE_1.md` y `docs/MODELO_DE_DATOS.md`. Luego revisa `legacy/app/fuente/` y
> `legacy/pruebas/` para entender el sistema actual. Antes de escribir código, dame tu plan para el paso 1
> y dime qué dudas tienes del modelo de datos. No avances al paso 2 hasta que el paso 1 esté terminado y lo
> revisemos juntos.
