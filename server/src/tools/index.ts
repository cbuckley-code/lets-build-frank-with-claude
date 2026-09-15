// Every tool Frank exposes, in one list. Add new tools here (ADR-002).
import type { Config } from '../config.js';
import { createResourceReader, type ResourceReader } from '../azure.js';
import { erase, type FrankTool } from './define.js';
import { makeGetStatus } from './get_status.js';
import { makeListResources } from './list_resources.js';
import { makeGetResource } from './get_resource.js';

export { defineTool, registerTools, ALLOWED_VERBS, TOOL_NAME_PATTERN } from './define.js';
export type { FrankTool, ToolOutput } from './define.js';

/**
 * The Azure tools are listed whether or not Azure is configured (ADR-009):
 * unconfigured, they are discoverable and return a plain-language error when
 * called, rather than vanishing from the tool list.
 */
export function createTools(config: Config, reader: ResourceReader = createResourceReader(config.azure)): FrankTool[] {
  return [
    erase(makeGetStatus(config.version)),
    erase(makeListResources(reader)),
    erase(makeGetResource(reader)),
  ];
}
