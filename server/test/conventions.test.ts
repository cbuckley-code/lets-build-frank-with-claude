// ADR-002 as a test. A tool that breaks the conventions fails CI, not just review.
//
// These run over the REGISTERED list, so they cover every tool anyone adds
// later without that person touching this file.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import {
  ALLOWED_VERBS,
  TOOL_NAME_PATTERN,
  createTools,
  defineTool,
  safeMessage,
  ToolError,
} from '../src/tools/index.js';
import { describeSchema } from '../src/tools/define.js';

const tools = createTools(loadConfig({ PORT: '0' }));

describe('tool conventions (ADR-002)', () => {
  it('registers get_status, the first tool', () => {
    expect(tools.map((t) => t.name)).toContain('get_status');
  });

  it('the verb set is exactly get, list, search, summarize', () => {
    expect([...ALLOWED_VERBS]).toEqual(['get', 'list', 'search', 'summarize']);
  });

  it.each(tools.map((t) => [t.name, t] as const))(
    '%s is verb_noun from the closed verb set',
    (_name, tool) => {
      expect(tool.name).toMatch(TOOL_NAME_PATTERN);
    },
  );

  it.each(tools.map((t) => [t.name, t] as const))(
    '%s has a description written for a model',
    (_name, tool) => {
      expect(tool.description.trim().length).toBeGreaterThan(20);
    },
  );

  it.each(tools.map((t) => [t.name, t] as const))('%s describes every parameter', (_name, tool) => {
    for (const [param, schema] of Object.entries(tool.shape)) {
      expect(describeSchema(schema), `parameter ${param}`).toBeTruthy();
    }
  });

  // zod strips unknown keys by default. ADR-002 says REJECT, so this asserts
  // the behaviour rather than trusting that someone used strictObject.
  it.each(tools.map((t) => [t.name, t] as const))('%s rejects unknown fields', (_name, tool) => {
    const parsed = tool.inputSchema.safeParse({ __unexpected: 1 });
    expect(parsed.success).toBe(false);
  });

  // Metadata can be perfect while the handler returns the wrong shape.
  it.each(tools.map((t) => [t.name, t] as const))(
    '%s returns a summary string plus typed fields',
    async (_name, tool) => {
      const output = await tool.handler({} as never);
      expect(typeof output.summary).toBe('string');
      expect(output.summary.trim().length).toBeGreaterThan(0);
      expect(Object.keys(output).length).toBeGreaterThan(1);
    },
  );
});

describe('defineTool guards (ADR-002)', () => {
  const ok = async () => ({ summary: 'fine' });
  const description = 'A description long enough to pass the floor.';

  it.each(['create_thing', 'update_thing', 'delete_thing', 'run_thing', 'getStatus', 'get-status', 'status'])(
    'refuses the out-of-policy name %s',
    (name) => {
      expect(() => defineTool({ name, description, input: {}, handler: ok })).toThrow(/out of policy/);
    },
  );

  it('refuses an undescribed parameter', () => {
    expect(() =>
      defineTool({ name: 'get_thing', description, input: { id: z.string() }, handler: ok }),
    ).toThrow(/needs a description/);
  });

  it('refuses a description too short to help a model choose', () => {
    expect(() => defineTool({ name: 'get_thing', description: 'Gets it.', input: {}, handler: ok })).toThrow(
      /what it returns/,
    );
  });
});

describe('error messages (ADR-002)', () => {
  it('passes through a ToolError, which is written for the caller', () => {
    expect(safeMessage('get_thing', new ToolError('No resource named "nope".'))).toBe(
      'No resource named "nope".',
    );
  });

  it('never returns an arbitrary dependency message', () => {
    const leaky = new Error('ENOTFOUND sub-1234-secret.vault.azure.net\n  at Object.<anonymous>');
    const message = safeMessage('get_thing', leaky);
    expect(message).not.toMatch(/vault\.azure\.net/);
    expect(message).not.toMatch(/at Object/);
    expect(message).toMatch(/could not complete get_thing/);
  });
});
