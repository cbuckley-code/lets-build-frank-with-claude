/**
 * Configuration comes from environment variables only (ADR-001) — never from a
 * config file with values in it, and never from anything committed to the repo.
 */
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Where the built console lives. ADR-006 puts the Cloudscape build inside
 * Frank's own image as `server/public/`, so this resolves to the same place
 * whether Frank is running from `src/` (dev), `dist/` (build), or `/app`
 * (container).
 */
export const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

const envSchema = z.object({
  /**
   * deploy.yml deploys with `--target-port 3000`, so 3000 is not a preference —
   * it is the contract with the container's ingress.
   */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Containers must bind all interfaces to be reachable through ingress. */
  HOST: z.string().min(1).default("0.0.0.0"),
  /** Directory of static console files. Overridable mainly for tests. */
  PUBLIC_DIR: z.string().min(1).optional(),
});

export interface Config {
  port: number;
  host: string;
  publicDir: string;
}

/**
 * Reads and validates configuration. Throws a plain-language error on bad input
 * so a misconfigured container fails at boot rather than at first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Frank's environment configuration is invalid — ${detail}`);
  }

  return {
    port: parsed.data.PORT,
    host: parsed.data.HOST,
    publicDir: parsed.data.PUBLIC_DIR ?? DEFAULT_PUBLIC_DIR,
  };
}
