// Pruebas de pantalla (fase 2, paso 7): la app ya compilada (`pnpm build`), contra la base local de
// `supabase start`, en el tamaño de un teléfono. `pnpm e2e` deja la base como la deja el seed antes de empezar.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// las llaves de la base local, las mismas que usa la app
const ENV = 'apps/web/.env.local';
if (existsSync(ENV)) process.loadEnvFile(ENV);

// otro puerto que `pnpm dev`, para poder correrlas con la app abierta
const PUERTO = 3100;
const URL = `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: 'apps/web/e2e',
  globalSetup: './apps/web/e2e/preparar.ts',
  // todas escriben en la misma base: una a la vez
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: URL,
    locale: 'es-MX',
    timezoneId: 'America/Chicago',
    trace: 'retain-on-failure',
    // una cámara de mentiras para la selfie de la checada (D-117), sin pedir permiso
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  webServer: {
    command: `pnpm --filter @ijm/web exec next start -p ${PUERTO}`,
    url: URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
