const fs = require('node:fs');
const Module = require('node:module');
const esbuild = require('esbuild');

const compileWithEsbuild = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = esbuild.transformSync(source, {
    loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
    format: 'cjs',
    target: 'es2021',
    jsx: 'automatic'
  });
  module._compile(code, filename);
};

Module._extensions['.ts'] = compileWithEsbuild;
Module._extensions['.tsx'] = compileWithEsbuild;

const runTests = async () => {
  const tests = [
    './app.smoke.cjs',
    './app.batch.cjs',
    './storage.test.cjs',
    './batch-claiming.test.cjs',
    './problem-report.test.cjs',
    './offline-sync.test.cjs'
  ];
  for (const test of tests) {
    const result = require(test);
    if (result && typeof result.then === 'function') {
      await result;
    }
  }
};

runTests().catch(error => {
  console.error('❌ Driver tests 失敗', error && error.stack ? error.stack : error);
  process.exit(1);
});
