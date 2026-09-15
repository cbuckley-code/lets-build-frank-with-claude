// ADR-009: one resource in detail.
//
// Name *and* ARM type, both required. An ARM name is unique only per type
// within a group, so a name on its own can match two different resources —
// asking for the type is what stops Frank quietly returning the wrong one.
import { z } from 'zod';
import { defineTool } from './define.js';
import type { AzureResource, ResourceReader } from '../azure.js';

export function makeGetResource(reader: ResourceReader) {
  return defineTool({
    name: 'get_resource',
    description:
      'Returns one Azure resource from Frank\'s own resource group in detail: location, tags, SKU, ' +
      'provisioning state and timestamps. Identify it by name and ARM type together — a name alone is ' +
      'unique only per type. Use list_resources first if you do not know the exact type.',
    input: {
      name: z.string().min(1).describe('Exact resource name, as list_resources reports it. Case-insensitive.'),
      type: z
        .string()
        .min(1)
        .describe(
          'Full ARM type of that resource, e.g. "Microsoft.App/containerApps". Required: a name alone is ' +
            'unique only per type within a resource group.',
        ),
    },
    handler: async ({ name, type }) => {
      const all = await reader.listResources();
      const wantedName = name.trim().toLowerCase();
      const wantedType = type.trim().toLowerCase();

      const match = all.find((r) => r.name.toLowerCase() === wantedName && r.type.toLowerCase() === wantedType);
      if (!match) throw new Error(noMatchMessage(all, name, type, wantedName));

      return {
        summary:
          `${match.name} (${match.type}) is in ${match.location}` +
          (match.provisioningState ? `, provisioning state ${match.provisioningState}` : '') +
          '.',
        resource: match,
      };
    },
  });
}

/** Plain language, and specific about *why* it missed — never a stack trace (ADR-002). */
function noMatchMessage(all: AzureResource[], name: string, type: string, wantedName: string): string {
  const sameName = all.filter((r) => r.name.toLowerCase() === wantedName);
  if (sameName.length > 0) {
    const types = sameName.map((r) => `"${r.type}"`).join(', ');
    return `No resource named "${name}" of type "${type}" in this resource group. That name does exist with type ${types}.`;
  }
  return `No resource named "${name}" in this resource group. Call list_resources to see what is there.`;
}
