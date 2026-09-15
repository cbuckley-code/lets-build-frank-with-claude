// ADR-009 as a test. Nothing here touches Azure: the reader is fed a fake
// fetch, so `npm test` passes offline inside `docker build` (CLAUDE.md).
import { describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, NOT_CONFIGURED, createResourceReader, type AzureResource } from '../src/azure.js';
import { createTools } from '../src/tools/index.js';
import { loadConfig } from '../src/config.js';

const app: AzureResource = {
  name: 'frank-buckshot',
  type: 'Microsoft.App/containerApps',
  location: 'eastus',
  tags: { owner: 'buckshot' },
  provisioningState: 'Succeeded',
  sku: 'Consumption',
};
// Same name as the container app, different type — the collision ADR-009 is
// explicit about, and the reason get_resource insists on a type.
const registry: AzureResource = {
  name: 'frank-buckshot',
  type: 'Microsoft.ContainerRegistry/registries',
  location: 'eastus',
  tags: {},
};
const env: AzureResource = {
  name: 'frank-class-env',
  type: 'Microsoft.App/managedEnvironments',
  location: 'eastus',
  tags: {},
};

const GROUP = [app, registry, env];
const azure = { subscriptionId: 'sub-1', resourceGroup: 'rg-class' };

function toolsOver(resources: AzureResource[] = GROUP) {
  const reader = createResourceReader(azure, async () => resources);
  const config = { ...loadConfig({ PORT: '0' }), azure };
  const tools = createTools(config, reader);
  const byName = (name: string) => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`no tool named ${name}`);
    return tool;
  };
  return { list: byName('list_resources'), get: byName('get_resource') };
}

describe('list_resources (ADR-009)', () => {
  it('returns every resource in the group with the four listed fields', async () => {
    const out = await toolsOver().list.handler({});
    expect(out.count).toBe(3);
    expect(out.summary).toBe('The resource group holds 3 resources.');
    expect(out.resources).toEqual([
      { name: 'frank-buckshot', type: 'Microsoft.App/containerApps', location: 'eastus', tags: { owner: 'buckshot' } },
      { name: 'frank-buckshot', type: 'Microsoft.ContainerRegistry/registries', location: 'eastus', tags: {} },
      { name: 'frank-class-env', type: 'Microsoft.App/managedEnvironments', location: 'eastus', tags: {} },
    ]);
  });

  it('filters on the full ARM type, case-insensitively', async () => {
    const out = await toolsOver().list.handler({ type: 'microsoft.app/containerapps' });
    expect(out.count).toBe(1);
    expect(out.totalInGroup).toBe(3);
    expect(out.summary).toContain('out of 3');
  });

  it('says so plainly when the filter matches nothing', async () => {
    const out = await toolsOver().list.handler({ type: 'Microsoft.Sql/servers' });
    expect(out.count).toBe(0);
    expect(out.summary).toContain('Nothing of type "Microsoft.Sql/servers"');
  });

  it('handles an empty group', async () => {
    const out = await toolsOver([]).list.handler({});
    expect(out.summary).toBe('The resource group is empty.');
  });

  it('rejects a resource group parameter — the scope is not a parameter', () => {
    expect(toolsOver().list.inputSchema.safeParse({ resourceGroup: 'someone-elses-rg' }).success).toBe(false);
  });
});

describe('get_resource (ADR-009)', () => {
  it('returns the full detail for a name and type together', async () => {
    const out = await toolsOver().get.handler({ name: 'frank-buckshot', type: 'Microsoft.App/containerApps' });
    expect(out.resource).toEqual(app);
    expect(out.summary).toContain('provisioning state Succeeded');
  });

  it('distinguishes two resources that share a name', async () => {
    const { get } = toolsOver();
    const asApp = await get.handler({ name: 'frank-buckshot', type: 'Microsoft.App/containerApps' });
    const asRegistry = await get.handler({ name: 'frank-buckshot', type: 'Microsoft.ContainerRegistry/registries' });
    expect((asApp.resource as AzureResource).type).not.toBe((asRegistry.resource as AzureResource).type);
  });

  it('names the types that do exist when only the type is wrong', async () => {
    await expect(toolsOver().get.handler({ name: 'frank-buckshot', type: 'Microsoft.Sql/servers' })).rejects.toThrow(
      /That name does exist with type "Microsoft.App\/containerApps", "Microsoft.ContainerRegistry\/registries"/,
    );
  });

  it('points at list_resources when the name is unknown', async () => {
    await expect(toolsOver().get.handler({ name: 'nope', type: 'Microsoft.App/containerApps' })).rejects.toThrow(
      /Call list_resources/,
    );
  });

  it('requires both name and type', () => {
    const { get } = toolsOver();
    expect(get.inputSchema.safeParse({ name: 'frank-buckshot' }).success).toBe(false);
    expect(get.inputSchema.safeParse({ type: 'Microsoft.App/containerApps' }).success).toBe(false);
  });
});

describe('the reader (ADR-009)', () => {
  it('fetches once for both tools, then serves from the 30-second cache', async () => {
    const fetch = vi.fn(async () => GROUP);
    const reader = createResourceReader(azure, fetch);
    await Promise.all([reader.listResources(), reader.listResources(), reader.listResources()]);
    await reader.listResources();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the cache has expired', async () => {
    const fetch = vi.fn(async () => GROUP);
    let clock = 0;
    const reader = createResourceReader(azure, fetch, () => clock);
    await reader.listResources();
    clock += CACHE_TTL_MS + 1;
    await reader.listResources();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure', async () => {
    const fetch = vi
      .fn<() => Promise<AzureResource[]>>()
      .mockRejectedValueOnce(new Error('ARM said no'))
      .mockResolvedValueOnce(GROUP);
    const reader = createResourceReader(azure, fetch);
    await expect(reader.listResources()).rejects.toThrow('ARM said no');
    await expect(reader.listResources()).resolves.toEqual(GROUP);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('unconfigured Frank (ADR-009)', () => {
  const unconfigured = loadConfig({ PORT: '0' });

  it('loads a config with no Azure settings rather than throwing', () => {
    expect(unconfigured.azure).toBeUndefined();
  });

  it('treats a half-configured environment as unconfigured', () => {
    expect(loadConfig({ PORT: '0', AZURE_SUBSCRIPTION_ID: 'sub-1' }).azure).toBeUndefined();
    expect(loadConfig({ PORT: '0', AZURE_RESOURCE_GROUP: 'rg-class' }).azure).toBeUndefined();
    expect(loadConfig({ PORT: '0', AZURE_SUBSCRIPTION_ID: 'sub-1', AZURE_RESOURCE_GROUP: 'rg-class' }).azure).toEqual(
      azure,
    );
  });

  it('still lists both Azure tools', () => {
    expect(createTools(unconfigured).map((t) => t.name)).toEqual(['get_status', 'list_resources', 'get_resource']);
  });

  it('answers with a plain-language error, and never builds a client', async () => {
    const fetch = vi.fn(async () => GROUP);
    const tools = createTools(unconfigured, createResourceReader(undefined, fetch));
    const list = tools.find((t) => t.name === 'list_resources')!;
    await expect(list.handler({})).rejects.toThrow(NOT_CONFIGURED);
    expect(fetch).not.toHaveBeenCalled();
  });
});
