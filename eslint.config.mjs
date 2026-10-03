import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // el legacy es de solo lectura; el esquema de Drizzle se genera con `pnpm db:esquema`
    ignores: [
      'legacy/**',
      'packages/db/src/esquema/generado/**',
      '**/.next/**',
      '**/node_modules/**',
      'supabase/.temp/**',
      '**/next-env.d.ts',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  ...nextVitals.map((c) => ({ ...c, files: ['apps/web/**/*.{ts,tsx}'] })),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web' } },
  },
  prettier,
);
