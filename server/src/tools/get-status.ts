/**
 * `get_status` — Frank's first tool (ADR-002).
 *
 * It exists so the pipeline, the MCP client wiring, and the Cloudscape console
 * can all be proven end to end before any Azure integration exists.
 */
import { z } from "zod";
import { ok } from "../result.js";
import { STARTED_AT, VERSION, uptimeSeconds } from "../runtime.js";
import { defineTool } from "./define.js";

/** Strict: an unknown field is an error, not something to quietly ignore. */
export const getStatusInput = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe(
        "Who Frank should greet. Omit for a generic greeting. Used only in the returned text.",
      ),
  })
  .strict();

export const getStatusOutput = z
  .object({
    summary: z.string().describe("One-line, human-readable status."),
    version: z.string().describe("The version of Frank that is running."),
    uptimeSeconds: z
      .number()
      .int()
      .nonnegative()
      .describe("Whole seconds since this Frank process started."),
    startedAt: z
      .string()
      .describe("ISO-8601 timestamp of when this Frank process started."),
    greeting: z
      .string()
      .describe("A greeting, addressed to `name` when one was supplied."),
  })
  .strict();

export const getStatusTool = defineTool({
  name: "get_status",
  title: "Get Frank's status",
  description:
    "Returns Frank's version, how long this process has been running, and a greeting. " +
    "Use it to confirm Frank is reachable and to see which build is deployed. " +
    "It reports on Frank himself only — it says nothing about Azure or any other system.",
  inputSchema: getStatusInput,
  outputSchema: getStatusOutput,
  handler: ({ name }) => {
    const uptime = uptimeSeconds();
    const greeting = name ? `Hello, ${name} — Frank here.` : "Hello — Frank here.";

    return ok({
      summary: `Frank ${VERSION} is up, ${uptime}s since start.`,
      version: VERSION,
      uptimeSeconds: uptime,
      startedAt: STARTED_AT.toISOString(),
      greeting,
    });
  },
});
