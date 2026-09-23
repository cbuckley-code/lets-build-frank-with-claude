// Every tool Frank exposes, in one list. Add new tools here (ADR-002).
import type { Config } from '../config.js';
import { erase, type FrankTool } from './define.js';
import { makeGetStatus } from './get_status.js';

export {
  defineTool,
  registerTools,
  runTool,
  safeMessage,
  ToolError,
  ALLOWED_VERBS,
  TOOL_NAME_PATTERN,
} from './define.js';
export type { FrankTool, ToolOutput } from './define.js';

export function createTools(config: Config): FrankTool[] {
  return [erase(makeGetStatus(config.version, config.startedAt))];
}
