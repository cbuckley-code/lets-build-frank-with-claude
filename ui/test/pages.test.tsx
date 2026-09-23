// The two pages, driven by a fake FrankClient. No network, no MCP transport —
// which is the point of keeping the client behind an interface.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Overview, formatUptime } from '../src/pages/Overview';
import { Tools } from '../src/pages/Tools';
import type { FrankClient, ToolSummary } from '../src/types';

const GET_STATUS: ToolSummary = {
  name: 'get_status',
  description: "Returns Frank's name, version, uptime and a greeting.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};

function fakeClient(overrides: Partial<FrankClient> = {}): FrankClient {
  return {
    listTools: async () => [GET_STATUS],
    callTool: async () => ({
      text: 'frank 0.1.0 is up, 12s since start.',
      payload: { summary: 'frank 0.1.0 is up, 12s since start.', name: 'frank', version: '0.1.0' },
      isError: false,
    }),
    ...overrides,
  };
}

describe('Overview (ADR-003)', () => {
  it('shows connection health and get_status detail', async () => {
    render(<Overview client={fakeClient()} connection="connected" connectionError={null} />);
    await waitFor(() => expect(screen.getByText('Connected')).toBeDefined());
    expect(screen.getByText('0.1.0')).toBeDefined();
  });

  it('reports an unreachable Frank instead of rendering an empty page', () => {
    render(<Overview client={null} connection="error" connectionError="Failed to fetch" />);
    expect(screen.getByText('Unreachable')).toBeDefined();
    expect(screen.getByText('Failed to fetch')).toBeDefined();
  });

  it("surfaces a tool error in Frank's own words", async () => {
    const client = fakeClient({
      callTool: async () => ({ text: 'Frank could not complete get_status.', isError: true }),
    });
    render(<Overview client={client} connection="connected" connectionError={null} />);
    await waitFor(() => expect(screen.getByText('Frank could not complete get_status.')).toBeDefined());
  });
});

describe('Tools (ADR-003)', () => {
  it('lists whatever Frank advertises, with no hard-coded tool names', async () => {
    render(<Tools client={fakeClient()} />);
    await waitFor(() => expect(screen.getByText('get_status')).toBeDefined());
    expect(screen.getByText(/Returns Frank's name, version/)).toBeDefined();
  });

  it('reports a discovery failure rather than showing an empty table', async () => {
    const client = fakeClient({
      listTools: async () => {
        throw new Error('Failed to fetch');
      },
    });
    render(<Tools client={client} />);
    await waitFor(() => expect(screen.getByText("Could not list Frank's tools")).toBeDefined());
  });

  it('asks Frank for the list exactly once on mount', async () => {
    const listTools = vi.fn(async () => [GET_STATUS]);
    render(<Tools client={fakeClient({ listTools })} />);
    await waitFor(() => expect(listTools).toHaveBeenCalledTimes(1));
  });
});

describe('formatUptime', () => {
  it('reads naturally at each scale', () => {
    expect(formatUptime(12)).toBe('12s');
    expect(formatUptime(90)).toBe('1m 30s');
    expect(formatUptime(3700)).toBe('1h 1m');
  });
});
