// Production build for hosts that run the build inside a plain shell.
//
// Deliberately never shells out to pnpm/npm: a nested package-manager call
// fails on hosts that put the package manager on PATH for the install step
// only ("pnpm: command not found"). Everything here is invoked as `node <file>`
// against paths resolved from this repo, so it behaves the same everywhere.

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiServerDir = path.join(repoRoot, 'artifacts', 'api-server');
const frontendDir = path.join(repoRoot, 'artifacts', 'real-world-link');

function run(label, args, cwd) {
  console.log(`\n> ${label}`);
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

// Path to a file inside an installed package, resolved from the package that
// depends on it so pnpm's non-hoisted layout is respected. Goes via
// package.json because a package's "exports" usually hides its bin/ directory.
function packageFile(dir, packageName, relativePath) {
  const manifest = createRequire(path.join(dir, 'package.json')).resolve(`${packageName}/package.json`);
  return path.join(path.dirname(manifest), relativePath);
}

// The site is built first: the API server serves its output, and a stale or
// missing build would otherwise be published silently.
run('Building the site (vite)', [packageFile(frontendDir, 'vite', 'bin/vite.js'), 'build', '--config', 'vite.config.ts'], frontendDir);
run('Building the API server (esbuild)', [path.join(apiServerDir, 'build.mjs')], apiServerDir);

console.log('\nBuild complete.');
console.log('  site  ->', path.join(frontendDir, 'dist', 'public'));
console.log('  server->', path.join(apiServerDir, 'dist', 'index.mjs'));
