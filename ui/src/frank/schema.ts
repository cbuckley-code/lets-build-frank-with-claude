/**
 * Turning a tool's input schema into a form, and a filled-in form back into
 * tool arguments.
 *
 * This is the payoff ADR-003 is after: a new tool with a well-described zod
 * schema appears in the console with a working form and no UI work at all. It
 * is deliberately pure and free of React, so it can be tested directly.
 */
import type { JsonSchema, JsonSchemaProperty } from "./types.js";

export type FieldKind = "string" | "number" | "boolean" | "enum" | "json";

export interface FormField {
  name: string;
  kind: FieldKind;
  label: string;
  description?: string;
  required: boolean;
  /** Present when kind is "enum". */
  options?: string[];
  constraintText?: string;
}

/** A form value as held in React state. */
export type FieldValue = string | boolean;

export type FormValues = Record<string, FieldValue>;

function kindOf(property: JsonSchemaProperty): FieldKind {
  if (Array.isArray(property.enum) && property.enum.length > 0) {
    return "enum";
  }
  switch (property.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    default:
      // Objects, arrays and anything unrecognised get a JSON text box rather
      // than being silently dropped from the form.
      return "json";
  }
}

/** Human-readable bounds, so the form shows the schema's limits. */
function constraintTextOf(property: JsonSchemaProperty): string | undefined {
  const parts: string[] = [];

  if (property.minLength !== undefined) parts.push(`at least ${property.minLength} characters`);
  if (property.maxLength !== undefined) parts.push(`at most ${property.maxLength} characters`);
  if (property.minimum !== undefined) parts.push(`minimum ${property.minimum}`);
  if (property.maximum !== undefined) parts.push(`maximum ${property.maximum}`);

  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Derive the form fields for a tool's input schema. */
export function fieldsFromSchema(schema: JsonSchema | undefined): FormField[] {
  const properties = schema?.properties;
  if (!properties) {
    return [];
  }

  const required = new Set(schema?.required ?? []);

  return Object.entries(properties).map(([name, property]) => {
    const field: FormField = {
      name,
      kind: kindOf(property),
      label: name,
      required: required.has(name),
    };

    if (property.description) field.description = property.description;
    if (property.enum) field.options = property.enum;

    const constraintText = constraintTextOf(property);
    if (constraintText) field.constraintText = constraintText;

    return field;
  });
}

/** The starting state of a form: every field present, empty. */
export function initialValues(fields: FormField[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    values[field.name] = field.kind === "boolean" ? false : "";
  }
  return values;
}

export interface BuiltArguments {
  /** Present only when there are no errors. */
  args?: Record<string, unknown>;
  /** Field name -> message, for display next to the field. */
  errors: Record<string, string>;
}

/**
 * Convert form values into the arguments object for a tool call.
 *
 * An untouched optional field is omitted rather than sent as an empty string:
 * Frank's schemas are strict, and an empty string is not the same as "not
 * supplied".
 */
export function buildArguments(fields: FormField[], values: FormValues): BuiltArguments {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const raw = values[field.name];

    if (field.kind === "boolean") {
      // A checkbox always has a value, but an unticked optional box means
      // "not supplied" rather than "false".
      if (raw === true || field.required) {
        args[field.name] = raw === true;
      }
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";

    if (text === "") {
      if (field.required) {
        errors[field.name] = `${field.label} is required.`;
      }
      continue;
    }

    switch (field.kind) {
      case "number": {
        const parsed = Number(text);
        if (!Number.isFinite(parsed)) {
          errors[field.name] = `${field.label} must be a number.`;
        } else {
          args[field.name] = parsed;
        }
        break;
      }
      case "json": {
        try {
          args[field.name] = JSON.parse(text);
        } catch {
          errors[field.name] = `${field.label} must be valid JSON.`;
        }
        break;
      }
      default:
        args[field.name] = text;
    }
  }

  return Object.keys(errors).length > 0 ? { errors } : { args, errors };
}
