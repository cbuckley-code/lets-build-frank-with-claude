// ADR-009: Frank reads his own resource group, and only his own.
//
// Both tools resolve from one listing of the group. That avoids per-provider
// API versions (ARM has no get-by-name-in-a-group operation), and one response
// serves both. The listing is cached for 30 seconds: the whole class shares one
// identity, and ARM throttles it.
//
// Read-only by construction (ADR-002): the only ARM operation this module
// reaches for is a list.
import type { AzureConfig } from './config.js';

/** One resource as Frank reports it. A flat shape the console can table directly. */
export interface AzureResource {
  name: string;
  /** Full ARM type, e.g. "Microsoft.App/containerApps". */
  type: string;
  location: string;
  tags: Record<string, string>;
  sku?: string;
  provisioningState?: string;
  createdTime?: string;
  changedTime?: string;
}

export interface ResourceReader {
  /** Every resource in Frank's own resource group. Throws if Azure is unconfigured. */
  listResources(): Promise<AzureResource[]>;
}

export const CACHE_TTL_MS = 30_000;

export const NOT_CONFIGURED =
  'Frank has no Azure settings, so he cannot see his resource group. ' +
  'The deploy injects AZURE_SUBSCRIPTION_ID and AZURE_RESOURCE_GROUP (ADR-010); running locally, they are unset.';

/** What `createResourceReader` wraps. Separated so tests can supply their own. */
export type FetchResources = (azure: AzureConfig) => Promise<AzureResource[]>;

/**
 * Talk to ARM. The SDK is imported here, on first call, rather than at module
 * load: Frank must boot and serve `get_status` with no Azure access, and
 * `npm test` must run offline (ADR-009).
 */
export const fetchFromAzure: FetchResources = async (azure) => {
  const [{ ResourceManagementClient }, { DefaultAzureCredential }] = await Promise.all([
    import('@azure/arm-resources'),
    import('@azure/identity'),
  ]);
  const client = new ResourceManagementClient(new DefaultAzureCredential(), azure.subscriptionId);

  const resources: AzureResource[] = [];
  // The async iterator follows nextLink to the end, so a group larger than one
  // page does not silently truncate. provisioningState and the timestamps only
  // come back when asked for.
  const page = client.resources.listByResourceGroup(azure.resourceGroup, {
    expand: 'provisioningState,createdTime,changedTime',
  });
  for await (const raw of page) {
    resources.push({
      name: raw.name ?? '(unnamed)',
      type: raw.type ?? '(untyped)',
      location: raw.location ?? '(unknown)',
      tags: raw.tags ?? {},
      sku: raw.sku?.name ?? undefined,
      provisioningState: raw.provisioningState ?? undefined,
      createdTime: raw.createdTime?.toISOString(),
      changedTime: raw.changedTime?.toISOString(),
    });
  }
  return resources;
};

/**
 * A reader over one resource group, with the 30-second cache both tools share.
 * A failed call is not cached, so a transient ARM error does not stick for
 * half a minute.
 */
export function createResourceReader(
  azure: AzureConfig | undefined,
  fetchResources: FetchResources = fetchFromAzure,
  now: () => number = Date.now,
): ResourceReader {
  let cache: { at: number; resources: AzureResource[] } | undefined;
  let inFlight: Promise<AzureResource[]> | undefined;

  return {
    async listResources() {
      if (!azure) throw new Error(NOT_CONFIGURED);
      if (cache && now() - cache.at < CACHE_TTL_MS) return cache.resources;
      // Thirty consoles polling at once should cost one ARM call, not thirty.
      if (!inFlight) {
        inFlight = fetchResources(azure)
          .then((resources) => {
            cache = { at: now(), resources };
            return resources;
          })
          .finally(() => {
            inFlight = undefined;
          });
      }
      return inFlight;
    },
  };
}
