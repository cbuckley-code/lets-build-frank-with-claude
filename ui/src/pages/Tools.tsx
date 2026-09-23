// Tools — the list from MCP discovery, a form built from the selected tool's
// input schema, and the result (ADR-003).
//
// Nothing here knows the name of any tool. Whatever Frank advertises is what
// the console offers, which is why ADR-009's tools will appear with working
// forms and no UI change.
import { useCallback, useEffect, useState } from 'react';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table from '@cloudscape-design/components/table';
import Textarea from '@cloudscape-design/components/textarea';
import { ToolForm, toArguments, type FormValues } from '../components/ToolForm';
import type { FrankClient, ToolResult, ToolSummary } from '../types';

export function Tools({ client }: { client: FrankClient | null }) {
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [selected, setSelected] = useState<ToolSummary[]>([]);
  const [values, setValues] = useState<FormValues>({});
  const [result, setResult] = useState<ToolResult | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setListError(null);
    try {
      setTools(await client.listTools());
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const tool = selected[0];

  // A different tool means a different schema; never carry stale values over.
  const select = (next: ToolSummary[]) => {
    setSelected(next);
    setValues({});
    setResult(null);
  };

  const run = async () => {
    if (!client || !tool) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await client.callTool(tool.name, toArguments(tool.inputSchema, values)));
    } catch (caught) {
      setResult({ text: caught instanceof Error ? caught.message : String(caught), isError: true });
    } finally {
      setRunning(false);
    }
  };

  const parameterCount = Object.keys(tool?.inputSchema.properties ?? {}).length;

  return (
    <SpaceBetween size="l">
      {listError && (
        <Alert type="error" header="Could not list Frank's tools">
          {listError}
        </Alert>
      )}

      <Table
        variant="container"
        selectionType="single"
        trackBy="name"
        selectedItems={selected}
        onSelectionChange={({ detail }) => select([...detail.selectedItems])}
        items={tools}
        loading={loading}
        loadingText="Asking Frank what he can do"
        header={
          <Header
            counter={loading ? undefined : `(${tools.length})`}
            description="Select a tool to call it. Every tool is read-only (ADR-002)."
            actions={
              <Button iconName="refresh" loading={loading} disabled={!client} onClick={() => void load()}>
                Refresh
              </Button>
            }
          >
            Tools
          </Header>
        }
        columnDefinitions={[
          { id: 'name', header: 'Name', cell: (t: ToolSummary) => <b>{t.name}</b>, isRowHeader: true },
          { id: 'description', header: 'Description', cell: (t: ToolSummary) => t.description },
        ]}
        empty={
          <Box textAlign="center" padding="l" color="inherit">
            Frank is not advertising any tools.
          </Box>
        }
      />

      {tool && (
        <Container header={<Header variant="h2" description={tool.description}>{tool.name}</Header>}>
          <Form
            actions={
              <Button variant="primary" loading={running} onClick={() => void run()}>
                Run
              </Button>
            }
          >
            {parameterCount === 0 ? (
              <Box variant="p" color="text-body-secondary">
                This tool takes no parameters.
              </Box>
            ) : (
              <ToolForm schema={tool.inputSchema} values={values} onChange={setValues} />
            )}
          </Form>
        </Container>
      )}

      {result && (
        <Container header={<Header variant="h2">Result</Header>}>
          <SpaceBetween size="m">
            {/* Frank returns plain language on failure, never a stack trace. */}
            {result.isError ? (
              <Alert type="error" header="Frank returned an error">
                {result.text}
              </Alert>
            ) : (
              <Box variant="p">{result.text}</Box>
            )}
            {result.payload && (
              <Textarea
                value={JSON.stringify(result.payload, null, 2)}
                readOnly
                rows={16}
                ariaLabel="Result JSON"
              />
            )}
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
}
