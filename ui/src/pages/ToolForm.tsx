/**
 * The form for one tool, rendered entirely from its input schema (ADR-003).
 * Nothing here knows what `get_status` is.
 */
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import type { FormField as Field, FormValues } from "../frank/schema.js";

interface ToolFormProps {
  fields: Field[];
  values: FormValues;
  errors: Record<string, string>;
  running: boolean;
  onChange: (name: string, value: string | boolean) => void;
  onSubmit: () => void;
}

export default function ToolForm({
  fields,
  values,
  errors,
  running,
  onChange,
  onSubmit,
}: ToolFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Form
        actions={
          <Button variant="primary" loading={running} data-testid="run-tool">
            Run tool
          </Button>
        }
      >
        <SpaceBetween size="l">
          {fields.length === 0 && (
            <Box variant="p" color="text-status-inactive">
              This tool takes no parameters.
            </Box>
          )}

          {fields.map((field) => {
            const value = values[field.name];
            const shared = {
              label: field.required ? field.label : `${field.label} — optional`,
              description: field.description,
              constraintText: field.constraintText,
              errorText: errors[field.name],
            };

            if (field.kind === "boolean") {
              return (
                <FormField key={field.name} {...shared}>
                  <Checkbox
                    checked={value === true}
                    onChange={({ detail }) => onChange(field.name, detail.checked)}
                  >
                    {field.label}
                  </Checkbox>
                </FormField>
              );
            }

            if (field.kind === "enum") {
              const options = (field.options ?? []).map((option) => ({
                label: option,
                value: option,
              }));
              const selected = options.find((option) => option.value === value) ?? null;

              return (
                <FormField key={field.name} {...shared}>
                  <Select
                    selectedOption={selected}
                    options={options}
                    placeholder="Choose a value"
                    onChange={({ detail }) =>
                      onChange(field.name, detail.selectedOption.value ?? "")
                    }
                  />
                </FormField>
              );
            }

            if (field.kind === "json") {
              return (
                <FormField key={field.name} {...shared}>
                  <Textarea
                    value={String(value ?? "")}
                    rows={4}
                    placeholder="JSON value"
                    onChange={({ detail }) => onChange(field.name, detail.value)}
                  />
                </FormField>
              );
            }

            return (
              <FormField key={field.name} {...shared}>
                <Input
                  value={String(value ?? "")}
                  type={field.kind === "number" ? "number" : "text"}
                  onChange={({ detail }) => onChange(field.name, detail.value)}
                />
              </FormField>
            );
          })}
        </SpaceBetween>
      </Form>
    </form>
  );
}
