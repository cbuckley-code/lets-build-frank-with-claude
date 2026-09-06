/**
 * Configuration comes from environment variables only (ADR-001) — never from a
 * config file with values in it, and never from anything committed to the repo.
 */
import { z } from "zod";

const envSchema = z.object({
  /**
   * deploy.yml runs `az containerapp up --target-port 3000`, so 3000 is not a
   * preference — it is the contract with ADR-004's ingress.
   */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Containers must bind all interfaces to be reachable through ingress. */
  HOST: z.string().min(1).default("0.0.0.0"),
  /**
   * Comma-separated origins allowed to call Frank from a browser — the
   * Cloudscape console's origin (ADR-003). Empty means no cross-origin access.
   */
  CORS_ALLOWED_ORIGINS: z.string().default(""),
});

export interface Config {
  port: number;
  host: string;
  allowedOrigins: string[];
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
    allowedOrigins: parsed.data.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  };
}
