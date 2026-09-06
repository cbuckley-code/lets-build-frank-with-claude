/**
 * Facts about this running Frank process.
 *
 * The version is read from package.json at runtime rather than hard-coded, so
 * `get_status` can never drift from what was actually deployed. `../package.json`
 * resolves correctly from both `src/` (dev, tests) and `dist/` (build, container).
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/** Frank's package version, e.g. "0.1.0". */
export const VERSION: string = pkg.version;

/** When this process started. Captured once, at module load. */
export const STARTED_AT: Date = new Date();

/** Whole seconds this process has been running. */
export function uptimeSeconds(now: Date = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - STARTED_AT.getTime()) / 1000));
}

/** The Node.js runtime executing this process, e.g. "v22.11.0". */
export const NODE_VERSION: string = process.version;

/** Major version of that runtime, e.g. 22 — the number package.json's `engines` pins. */
export const NODE_MAJOR: number = Number.parseInt(process.versions.node, 10);
