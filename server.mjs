// Application entry point for hosts that start the app by file path
// (Hostinger's "Entry file", Passenger, PM2, and similar).
//
// The real server is bundled to artifacts/api-server/dist/index.mjs by the
// build. That path only exists after a build, so it cannot be named directly
// as the entry file on a host that checks the repository. This file is
// committed, so it always exists, and it fails loudly instead of silently
// when the build output is missing.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const builtServer = new URL('./artifacts/api-server/dist/index.mjs', import.meta.url);

if (!existsSync(fileURLToPath(builtServer))) {
  console.error(
    'Build output not found at artifacts/api-server/dist/index.mjs.\n' +
      'Run the build first: `pnpm run build` (or `node scripts/build-deploy.mjs`).',
  );
  process.exit(1);
}

await import(builtServer.href);
