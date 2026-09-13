// All configuration comes from environment variables (ADR-001). No config
// files with values in them. Paths are derived from where this package lives.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// src/config.ts and dist/config.js are both one level below the package root.
export const packageRoot = fileURLToPath(new URL('..', import.meta.url));

export interface Config {
  /** TCP port to listen on. Must match the Dockerfile and deploy.yml (3000). */
  port: number;
  /** Where the built Cloudscape console lives. The image copies ui/dist here (ADR-006). */
  publicDir: string;
  /** Frank's version, from package.json. */
  version: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer between 0 and 65535, got "${rawPort}"`);
  }

  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version?: string };

  return {
    port,
    publicDir: join(packageRoot, 'public'),
    version: pkg.version ?? '0.0.0',
  };
}
