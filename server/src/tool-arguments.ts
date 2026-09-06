/**
 * MCP lets a `tools/call` request omit `arguments` entirely when a tool has no
 * required parameters, and the official client does exactly that. A zod object
 * schema cannot validate `undefined`, so such a call would be rejected as
 * invalid input.
 *
 * Wrapping the schema to tolerate `undefined` is not an option: it collapses
 * the JSON Schema Frank advertises to `{"type":"object","properties":{}}`,
 * which would leave ADR-003's schema-driven forms with nothing to render. So
 * the request is normalised instead — an omitted `arguments` becomes `{}`.
 */

/** Fill in `arguments: {}` on any tools/call request that omitted it. */
export function fillMissingToolArguments(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(fillMissingToolArguments);
  }

  if (body === null || typeof body !== "object") {
    return body;
  }

  const message = body as { method?: unknown; params?: unknown };
  if (message.method !== "tools/call") {
    return body;
  }

  if (message.params === null || typeof message.params !== "object") {
    return body;
  }

  const params = message.params as Record<string, unknown>;
  if (params["arguments"] !== undefined) {
    return body;
  }

  return { ...message, params: { ...params, arguments: {} } };
}
