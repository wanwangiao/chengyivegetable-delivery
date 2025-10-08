#!/usr/bin/env node
const { execSync } = require('node:child_process');

const target = process.env.RAILWAY_BUILD_TARGET || 'api';

const run = (cmd, options = {}) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
};

if (target === 'api') {
  console.log('Starting API deployment runtime');
  run('pnpm --filter api build');
  run('node --experimental-specifier-resolution=node apps/api/dist/index.js');
} else if (target === 'web') {
  console.log('Starting Web deployment runtime');
  run('pnpm --filter web build');
  run('pnpm --filter web start');
} else {
  throw new Error(`Unsupported RAILWAY_BUILD_TARGET: ${target}`);
}
