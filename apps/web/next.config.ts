import type { NextConfig } from 'next';

const config: NextConfig = {
  // los paquetes del monorepo se publican como TypeScript sin compilar
  transpilePackages: ['@ijm/core', '@ijm/db'],
};

export default config;
