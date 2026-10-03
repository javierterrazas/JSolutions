# IJM — Gestión de obra para contratistas de remodelación

Migración a SaaS del sistema IJM, que hoy corre en Google Sheets + Apps Script. El contexto del negocio y las
reglas que no se negocian están en [`CLAUDE.md`](CLAUDE.md); el plan de la fase en curso, en
[`docs/PLAN_FASE_1.md`](docs/PLAN_FASE_1.md).

## Lo que necesitas

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22.12 o más reciente | todo |
| [pnpm](https://pnpm.io) | 10 (la fija `package.json`) | instalar y correr scripts |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | reciente, **encendido** | la base local de Supabase |
| [Git](https://git-scm.com) | cualquiera reciente | — |

La CLI de Supabase **no** se instala aparte: viene como dependencia del repositorio y se usa con
`pnpm exec supabase …`.

**pnpm.** Si `pnpm -v` no responde: `npm install -g pnpm@10`. (También funciona `corepack enable`, pero en
Windows pide permisos de administrador.)

**Docker en Windows.** Docker Desktop usa WSL2. Si no arranca, abre PowerShell **como administrador**, corre
`wsl --install`, reinicia la computadora y vuelve a abrir Docker Desktop hasta que diga _Engine running_.

## Desde cero

```bash
git clone https://github.com/javierterrazas/JSolutions.git ijm
cd ijm
pnpm install
pnpm db:start          # la primera vez descarga las imágenes de Supabase: tarda varios minutos
pnpm test              # todas las pruebas
```

`pnpm db:start` imprime las direcciones y llaves de la base local. Copia `.env.example` como `.env.local`;
las pruebas usan esos mismos valores si no encuentran `DATABASE_URL`.

## Comandos

| Comando | Qué hace | ¿Necesita la base? |
| --- | --- | --- |
| `pnpm dev` | la app en desarrollo (http://localhost:3000) | sí, desde el paso 6 |
| `pnpm test` | todas las pruebas de Vitest | sí |
| `pnpm test:unidad` | pruebas de unidad de `packages/*` y `apps/web` | no |
| `pnpm test:paridad` | las reglas de `packages/core` contra el legacy | no |
| `pnpm test:rls` | la muralla financiera y el aislamiento entre empresas | sí |
| `pnpm test:integracion` | las funciones del servidor contra la base local | sí |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | revisión de código, tipos y formato | no |
| `pnpm db:start` · `pnpm db:stop` | levanta o detiene Supabase local, solo con lo que usan las pruebas (base, Auth, API y Storage) | — |
| `pnpm db:start:completo` | Supabase local con todos sus servicios, incluido Studio (http://127.0.0.1:54323) | — |
| `pnpm db:reset` | recrea la base desde `supabase/migrations/` y carga `supabase/seed.sql` | — |
| `pnpm db:esquema` | regenera el esquema de Drizzle desde la base; córrelo después de cambiar una migración y de `pnpm db:reset` | sí |

Todas las pruebas corren con `TZ=America/Chicago`, la zona de la empresa piloto.

## Usuarios de prueba

`pnpm db:reset` carga [`supabase/seed.sql`](supabase/seed.sql): dos empresas con usuarios reales de Supabase
Auth. **Solo existen en la base local.** Todos usan la contraseña `ijm-prueba-2026`.

| Correo | Empresa | Rol |
| --- | --- | --- |
| `dueno@empresa-a.test` | A · IJM Construction | dueño |
| `pm1@empresa-a.test` | A | PM de OB-001 (en obra) y OB-003 (entregada) |
| `pm2@empresa-a.test` | A | PM de OB-002 |
| `baja@empresa-a.test` | A | PM dado de baja |
| `dueno@empresa-b.test` | B · Remodelaciones del Valle | dueña |
| `pm1@empresa-b.test` · `pm2@empresa-b.test` | B | PMs; el primero, de su OB-001 |
| `sin-empresa@prueba.test` | ninguna | cuenta de Auth sin empresa |

## Estructura

```
apps/web/          Next.js: pantallas del dueño y del PM, y la capa de servidor
packages/core/     reglas de negocio puras; aquí vive la paridad con el legacy
packages/db/       esquema Drizzle, tipos y acceso a datos
supabase/          configuración local, migraciones SQL, políticas RLS y datos de prueba
legacy/            el sistema anterior y sus pruebas (solo lectura)
docs/              plan de fases, modelo de datos y registro de decisiones
```

## Integración continua

`.github/workflows/ci.yml` corre en cada cambio dos trabajos: formato, lint, tipos, unidad, paridad y la
compilación de la app; y, con Supabase local levantado dentro de la integración continua, las pruebas de RLS
y de integración.
