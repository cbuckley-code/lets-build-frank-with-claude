/** The shapes the console needs from Frank. Kept narrow on purpose. */

/** A JSON Schema property, as far as the console cares about it. */
export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
}

/** A tool's input schema, as advertised over MCP discovery. */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  annotations?: { readOnlyHint?: boolean };
}

/** The payload of `get_status` (ADR-002). */
export interface FrankStatus {
  summary: string;
  version: string;
  uptimeSeconds: number;
  startedAt: string;
  greeting: string;
}

export interface ToolCallOutcome {
  isError: boolean;
  /** The text block Frank returned — JSON on success, a sentence on failure. */
  text: string;
  /** The structured payload, when Frank supplied one. */
  structured?: unknown;
}

/**
 * Everything the console does with Frank. The pages depend on this interface
 * rather than on the MCP SDK, so tests can drive them without a network.
 */
export interface FrankClient {
  getStatus(): Promise<FrankStatus>;
  listTools(): Promise<ToolInfo[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallOutcome>;
}
