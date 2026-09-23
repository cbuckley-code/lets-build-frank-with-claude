// Overview — Frank's get_status output and connection health (ADR-003).
//
// It calls the same tool an AI client would, over the same endpoint. The
// console is another MCP client, not a privileged back door.
import { useCallback, useEffect, useState } from 'react';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import type { ConnectionState, FrankClient } from '../types';

export function Overview({
  client,
  connection,
  connectionError,
}: {
  client: FrankClient | null;
  connection: ConnectionState;
  connectionError: string | null;
}) {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.callTool('get_status', {});
      if (result.isError) {
        setError(result.text || 'Frank returned an error.');
        setStatus(null);
      } else {
        setStatus(result.payload ?? {});
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            description="Whether this console can reach Frank over MCP."
            actions={
              <Button iconName="refresh" loading={loading} disabled={!client} onClick={() => void refresh()}>
                Refresh
              </Button>
            }
          >
            Connection
          </Header>
        }
      >
        <ColumnLayout columns={2} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">State</Box>
            <div>
              <StatusIndicator type={indicator(connection, error)}>{label(connection, error)}</StatusIndicator>
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Endpoint</Box>
            <div>POST /mcp</div>
          </div>
        </ColumnLayout>
      </Container>

      {/* Failures are shown, not swallowed — a page that renders only the happy
          path tells you nothing when discovery or invocation breaks. */}
      {(connectionError ?? error) && (
        <Alert type="error" header={connectionError ? 'Cannot reach Frank' : 'Frank returned an error'}>
          {connectionError ?? error}
        </Alert>
      )}

      {status && (
        <Container header={<Header variant="h2">Status</Header>}>
          <SpaceBetween size="l">
            <ColumnLayout columns={2} variant="text-grid">
              <Field label="Name" value={status.name} />
              <Field label="Version" value={status.version} />
              <Field
                label="Uptime"
                value={
                  typeof status.uptimeSeconds === 'number' ? formatUptime(status.uptimeSeconds) : undefined
                }
              />
              <Field label="Started at" value={status.startedAt} />
            </ColumnLayout>
            {typeof status.greeting === 'string' && <Box variant="p">{status.greeting}</Box>}
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{value === undefined || value === null ? '—' : String(value)}</div>
    </div>
  );
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function indicator(connection: ConnectionState, error: string | null): 'success' | 'error' | 'loading' {
  if (connection === 'connecting') return 'loading';
  if (connection === 'error') return 'error';
  return error ? 'error' : 'success';
}

function label(connection: ConnectionState, error: string | null): string {
  if (connection === 'connecting') return 'Connecting';
  if (connection === 'error') return 'Unreachable';
  return error ? 'Connected, last call failed' : 'Connected';
}
