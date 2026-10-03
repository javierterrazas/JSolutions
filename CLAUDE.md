# IJM — Gestión de obra para contratistas de remodelación

Este repositorio es la **migración a SaaS** del sistema IJM, que hoy corre en Google Sheets + Apps Script y
se pilotea en una empresa de remodelación de baños, cocinas y closets en Austin, TX. El objetivo es venderlo
a pequeños contratistas — muchos latinos en Texas —: multiempresa, bilingüe ES/EN y pensado para el celular
del PM en obra.

## Lo que no está en el código

- **Dos roles con necesidades opuestas.** El **dueño/administrador** ve todo el negocio. El **PM** registra
  desde su teléfono lo que pasa en obra. **El PM nunca ve dinero del negocio**: contratos, presupuestos,
  márgenes, tarifas de la cuadrilla, precios de subcontratistas, cobros ni pagos. Es la **muralla
  financiera**, la regla más importante del sistema.
- **El PM trabaja con mala señal**, con prisa y al final del día. Cada pantalla suya debe resolverse en
  segundos y funcionar sin conexión.
- **El dueño cotiza por fuera** y captura un **costo** esperado por **etapa = tipo de trabajo** (demolición,
  plomería, eléctrico, tile…), no por partida y no el precio al cliente.

## El sistema anterior es la especificación

`legacy/` contiene el sistema actual completo **y sus pruebas**. Es de solo lectura: no se modifica.

- `legacy/app/fuente/` — el código en módulos: `comun/` (compartido), `admin/`, `pm/`, `cliente/`.
- `legacy/pruebas/` y `legacy/sim/` — 41 pruebas y la simulación de un mes de obra. Describen con precisión
  cómo debe comportarse el sistema. `legacy/correr_pruebas.sh` las corre.
- `legacy/app/Gestion_Obra_IJM.xlsx` — el libro de 28 hojas con datos de ejemplo.

Ante una duda de negocio, **la respuesta está en el código y las pruebas de `legacy/`**, no en suposiciones.
Si una regla del legacy parece un error, pregúntalo antes de "corregirla". Lo que era un parche de Google
Sheets (candados, numeración leyendo la última fila, memoria por ejecución, sello de cambios) **no** se
traslada: se resuelve con lo que da PostgreSQL.

## Stack

- **Next.js** (App Router) + **TypeScript** estricto, monorepo con **pnpm workspaces**.
- **Supabase**: PostgreSQL, Auth, Storage y **Row Level Security (RLS)**.
- **Drizzle** para consultas tipadas; migraciones SQL versionadas en `supabase/migrations/`.
- **Zod** para validar entradas. **Vitest** para unidad, paridad, RLS e integración; **Playwright** para
  pruebas de extremo a extremo.
- **next-intl** para ES/EN. La app del PM será una PWA con cola sin conexión (IndexedDB) en la fase 2.
- Despliegue en **Vercel**. Cobro con **Stripe** en la fase 4.

## Estructura

```
apps/web/          Next.js: pantallas del dueño y del PM, y la capa de servidor
packages/core/     reglas de negocio puras (sin base de datos ni red): cronograma, etapas, avance,
                   validaciones, indicadores. Aquí vive la paridad con el legacy
packages/db/       esquema Drizzle, tipos y acceso a datos
supabase/          configuración local, migraciones SQL, políticas RLS y datos de prueba
legacy/            el sistema anterior y sus pruebas (solo lectura)
docs/              plan de fases, modelo de datos y registro de decisiones
```

## Reglas que no se negocian

1. **La muralla financiera vive en la base de datos.** Las tablas con dinero tienen RLS que solo permite a
   dueño y administrador; un PM no puede leerlas aunque el código de la app tenga un error. **Nunca se
   debilita una política RLS para que pase una prueba.** Por la API los usuarios solo leen: toda escritura la
   hace el servidor (usuario `ijm_servidor`, rol `servidor_app`) con la identidad del usuario, bajo RLS (D-026,
   D-027). El `service role` no se usa para operaciones de usuarios.
2. **Multiempresa.** Toda tabla de negocio lleva `empresa_id` y RLS aísla empresas. Ninguna consulta cruza
   empresas. El `service role` de Supabase solo se usa en migraciones, importación y tareas programadas.
3. **El PM ve solo las obras que tiene asignadas.**
4. **Nada se borra.** Correcciones y anulaciones dejan rastro: quién, qué, cuándo, antes, después y motivo.
5. **Fechas locales.** Se guardan como `timestamptz`; los días hábiles, "hoy", los plazos y los cortes se
   calculan en la zona horaria de la empresa (por defecto `America/Chicago`). Una fecha capturada como
   `2026-10-30` es ese día local: el legacy tuvo un error de un día por interpretarla como medianoche UTC.
6. **Validaciones en un solo mensaje** que lista todo lo que falta: `Faltan: cliente, fecha de entrega.`
7. **Paridad.** Las reglas de `packages/core` deben dar los mismos resultados que el legacy. Toda diferencia
   intencional se anota en `docs/DECISIONES.md`.
8. **Bilingüe desde el inicio.** Ningún texto visible queda fijo en el código. Los datos se guardan en forma
   canónica y se traducen al mostrarse.

## Reglas de negocio clave

El detalle está en `legacy/`; esto es el mapa.

- **Estados de obra:** Sin presupuesto → Lista para arranque → En obra → En cierre → Entregada. Arranca solo
  con presupuesto completo (cada espacio con al menos una etapa con monto); pasa a "En obra" con el primer
  día de trabajo; a "En cierre" al registrar la entrega.
- **Alta de obra:** cliente, teléfono de 10 dígitos, dirección, PM activo, fechas (entrega no antes del
  inicio), contrato mayor a cero y pies² de cada espacio. Mismo cliente y dirección activos pide confirmar.
  La fecha de entrega se propone desde el cronograma de las plantillas.
- **Partidas por obra:** cada espacio copia las del catálogo al crearse; editar el catálogo no afecta obras
  en curso.
- **Presupuesto por etapa:** un costo por etapa y espacio; la cantidad son los pies² del espacio. Margen
  esperado con avisos (menos de 10%: quizá se capturaron precios; más de 70%: quizá falta una etapa).
- **Cierre de día:** partidas trabajadas y terminadas; cuadrilla por hora (máximo 16 h al día sumando obras)
  o por día (día completo o medio, máximo uno al día sumando obras); subs que llegaron; al menos una foto,
  que puede subir después, numerada para que un reintento no la duplique. "Hoy no hubo trabajo" con motivo
  cuenta como cierre. El PM puede cerrar tarde solo los últimos 2 días hábiles; más atrás, el dueño con
  motivo. Queda marcado como tarde.
- **Calidad:** puntos de control PC1–PC5. Una partida con punto de control no se termina sin su inspección
  aprobada. "No aplica" por pregunta, con al menos una que aplique. Foto solo en los 9 puntos críticos y al
  menos una por inspección. PC3 exige una prueba de inundación de 24 h sin fuga.
- **Avance ponderado** por el peso (esfuerzo) de cada partida: el mismo número para PM y dueño.
- **Cronograma calculado, no dibujado:** días hábiles, partidas en paralelo y días de espera por
  fabricación. Plan congelado contra previsión con la realidad; atraso previsto contra la fecha comprometida
  (entrega estimada más días de órdenes de cambio autorizadas). "Esta semana": subs por programar, confirmaciones
  faltantes y choques. Cumplimiento semanal (PPC) congelado cada lunes.
- **Subcontratistas:** órdenes de trabajo a precio cerrado ligadas a una partida; papeles (seguro, licencia
  de Texas en plomería, electricidad y HVAC, W-9) con advertencias; confirmación escrita; faltas al
  reprogramar; la aprobación del PM libera el pago; cada advertencia de pago se confirma una por una.
- **Órdenes de cambio:** margen mínimo configurable; se ejecutan solo autorizadas; sus días se suman a la
  fecha comprometida.
- **Gastos:** todo gasto va a una obra; las compras del PM arriba del límite van a revisión; recibo en 72 h;
  las compras de la oficina no cuentan contra el límite.
- **Correcciones:** el PM, 48 h; el dueño, sin límite salvo en obras cerradas. Siempre con motivo.
- **Cierre de obra:** el pre-cierre lista pendientes; al cerrar se congelan margen, desvío, días de ciclo y
  costo de no calidad. De ahí salen los costos unitarios por etapa (costo real entre pies²) y las duraciones
  reales por partida.
- **19 indicadores** con metas configurables: los seis del lunes y trece más.

## Cómo trabajar aquí

- Antes de un cambio grande, escribe el plan y confírmalo antes de programar.
- Cambios pequeños y con pruebas. `pnpm test` en verde antes de cada commit.
- No agregues una dependencia sin explicar por qué.
- **El dominio va en español**, sin acentos en identificadores: `obras`, `espacios`, `partidas`, `etapas`,
  `bitacora`, `avance`. Comentarios en español. No mezcles traducciones del dominio.
- Si algo del negocio no está claro, pregunta. No inventes reglas.
- Mantén `docs/DECISIONES.md` al día con cada decisión de diseño y cada diferencia intencional con el legacy.
- Toda tabla nueva pasa por `select public.preparar_tabla('public.<tabla>')` en su migración (RLS, permisos y
  disparadores de auditoría) y lleva sus políticas; `pnpm test:rls` falla si falta algo.
- Los días laborables y "hoy" dependen del calendario y la zona de cada empresa: `packages/core` los recibe como
  argumento, nunca los supone (D-028).

## Comandos

```
pnpm install            instalar
supabase start          base de datos local (requiere Docker)
pnpm test               todas las pruebas de Vitest
pnpm test:paridad       reglas de packages/core contra el legacy
pnpm test:rls           la muralla financiera y el aislamiento entre empresas
pnpm db:reset           recrea la base local desde supabase/migrations/
pnpm db:esquema         regenera el esquema de Drizzle desde la base (después de cambiar una migración)
pnpm dev                la app en desarrollo
pnpm e2e                Playwright
```

## Documentos

- `docs/PLAN_FASE_1.md` — la fase en curso, con sus criterios de terminado.
- `docs/MODELO_DE_DATOS.md` — las tablas, sus relaciones y quién puede leer qué.
- `docs/DECISIONES.md` — el registro de decisiones.
