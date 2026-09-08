/**
 * The tool registry. One module per tool (ADR-001); this file is the only place
 * that needs editing to expose a new one.
 */
import type { FrankTool } from "./define.js";
import { getNodeVersionTool } from "./get-node-version.js";
import { getStatusTool } from "./get-status.js";
import { listResourcesTool } from "./list-resources.js";

export const TOOLS: readonly FrankTool[] = [getStatusTool, getNodeVersionTool, listResourcesTool];

export { defineTool, ALLOWED_VERBS, TOOL_NAME_PATTERN } from "./define.js";
export type { FrankTool, ToolSpec } from "./define.js";
