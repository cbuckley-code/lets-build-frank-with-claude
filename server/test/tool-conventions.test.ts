/**
 * ADR-002 is a policy, so it gets a test. A PR that adds `delete_resource_group`
 * or a tool with no description fails here, in CI, before a human reads it.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ALLOWED_VERBS, TOOL_NAME_PATTERN, TOOLS, defineTool } from "../src/tools/index.js";

describe("ADR-002 tool conventions", () => {
  it("registers at least one tool", () => {
    expect(TOOLS.length).toBeGreaterThan(0);
  });

  it("names every tool verb_noun using the closed verb set", () => {
    for (const tool of TOOLS) {
      expect(tool.name, `${tool.name} must be verb_noun`).toMatch(TOOL_NAME_PATTERN);
      const verb = tool.name.split("_")[0] as (typeof ALLOWED_VERBS)[number];
      expect(ALLOWED_VERBS).toContain(verb);
    }
  });

  it("excludes the mutating verbs", () => {
    for (const forbidden of ["create", "update", "delete", "run"]) {
      expect(ALLOWED_VERBS).not.toContain(forbidden);
    }
  });

  it("gives every tool a description a model could choose on", () => {
    for (const tool of TOOLS) {
      expect(tool.description.trim().length).toBeGreaterThan(20);
      expect(tool.title.trim().length).toBeGreaterThan(0);
    }
  });

  const spec = {
    title: "Example",
    description: "An example tool used only to prove that policy is enforced at build time.",
    inputSchema: z.object({}).strict(),
    outputSchema: z.object({ summary: z.string() }).strict(),
    handler: () => ({ content: [{ type: "text" as const, text: "{}" }] }),
  };

  it.each(["delete_resource_group", "create_thing", "update_thing", "run_thing"])(
    "refuses to define an out-of-policy tool: %s",
    (name) => {
      expect(() => defineTool({ ...spec, name })).toThrow(/out of policy/i);
    },
  );

  it.each(["getStatus", "get", "Get_Status", "get-status", "summarise_costs"])(
    "refuses a malformed tool name: %s",
    (name) => {
      expect(() => defineTool({ ...spec, name })).toThrow(/out of policy/i);
    },
  );

  it("accepts a well-formed name", () => {
    expect(() => defineTool({ ...spec, name: "list_resource_groups" })).not.toThrow();
  });

  it("requires a description", () => {
    expect(() => defineTool({ ...spec, name: "get_thing", description: "  " })).toThrow(
      /needs a description/i,
    );
  });
});
