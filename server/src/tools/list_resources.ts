// ADR-009: what is deployed in Frank's own resource group.
//
// There is no resource group parameter, and no subscription parameter. The
// group comes from config, so no caller can steer Frank out of it.
import { z } from 'zod';
import { defineTool } from './define.js';
import type { ResourceReader } from '../azure.js';

export function makeListResources(reader: ResourceReader) {
  return defineTool({
    name: 'list_resources',
    description:
      'Lists every Azure resource in Frank\'s own resource group: name, full ARM type, location and tags. ' +
      'Use it to see what is deployed. Frank cannot read any other resource group, and the group is not a parameter. ' +
      'For SKU, provisioning state and timestamps on one resource, call get_resource.',
    input: {
      type: z
        .string()
        .optional()
        .describe(
          'Optional. Full ARM type to filter to, e.g. "Microsoft.App/containerApps". ' +
            'Matched case-insensitively against the whole type; omit it to list everything.',
        ),
    },
    handler: async ({ type }) => {
      const all = await reader.listResources();
      const wanted = type?.trim().toLowerCase();
      const resources = wanted ? all.filter((r) => r.type.toLowerCase() === wanted) : all;

      return {
        summary: summarize(all.length, resources.length, type),
        count: resources.length,
        totalInGroup: all.length,
        // The four fields a plain ARM listing gives. get_resource has the rest.
        resources: resources.map(({ name, type: armType, location, tags }) => ({
          name,
          type: armType,
          location,
          tags,
        })),
      };
    },
  });
}

function summarize(total: number, shown: number, type?: string): string {
  if (!type) {
    return total === 0
      ? 'The resource group is empty.'
      : `The resource group holds ${total} ${plural(total)}.`;
  }
  if (shown === 0) {
    return `Nothing of type "${type}" in the resource group, which holds ${total} ${plural(total)}.`;
  }
  return `${shown} ${plural(shown)} of type "${type}", out of ${total} in the resource group.`;
}

const plural = (n: number) => (n === 1 ? 'resource' : 'resources');
