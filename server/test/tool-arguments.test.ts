import { describe, expect, it } from "vitest";
import { fillMissingToolArguments } from "../src/tool-arguments.js";

const call = (params: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params,
});

describe("fillMissingToolArguments", () => {
  it("fills in an empty object when arguments are omitted", () => {
    const result = fillMissingToolArguments(call({ name: "get_status" })) as {
      params: { arguments: unknown };
    };
    expect(result.params.arguments).toEqual({});
  });

  it("leaves supplied arguments untouched", () => {
    const body = call({ name: "get_status", arguments: { name: "the class" } });
    expect(fillMissingToolArguments(body)).toEqual(body);
  });

  it("does not mutate the request it was given", () => {
    const body = call({ name: "get_status" });
    fillMissingToolArguments(body);
    expect("arguments" in body.params).toBe(false);
  });

  it("ignores other methods", () => {
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
    expect(fillMissingToolArguments(body)).toEqual(body);
  });

  it("handles a batch of requests", () => {
    const result = fillMissingToolArguments([
      call({ name: "get_status" }),
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]) as Array<{ params: Record<string, unknown> }>;

    expect(result[0]?.params["arguments"]).toEqual({});
    expect(result[1]?.params["arguments"]).toBeUndefined();
  });

  it.each([null, undefined, "not-json", 42])("passes through %s unchanged", (body) => {
    expect(fillMissingToolArguments(body)).toBe(body);
  });

  it("passes through a malformed params field", () => {
    const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: "nonsense" };
    expect(fillMissingToolArguments(body)).toEqual(body);
  });
});
