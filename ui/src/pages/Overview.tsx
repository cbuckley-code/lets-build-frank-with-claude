/**
 * Overview — Frank's `get_status` output and connection health (ADR-003).
 */
import { useCallback, useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { formatTimestamp, formatUptime, messageOf } from "../frank/format.js";
import type { FrankClient, FrankStatus } from "../frank/types.js";

interface OverviewProps {
  client: FrankClient;
}

function ValuePair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );
}

export default function Overview({ client }: OverviewProps) {
  const [status, setStatus] = useState<FrankStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await client.getStatus());
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connection = loading ? (
    <StatusIndicator type="loading">Connecting</StatusIndicator>
  ) : error ? (
    <StatusIndicator type="error">Cannot reach Frank</StatusIndicator>
  ) : (
    <StatusIndicator type="success">Connected</StatusIndicator>
  );

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Frank's own status, read over MCP from this page's origin."
          actions={
            <Button iconName="refresh" loading={loading} onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        >
          Overview
        </Header>
      }
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" header="Frank did not answer">
            {error}
          </Alert>
        )}

        <Container header={<Header variant="h2">Connection</Header>}>
          <ColumnLayout columns={2} variant="text-grid">
            <ValuePair label="Status">{connection}</ValuePair>
            <ValuePair label="Endpoint">
              <Box variant="code">POST /mcp</Box>
            </ValuePair>
          </ColumnLayout>
        </Container>

        <Container
          header={
            <Header variant="h2" description="Returned by the get_status tool.">
              Status
            </Header>
          }
        >
          {loading && !status ? (
            <Box textAlign="center" padding="l">
              <Spinner size="large" />
            </Box>
          ) : status ? (
            <SpaceBetween size="l">
              <Box variant="p">{status.summary}</Box>
              <ColumnLayout columns={4} variant="text-grid">
                <ValuePair label="Version">{status.version}</ValuePair>
                <ValuePair label="Uptime">{formatUptime(status.uptimeSeconds)}</ValuePair>
                <ValuePair label="Started">{formatTimestamp(status.startedAt)}</ValuePair>
                <ValuePair label="Greeting">{status.greeting}</ValuePair>
              </ColumnLayout>
            </SpaceBetween>
          ) : (
            <Box variant="p" color="text-status-inactive">
              No status to show.
            </Box>
          )}
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
