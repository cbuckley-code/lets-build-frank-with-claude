import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { defineTool, errorMessage } from '../src/tools/define.js';
import { connectClient, startFrank, type RunningFrank } from './helpers.js';

const getTrouble = defineTool({
  name: 'get_trouble',
  description: 'Test-only tool that always fails, to prove the error contract.',
  input: { reason: z.string().describe('What to blame.') },
  handler: async ({ reason }) => {
    throw new Error(`Frank could not look that up: ${reason}\n    at fakeFrame (fake.ts:1:1)`);
  },
});

describe('tool errors (ADR-002)', () => {
  let frank: RunningFrank;
  let client: Client;
  beforeAll(async () => {
    frank = await startFrank({ tools: [getTrouble] });
    client = await connectClient(frank.baseUrl);
  });
  afterAll(async () => {
    await client.close();
    await frank.close();
  });

  it('returns isError with a plain-language message and no stack trace', async () => {
    const result = await client.callTool({ name: 'get_trouble', arguments: { reason: 'the moon' } });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0]?.text).toBe('Frank could not look that up: the moon');
    expect(content[0]?.text).not.toMatch(/\bat \w+ \(/);
  });

  it('errorMessage never leaks a stack and never returns empty', () => {
    expect(errorMessage(new Error('boom\n    at x (y:1:1)'))).toBe('boom');
    expect(errorMessage(new Error(''))).toBe('The tool failed for an unknown reason.');
    expect(errorMessage('a string')).toBe('a string');
  });
});
