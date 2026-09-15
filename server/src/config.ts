// All configuration comes from environment variables (ADR-001). No config
// files with values in them. Paths are derived from where this package lives.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// src/config.ts and dist/config.js are both one level below the package root.
export const packageRoot = fileURLToPath(new URL('..', import.meta.url));

/** The two Azure settings Frank's tools need (ADR-009). Injected by the deploy (ADR-010). */
export interface AzureConfig {
  subscriptionId: string;
  resourceGroup: string;
}

export interface Config {
  /** TCP port to listen on. Must match the Dockerfile and deploy.yml (3000). */
  port: number;
  /** Where the built Cloudscape console lives. The image copies ui/dist here (ADR-006). */
  publicDir: string;
  /** Frank's version, from package.json. */
  version: string;
  /**
   * Azure settings, when the deploy injected them (ADR-009). Deliberately
   * optional: Frank boots and serves get_status with no Azure access at all,
   * so `npm test` runs offline inside `docker build`.
   */
  azure?: AzureConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer between 0 and 65535, got "${rawPort}"`);
  }

  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version?: string };

  // Both or neither. Half-configured is treated as unconfigured, and the tools
  // say so at call time rather than the container failing to start.
  const subscriptionId = env.AZURE_SUBSCRIPTION_ID?.trim();
  const resourceGroup = env.AZURE_RESOURCE_GROUP?.trim();

  return {
    port,
    publicDir: join(packageRoot, 'public'),
    version: pkg.version ?? '0.0.0',
    azure: subscriptionId && resourceGroup ? { subscriptionId, resourceGroup } : undefined,
  };
}
