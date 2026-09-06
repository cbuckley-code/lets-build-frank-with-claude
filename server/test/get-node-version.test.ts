/** The runtime-reporting tool: schema and payload shape (ADR-002). */
import { describe, expect, it } from "vitest";
import {
  getNodeVersionInput,
  getNodeVersionOutput,
} from "../src/tools/get-node-version.js";
import { NODE_MAJOR, NODE_VERSION } from "../src/runtime.js";

describe("get_node_version schemas", () => {
  it("takes no parameters", () => {
    expect(getNodeVersionInput.safeParse({}).success).toBe(true);
    expect(Object.keys(getNodeVersionInput.shape)).toHaveLength(0);
  });

  it("rejects unknown fields rather than ignoring them", () => {
    expect(getNodeVersionInput.safeParse({ verbose: true }).success).toBe(false);
  });

  it("requires a summary plus typed detail fields", () => {
    const valid = {
      summary: `Frank is running on Node ${NODE_VERSION} (linux/x64).`,
      nodeVersion: NODE_VERSION,
      major: NODE_MAJOR,
      v8Version: process.versions.v8,
      platform: "linux",
      arch: "x64",
    };
    expect(getNodeVersionOutput.safeParse(valid).success).toBe(true);

    const { summary: _dropped, ...withoutSummary } = valid;
    expect(getNodeVersionOutput.safeParse(withoutSummary).success).toBe(false);
  });

  it("rejects a major that is not a whole positive number", () => {
    const base = {
      summary: "…",
      nodeVersion: NODE_VERSION,
      v8Version: process.versions.v8,
      platform: "linux",
      arch: "x64",
    };
    expect(getNodeVersionOutput.safeParse({ ...base, major: 22.5 }).success).toBe(false);
    expect(getNodeVersionOutput.safeParse({ ...base, major: 0 }).success).toBe(false);
  });
});

describe("runtime facts", () => {
  it("reports the Node version this process is actually on", () => {
    expect(NODE_VERSION).toBe(process.version);
    expect(NODE_MAJOR).toBe(Number.parseInt(process.versions.node, 10));
    expect(Number.isInteger(NODE_MAJOR)).toBe(true);
  });
});
