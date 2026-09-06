/** ADR-002's first tool: schema and payload shape. */
import { describe, expect, it } from "vitest";
import { getStatusInput, getStatusOutput } from "../src/tools/get-status.js";
import { VERSION } from "../src/runtime.js";

describe("get_status schemas", () => {
  it("accepts an empty call", () => {
    expect(getStatusInput.safeParse({}).success).toBe(true);
  });

  it("accepts a name", () => {
    const parsed = getStatusInput.safeParse({ name: "the class" });
    expect(parsed.success && parsed.data.name).toBe("the class");
  });

  it("rejects unknown fields rather than ignoring them", () => {
    const parsed = getStatusInput.safeParse({ nmae: "typo" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(getStatusInput.safeParse({ name: "" }).success).toBe(false);
  });

  it("describes every parameter, so clients can render and reason about it", () => {
    expect(getStatusInput.shape.name.description).toBeTruthy();
  });

  it("requires a summary plus typed detail fields", () => {
    const valid = {
      summary: `Frank ${VERSION} is up, 0s since start.`,
      version: VERSION,
      uptimeSeconds: 0,
      startedAt: new Date().toISOString(),
      greeting: "Hello — Frank here.",
    };
    expect(getStatusOutput.safeParse(valid).success).toBe(true);

    const { summary: _dropped, ...withoutSummary } = valid;
    expect(getStatusOutput.safeParse(withoutSummary).success).toBe(false);
  });
});
