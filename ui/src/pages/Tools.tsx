// Tools — the tool list from MCP discovery, a form built from the selected
// tool's input schema, and the JSON result (ADR-003).
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Form,
  Header,
  SpaceBetween,
  Spinner,
  Table,
  Textarea,
} from '@cloudscape-design/components';
import { callTool, listTools, type Tool, type ToolResult } from '../mcp';
import { SchemaForm, toArguments, type FormValues } from '../components/SchemaForm';

export function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState<Tool[]>([]);
  const [values, setValues] = useState<FormValues>({});
  const [result, setResult] = useState<ToolResult | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setTools(await listTools());
      } catch (err) {
        setListError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tool = selected[0];

  // A different tool means a different schema; keep no stale values.
  const select = (next: Tool[]) => {
    setSelected(next);
    setValues({});
    setResult(null);
  };

  const run = async () => {
    if (!tool) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await callTool(tool.name, toArguments(tool.inputSchema, values)));
    } catch (err) {
      setResult({ text: err instanceof Error ? err.message : String(err), isError: true });
    } finally {
      setRunning(false);
    }
  };

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
        onSelectionChange={({ detail }) => select(detail.selectedItems)}
        items={tools}
        loading={loading}
        loadingText="Discovering Frank's tools"
        header={
          <Header counter={loading ? undefined : `(${tools.length})`}>
            Tools
          </Header>
        }
        columnDefinitions={[
          { id: 'name', header: 'Name', cell: (t: Tool) => <b>{t.name}</b>, isRowHeader: true },
          { id: 'description', header: 'Description', cell: (t: Tool) => t.description },
        ]}
        empty={
          <Box textAlign="center" padding="l" color="inherit">
            Frank reported no tools.
          </Box>
        }
      />

      {tool && (
        <Container
          header={<Header variant="h2" description={tool.description}>{tool.name}</Header>}
        >
          <Form
            actions={
              <Button variant="primary" onClick={() => void run()} loading={running}>
                Run
              </Button>
            }
          >
            <SchemaForm schema={tool.inputSchema} values={values} onChange={setValues} />
            {Object.keys(tool.inputSchema.properties ?? {}).length === 0 && (
              <Box variant="p" color="text-body-secondary">
                This tool takes no parameters.
              </Box>
            )}
          </Form>
        </Container>
      )}

      {running && <Spinner />}

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
            {result.structured && (
              <Textarea
                value={JSON.stringify(result.structured, null, 2)}
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
