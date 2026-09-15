// Overview — Frank's get_status output and connection health (ADR-003).
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  Header,
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from '@cloudscape-design/components';
import { getStatus } from '../mcp';

interface Status {
  version?: string;
  uptimeSeconds?: number;
  greeting?: string;
  summary?: string;
}

export function Overview() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStatus();
      if (result.isError) throw new Error(result.text);
      setStatus((result.structured ?? {}) as Status);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Button iconName="refresh" onClick={() => void load()} loading={loading}>
                Refresh
              </Button>
            }
            description="Whether the console can reach Frank over MCP."
          >
            Connection
          </Header>
        }
      >
        {loading && !status ? (
          <Spinner />
        ) : error ? (
          <StatusIndicator type="error">Cannot reach Frank</StatusIndicator>
        ) : (
          <StatusIndicator type="success">Connected to Frank at POST /mcp</StatusIndicator>
        )}
      </Container>

      {error && (
        <Alert type="error" header="Frank did not answer">
          {error}
        </Alert>
      )}

      {status && (
        <Container header={<Header variant="h2">Status</Header>}>
          <SpaceBetween size="l">
            <ColumnLayout columns={2} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Version</Box>
                <div>{status.version ?? '—'}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Uptime</Box>
                <div>
                  {status.uptimeSeconds === undefined ? '—' : formatUptime(status.uptimeSeconds)}
                </div>
              </div>
            </ColumnLayout>
            {status.greeting && <Box variant="p">{status.greeting}</Box>}
          </SpaceBetween>
        </Container>
      )}
    </SpaceBetween>
  );
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
