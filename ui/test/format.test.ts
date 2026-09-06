import { describe, expect, it } from "vitest";
import { formatJson, formatUptime, messageOf } from "../src/frank/format.js";

describe("formatUptime", () => {
  it.each([
    [0, "0s"],
    [45, "45s"],
    [59, "59s"],
    [60, "1m 00s"],
    [185, "3m 05s"],
    [3600, "1h 00m"],
    [7620, "2h 07m"],
    [86400, "1d 0h"],
    [273600, "3d 4h"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatUptime(seconds)).toBe(expected);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("handles %s", (value) => {
    expect(formatUptime(value)).toBe("unknown");
  });
});

describe("messageOf", () => {
  it("uses an Error's message", () => {
    expect(messageOf(new Error("Frank is asleep"))).toBe("Frank is asleep");
  });

  it("falls back to a sentence for anything else", () => {
    expect(messageOf(null)).toBe("Frank could not be reached.");
    expect(messageOf(new Error("   "))).toBe("Frank could not be reached.");
  });
});

describe("formatJson", () => {
  it("pretty-prints", () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("survives a circular structure", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(typeof formatJson(circular)).toBe("string");
  });
});
