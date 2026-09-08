/**
 * `list_resources` — what is actually running in Frank's own resource group.
 *
 * This is ADR-009's tool: the one that makes "Frank, what's running in your
 * resource group?" answerable. It authenticates with the Container App's
 * system-assigned managed identity (ADR-004) — there is no stored credential
 * anywhere — and reads ONLY the resource group Frank is deployed into.
 *
 * Deliberately no `resourceGroup` parameter. Frank cannot be pointed somewhere
 * else by a caller; the scope is read from the environment at boot.
 */
import { z } from "zod";
import { DefaultAzureCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { ok, failure, plainMessage } from "../result.js";
import { defineTool } from "./define.js";

export const listResourcesInput = z.object({}).strict();

export const listResourcesOutput = z
  .object({
    summary: z.string().describe("One line a human or model can read directly."),
    resourceGroup: z.string().describe("The resource group Frank is deployed into."),
    count: z.number().int().nonnegative().describe("How many resources were found."),
    resources: z
      .array(
        z.object({
          name: z.string().describe("The resource's name."),
          type: z.string().describe('Its Azure type, e.g. "Microsoft.App/containerApps".'),
          location: z.string().describe("The region it lives in."),
        }),
      )
      .describe("Every resource in Frank's own group. Never another group's."),
  })
  .strict();

export const listResourcesTool = defineTool({
  name: "list_resources",
  title: "List what is running in Frank's resource group",
  description:
    "Returns every Azure resource in the resource group Frank himself is deployed into — " +
    "name, type and region. Use it to answer questions about Frank's own environment. " +
    "It is read-only and cannot be pointed at any other resource group.",
  inputSchema: listResourcesInput,
  outputSchema: listResourcesOutput,
  async handler() {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
    if (!subscriptionId || !resourceGroup) {
      return failure(
        "Frank does not know which subscription or resource group he is in. " +
          "AZURE_SUBSCRIPTION_ID and AZURE_RESOURCE_GROUP must be set on the container app.",
      );
    }
    try {
      const client = new ResourceManagementClient(new DefaultAzureCredential(), subscriptionId);
      const resources: { name: string; type: string; location: string }[] = [];
      for await (const r of client.resources.listByResourceGroup(resourceGroup)) {
        resources.push({ name: r.name ?? "?", type: r.type ?? "?", location: r.location ?? "?" });
      }
      const kinds = [...new Set(resources.map((r) => r.type.split("/").pop() ?? "?"))];
      return ok({
        summary: `${resources.length} resources in ${resourceGroup}: ${kinds.join(", ")}.`,
        resourceGroup,
        count: resources.length,
        resources,
      });
    } catch (e) {
      return failure(
        "Frank could not read his resource group. This usually means the Reader role " +
          "has not been granted to his managed identity yet — your instructor does that " +
          `after the first deploy. (${plainMessage(e)})`,
      );
    }
  },
});
