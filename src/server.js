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

  // Build Driver app with Vite
  console.log('Building Driver app with Vite...');
  run('pnpm --filter driver build');

  // Serve static files from dist directory
  const port = process.env.PORT ?? '8081';
  console.log(`Serving Driver app static files on port ${port}...`);

  run(`pnpm --filter driver exec npx serve dist -l tcp://0.0.0.0:${port} --no-port-switching --no-clipboard --cors`, {
    env: {
      NODE_ENV: 'production',
    },
  });
} else {
  throw new Error(`Unsupported RAILWAY_BUILD_TARGET: ${target}`);
}
