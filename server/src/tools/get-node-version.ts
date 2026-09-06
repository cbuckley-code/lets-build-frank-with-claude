/**
 * `get_node_version` — which Node.js runtime this Frank process is on.
 *
 * Frank's deployed runtime is a contract (`engines: node >=22`, and the
 * container's base image), so it is worth being able to ask a running Frank
 * rather than inferring it from the Dockerfile.
 */
import { z } from "zod";
import { ok } from "../result.js";
import { NODE_MAJOR, NODE_VERSION } from "../runtime.js";
import { defineTool } from "./define.js";

/** No parameters: there is only one runtime to report on. Strict all the same. */
export const getNodeVersionInput = z.object({}).strict();

export const getNodeVersionOutput = z
  .object({
    summary: z.string().describe("One-line, human-readable runtime version."),
    nodeVersion: z
      .string()
      .describe('The full Node.js version, with its leading "v" — e.g. "v22.11.0".'),
    major: z
      .number()
      .int()
      .positive()
      .describe("The major Node.js version on its own — e.g. 22."),
    v8Version: z.string().describe("The version of V8 embedded in that Node.js build."),
    platform: z.string().describe('The host operating system — e.g. "linux", "darwin".'),
    arch: z.string().describe('The host CPU architecture — e.g. "x64", "arm64".'),
  })
  .strict();

export const getNodeVersionTool = defineTool({
  name: "get_node_version",
  title: "Get Frank's Node version",
  description:
    "Returns the Node.js version this Frank process is running on, plus its V8 version and " +
    "the host platform and architecture. Use it to confirm which runtime a deployed Frank " +
    "is using. It reports on Frank's own process only — not on any other machine or system.",
  inputSchema: getNodeVersionInput,
  outputSchema: getNodeVersionOutput,
  handler: () =>
    ok({
      summary: `Frank is running on Node ${NODE_VERSION} (${process.platform}/${process.arch}).`,
      nodeVersion: NODE_VERSION,
      major: NODE_MAJOR,
      v8Version: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    }),
});
