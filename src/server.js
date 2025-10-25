#!/usr/bin/env node
const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const target = process.env.RAILWAY_BUILD_TARGET || 'api';

const run = (cmd, options = {}) => {
  console.log(`$ ${cmd}`);
  const mergedOptions = {
    stdio: 'inherit',
    ...options,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  };
  execSync(cmd, mergedOptions);
};

// 確保依賴已安裝
const nodeModulesPath = join(process.cwd(), 'node_modules');
if (!existsSync(nodeModulesPath) || !existsSync(join(nodeModulesPath, 'cloudinary'))) {
  console.log('Dependencies not found or incomplete, installing...');
  run('pnpm install --frozen-lockfile');
}

const buildSharedPackages = () => {
  ['config', 'domain', 'lib'].forEach(pkg => {
    run(`pnpm --filter ${pkg} build`);
  });
};

if (target === 'api') {
  console.log('Starting API deployment runtime');
  buildSharedPackages();
  run('pnpm --filter api prisma generate');
  run('pnpm --filter api exec tsx --tsconfig tsconfig.build.json src/index.ts');
} else if (target === 'web') {
  console.log('Starting Web deployment runtime');
  buildSharedPackages();
  run('pnpm --filter web build');
  run('pnpm --filter web exec next start');
} else if (target === 'driver') {
  console.log('Starting Driver web runtime');
  buildSharedPackages();

  // Build the Expo web app
  console.log('Building Expo app for web...');
  run('pnpm --filter driver build');

  // Serve the built static files
  const port = process.env.PORT ?? '3000';
  console.log(`Serving static files on port ${port}...`);
  run(`pnpm --filter driver exec npx serve dist -p ${port} -s`);
} else {
  throw new Error(`Unsupported RAILWAY_BUILD_TARGET: ${target}`);
}
