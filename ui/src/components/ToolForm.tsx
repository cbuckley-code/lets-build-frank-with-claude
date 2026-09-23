// A form rendered from a tool's input schema.
//
// This is the payoff of ADR-002's schema discipline: a new tool appears in the
// console with its parameters, descriptions and required markers already in
// place, and nobody edits this file.
//
// It handles the JSON Schema constructs Frank's zod schemas actually produce —
// string, number, integer, boolean and enum. Anything else is shown as
// unsupported rather than guessed at, because Frank rejects ill-typed input and
// a wrong guess would produce a confusing error instead of an honest one.
import Checkbox from '@cloudscape-design/components/checkbox';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import type { SchemaProperty, ToolSchema } from '../mcp/client';

export type FormValues = Record<string, string | boolean>;

const SUPPORTED = ['string', 'number', 'integer', 'boolean'];

/** A schema may give `type` as a string or a union like ["string","null"]. */
export function typeOf(prop: SchemaProperty): string {
  if (Array.isArray(prop.type)) return prop.type.find((t) => t !== 'null') ?? 'string';
  return prop.type ?? 'string';
}

export function isSupported(prop: SchemaProperty): boolean {
  return Array.isArray(prop.enum) ? prop.enum.length > 0 : SUPPORTED.includes(typeOf(prop));
}

export function ToolForm({
  schema,
  values,
  onChange,
}: {
  schema: ToolSchema;
  values: FormValues;
  onChange: (values: FormValues) => void;
}) {
  const properties = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  if (properties.length === 0) return null;

  const set = (name: string, value: string | boolean) => onChange({ ...values, [name]: value });

  return (
    <SpaceBetween size="m">
      {properties.map(([name, prop]) => {
        const kind = typeOf(prop);
        const isRequired = required.has(name);

        return (
          <FormField
            key={name}
            label={name}
            // ADR-002 requires every parameter to carry a description, so the
            // console never has to invent help text.
            description={prop.description}
            constraintText={isRequired ? 'Required' : 'Optional'}
          >
            {!isSupported(prop) ? (
              <StatusIndicator type="warning">
                This console cannot render a {kind} parameter yet — call it from an MCP client.
              </StatusIndicator>
            ) : Array.isArray(prop.enum) && prop.enum.length > 0 ? (
              <Select
                selectedOption={
                  values[name] ? { value: String(values[name]), label: String(values[name]) } : null
                }
                options={prop.enum.map((v) => ({ value: String(v), label: String(v) }))}
                onChange={({ detail }) => set(name, detail.selectedOption.value ?? '')}
                placeholder="Choose a value"
              />
            ) : kind === 'boolean' ? (
              <Checkbox checked={values[name] === true} onChange={({ detail }) => set(name, detail.checked)}>
                {name}
              </Checkbox>
            ) : (
              <Input
                value={String(values[name] ?? '')}
                type={kind === 'number' || kind === 'integer' ? 'number' : 'text'}
                onChange={({ detail }) => set(name, detail.value)}
                placeholder={isRequired ? '' : 'Leave blank to omit'}
              />
            )}
          </FormField>
        );
      })}
    </SpaceBetween>
  );
}

/**
 * Drop blanks before calling, so an untouched optional field is ABSENT rather
 * than an empty string. Frank rejects unknown and ill-typed fields (ADR-002),
 * so sending "" for an omitted filter would be a real error, not a no-op.
 */
export function toArguments(schema: ToolSchema, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    if (!isSupported(prop)) continue;
    const value = values[name];
    if (value === undefined || value === '') continue;
    const kind = typeOf(prop);
    if (kind === 'number' || kind === 'integer') {
      const n = Number(value);
      if (!Number.isNaN(n)) out[name] = n;
    } else if (kind === 'boolean') {
      if (value === true) out[name] = true;
    } else {
      out[name] = value;
    }
  }
  return out;
}
