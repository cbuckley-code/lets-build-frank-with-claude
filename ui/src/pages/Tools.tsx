/**
 * Tools — the tool list from MCP discovery. Selecting a tool renders a form
 * from its input schema and shows the JSON result (ADR-003).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { formatJson, messageOf } from "../frank/format.js";
import {
  buildArguments,
  fieldsFromSchema,
  initialValues,
  type FormValues,
} from "../frank/schema.js";
import type { FrankClient, ToolCallOutcome, ToolInfo } from "../frank/types.js";
import ToolForm from "./ToolForm.js";

interface ToolsProps {
  client: FrankClient;
}

export default function Tools({ client }: ToolsProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [selected, setSelected] = useState<ToolInfo | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<ToolCallOutcome | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const discovered = await client.listTools();
        if (!cancelled) {
          setTools(discovered);
          setListError(null);
        }
      } catch (caught) {
        if (!cancelled) setListError(messageOf(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const fields = useMemo(() => fieldsFromSchema(selected?.inputSchema), [selected]);

  const select = useCallback((tool: ToolInfo | null) => {
    setSelected(tool);
    setValues(tool ? initialValues(fieldsFromSchema(tool.inputSchema)) : {});
    setErrors({});
    setOutcome(null);
  }, []);

  const run = useCallback(async () => {
    if (!selected) return;

    const built = buildArguments(fields, values);
    setErrors(built.errors);
    if (!built.args) return;

    setRunning(true);
    try {
      setOutcome(await client.callTool(selected.name, built.args));
    } catch (caught) {
      setOutcome({ isError: true, text: messageOf(caught) });
    } finally {
      setRunning(false);
    }
  }, [client, fields, selected, values]);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Discovered over MCP. Every form on this page is rendered from the tool's own input schema."
        >
          Tools
        </Header>
      }
    >
      <SpaceBetween size="l">
        {listError && (
          <Alert type="error" header="Could not list Frank's tools">
            {listError}
          </Alert>
        )}

        <Table<ToolInfo>
          variant="container"
          trackBy="name"
          loading={loading}
          loadingText="Discovering tools"
          items={tools}
          selectionType="single"
          selectedItems={selected ? [selected] : []}
          onSelectionChange={({ detail }) => select(detail.selectedItems[0] ?? null)}
          header={<Header variant="h2" counter={`(${tools.length})`}>Available tools</Header>}
          empty={
            <Box textAlign="center" padding="l" color="text-status-inactive">
              Frank reported no tools.
            </Box>
          }
          columnDefinitions={[
            {
              id: "name",
              header: "Name",
              cell: (tool) => <Box variant="code">{tool.name}</Box>,
              isRowHeader: true,
            },
            { id: "title", header: "Title", cell: (tool) => tool.title ?? "—" },
            { id: "description", header: "Description", cell: (tool) => tool.description ?? "—" },
            {
              id: "access",
              header: "Access",
              cell: (tool) =>
                tool.annotations?.readOnlyHint ? (
                  <Badge color="green">Read-only</Badge>
                ) : (
                  <Badge color="red">Mutating</Badge>
                ),
            },
          ]}
        />

        {selected && (
          <Container
            header={
              <Header variant="h2" description={selected.description}>
                {selected.title ?? selected.name}
              </Header>
            }
          >
            <ToolForm
              fields={fields}
              values={values}
              errors={errors}
              running={running}
              onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
              onSubmit={() => void run()}
            />
          </Container>
        )}

        {outcome && (
          <Container
            header={
              <Header
                variant="h2"
                description={
                  outcome.isError
                    ? "Frank returned an error."
                    : "Frank's structured response."
                }
              >
                Result
              </Header>
            }
          >
            {outcome.isError ? (
              <Alert type="error" header="Tool call failed">
                {outcome.text}
              </Alert>
            ) : (
              <Box variant="code">
                <pre className="frank-result" data-testid="tool-result">
                  {outcome.structured !== undefined
                    ? formatJson(outcome.structured)
                    : outcome.text}
                </pre>
              </Box>
            )}
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}
