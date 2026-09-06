/**
 * The schema-to-form logic is where ADR-003's "new tools need no UI work"
 * promise is actually kept, so it gets the closest testing.
 */
import { describe, expect, it } from "vitest";
import {
  buildArguments,
  fieldsFromSchema,
  initialValues,
  type FormField,
} from "../src/frank/schema.js";
import { GET_STATUS_TOOL } from "./fake-client.js";

describe("fieldsFromSchema", () => {
  it("derives a field per property of a real tool schema", () => {
    const fields = fieldsFromSchema(GET_STATUS_TOOL.inputSchema);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      name: "name",
      kind: "string",
      required: false,
      description: "Who Frank should greet. Omit for a generic greeting.",
    });
  });

  it("surfaces the schema's own constraints", () => {
    const [field] = fieldsFromSchema(GET_STATUS_TOOL.inputSchema);
    expect(field?.constraintText).toBe("at least 1 characters, at most 100 characters");
  });

  it("marks required fields", () => {
    const fields = fieldsFromSchema({
      type: "object",
      properties: { id: { type: "string" }, note: { type: "string" } },
      required: ["id"],
    });
    expect(fields.find((f) => f.name === "id")?.required).toBe(true);
    expect(fields.find((f) => f.name === "note")?.required).toBe(false);
  });

  it("maps JSON Schema types onto form controls", () => {
    const fields = fieldsFromSchema({
      type: "object",
      properties: {
        text: { type: "string" },
        count: { type: "integer" },
        ratio: { type: "number" },
        flag: { type: "boolean" },
        choice: { type: "string", enum: ["a", "b"] },
        blob: { type: "array" },
        mystery: {},
      },
    });

    const kinds = Object.fromEntries(fields.map((field) => [field.name, field.kind]));
    expect(kinds).toEqual({
      text: "string",
      count: "number",
      ratio: "number",
      flag: "boolean",
      choice: "enum",
      blob: "json",
      mystery: "json",
    });
  });

  it("carries enum options through", () => {
    const [field] = fieldsFromSchema({
      type: "object",
      properties: { choice: { type: "string", enum: ["a", "b"] } },
    });
    expect(field?.options).toEqual(["a", "b"]);
  });

  it("returns no fields for a tool that takes none", () => {
    expect(fieldsFromSchema({ type: "object", properties: {} })).toEqual([]);
    expect(fieldsFromSchema(undefined)).toEqual([]);
  });
});

describe("initialValues", () => {
  it("starts strings empty and checkboxes unticked", () => {
    const fields = fieldsFromSchema({
      type: "object",
      properties: { text: { type: "string" }, flag: { type: "boolean" } },
    });
    expect(initialValues(fields)).toEqual({ text: "", flag: false });
  });
});

describe("buildArguments", () => {
  const fields = (overrides: Partial<FormField>[]): FormField[] =>
    overrides.map((partial, index) => ({
      name: `field${index}`,
      kind: "string",
      label: `field${index}`,
      required: false,
      ...partial,
    }));

  it("omits untouched optional fields rather than sending empty strings", () => {
    const spec = fields([{ name: "name", label: "name", kind: "string" }]);
    expect(buildArguments(spec, { name: "" })).toEqual({ args: {}, errors: {} });
  });

  it("trims whitespace and sends what was typed", () => {
    const spec = fields([{ name: "name", label: "name", kind: "string" }]);
    expect(buildArguments(spec, { name: "  the class  " }).args).toEqual({ name: "the class" });
  });

  it("reports a missing required field instead of calling the tool", () => {
    const spec = fields([{ name: "id", label: "id", kind: "string", required: true }]);
    const built = buildArguments(spec, { id: "   " });
    expect(built.args).toBeUndefined();
    expect(built.errors["id"]).toMatch(/required/i);
  });

  it("converts numbers", () => {
    const spec = fields([{ name: "count", label: "count", kind: "number" }]);
    expect(buildArguments(spec, { count: "42" }).args).toEqual({ count: 42 });
  });

  it("rejects a number that is not one", () => {
    const spec = fields([{ name: "count", label: "count", kind: "number" }]);
    const built = buildArguments(spec, { count: "many" });
    expect(built.args).toBeUndefined();
    expect(built.errors["count"]).toMatch(/must be a number/i);
  });

  it("sends a ticked checkbox, and omits an unticked optional one", () => {
    const spec = fields([{ name: "deep", label: "deep", kind: "boolean" }]);
    expect(buildArguments(spec, { deep: true }).args).toEqual({ deep: true });
    expect(buildArguments(spec, { deep: false }).args).toEqual({});
  });

  it("always sends a required checkbox, even when unticked", () => {
    const spec = fields([{ name: "deep", label: "deep", kind: "boolean", required: true }]);
    expect(buildArguments(spec, { deep: false }).args).toEqual({ deep: false });
  });

  it("parses a JSON field", () => {
    const spec = fields([{ name: "filter", label: "filter", kind: "json" }]);
    expect(buildArguments(spec, { filter: '{"a":1}' }).args).toEqual({ filter: { a: 1 } });
  });

  it("rejects malformed JSON with a message the form can show", () => {
    const spec = fields([{ name: "filter", label: "filter", kind: "json" }]);
    expect(buildArguments(spec, { filter: "{oops" }).errors["filter"]).toMatch(/valid JSON/i);
  });

  it("collects every error at once", () => {
    const spec = fields([
      { name: "id", label: "id", kind: "string", required: true },
      { name: "count", label: "count", kind: "number" },
    ]);
    const built = buildArguments(spec, { id: "", count: "nope" });
    expect(Object.keys(built.errors).sort()).toEqual(["count", "id"]);
  });
});
