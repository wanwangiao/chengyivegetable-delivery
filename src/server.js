#!/usr/bin/env node
const { execSync } = require('node:child_process');

const target = process.env.RAILWAY_BUILD_TARGET || 'api';

const run = (cmd, options = {}) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
};

const buildSharedPackages = () => {
  ['config', 'domain', 'lib'].forEach(pkg => {
    run(`pnpm --filter ${pkg} build`);
  });
};

if (target === 'api') {
  console.log('Starting API deployment runtime');
  buildSharedPackages();
  run('pnpm --filter api prisma generate');
  run('pnpm --filter api build');
  run('node --experimental-specifier-resolution=node apps/api/dist/index.js');
} else if (target === 'web') {
  console.log('Starting Web deployment runtime');
  buildSharedPackages();
  run('pnpm --filter web build');
  run('pnpm --filter web exec next start');
} else if (target === 'driver') {
  console.log('Starting Driver web runtime');
  buildSharedPackages();
  const port = process.env.PORT ?? '3000';
  run(`pnpm --filter driver exec expo start --web --non-interactive --port ${port}`);
} else {
  throw new Error(`Unsupported RAILWAY_BUILD_TARGET: ${target}`);
}
