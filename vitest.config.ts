import { defineConfig } from 'vitest/config';

// Todas las pruebas corren en la zona de la empresa piloto: los días hábiles, "hoy" y los plazos dependen de ella.
const env = { TZ: 'America/Chicago' };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unidad',
          include: ['packages/*/src/**/*.test.ts', 'apps/web/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/.next/**'],
          env,
        },
      },
      {
        // reglas de packages/core contra el legacy cargado en Node
        test: {
          name: 'paridad',
          include: ['packages/core/pruebas/paridad/**/*.test.ts'],
          env,
          // el mes simulado del legacy se corre una vez, antes de todas las pruebas
          globalSetup: ['packages/core/pruebas/paridad/preparar.ts'],
        },
      },
      {
        // la muralla financiera y el aislamiento entre empresas; requiere `supabase start`
        test: { name: 'rls', include: ['packages/db/pruebas/rls/**/*.test.ts'], env, fileParallelism: false },
      },
      {
        // funciones del servidor contra la base local; requiere `supabase start`
        test: {
          name: 'integracion',
          include: [
            'packages/db/pruebas/integracion/**/*.test.ts',
            'apps/web/pruebas/integracion/**/*.test.ts',
            'packages/servidor/pruebas/**/*.test.ts',
          ],
          env,
          fileParallelism: false,
        },
      },
    ],
  },
});
