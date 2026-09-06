/**
 * ADR-002's output contract, in one place.
 *
 * Success: structured JSON with a top-level `summary` string plus typed detail
 * fields, returned both as readable text and as `structuredContent`.
 * Failure: `isError: true` with a plain-language message — never a stack trace.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Every Frank tool payload leads with a human/model-readable one-liner. */
export interface FrankPayload {
  summary: string;
}

/** Build a successful tool result from a typed payload. */
export function ok<T extends FrankPayload>(payload: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

/**
 * Build a failed tool result. `message` is shown to a human or a model, so it
 * must read as a sentence, not as a diagnostic.
 */
export function failure(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Reduce anything thrown to a single plain-language line. Deliberately reads
 * only `message`: a stack trace must never cross the wire (ADR-002).
 */
export function plainMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return "no further detail is available";
}
