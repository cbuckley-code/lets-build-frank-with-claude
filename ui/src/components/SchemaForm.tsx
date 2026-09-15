// A form rendered from a tool's input schema.
//
// This is the payoff of ADR-002's schema discipline: a new tool appears in the
// console with its parameters, descriptions and validation already in place,
// and nobody touches this file.
import {
  Checkbox,
  FormField,
  Input,
  Select,
  SpaceBetween,
  type SelectProps,
} from '@cloudscape-design/components';
import type { SchemaProperty, ToolSchema } from '../mcp';

export type FormValues = Record<string, string | boolean>;

interface Props {
  schema: ToolSchema;
  values: FormValues;
  onChange: (values: FormValues) => void;
}

/** A schema may give `type` as a string or a union like ["string","null"]. */
function typeOf(prop: SchemaProperty): string {
  if (Array.isArray(prop.type)) return prop.type.find((t) => t !== 'null') ?? 'string';
  return prop.type ?? 'string';
}

export function SchemaForm({ schema, values, onChange }: Props) {
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
            description={prop.description}
            // ADR-002 requires every parameter to carry a description, so the
            // console never has to invent help text.
            constraintText={isRequired ? 'Required' : 'Optional'}
          >
            {prop.enum ? (
              <Select
                selectedOption={
                  values[name] ? { value: String(values[name]), label: String(values[name]) } : null
                }
                options={prop.enum.map((v) => ({ value: v, label: v }))}
                onChange={({ detail }: { detail: SelectProps.ChangeDetail }) =>
                  set(name, detail.selectedOption.value ?? '')
                }
                placeholder="Choose a value"
              />
            ) : kind === 'boolean' ? (
              <Checkbox
                checked={values[name] === true}
                onChange={({ detail }) => set(name, detail.checked)}
              >
                {prop.description ?? name}
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
 * Drop blanks before calling, so an untouched optional field is *absent* rather
 * than an empty string. Frank rejects unknown and ill-typed fields (ADR-002),
 * so sending `""` for an omitted filter would be a real error.
 */
export function toArguments(schema: ToolSchema, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
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
