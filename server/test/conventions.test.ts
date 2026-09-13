// ADR-002 as a test. A tool that breaks the conventions fails CI, not just review.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { ALLOWED_VERBS, TOOL_NAME_PATTERN, createTools, defineTool } from '../src/tools/index.js';
import { describeSchema } from '../src/tools/define.js';

const tools = createTools(loadConfig({ PORT: '0' }));

describe('tool conventions (ADR-002)', () => {
  it('registers at least get_status', () => {
    expect(tools.map((t) => t.name)).toContain('get_status');
  });

  it('the verb set is exactly get, list, search, summarize', () => {
    expect([...ALLOWED_VERBS]).toEqual(['get', 'list', 'search', 'summarize']);
  });

  it.each(tools.map((t) => [t.name, t] as const))('%s is verb_noun from the closed verb set', (_name, tool) => {
    expect(tool.name).toMatch(TOOL_NAME_PATTERN);
  });

  it.each(tools.map((t) => [t.name, t] as const))('%s has a description written for a model', (_name, tool) => {
    expect(tool.description.trim().length).toBeGreaterThan(20);
  });

  it.each(tools.map((t) => [t.name, t] as const))('%s describes every parameter', (_name, tool) => {
    for (const [param, schema] of Object.entries(tool.shape)) {
      expect(describeSchema(schema), `parameter ${param}`).toBeTruthy();
    }
  });

  it.each(tools.map((t) => [t.name, t] as const))('%s rejects unknown fields', (_name, tool) => {
    expect(tool.inputSchema.safeParse({ __unexpected: 1 }).success).toBe(false);
  });
});

describe('defineTool guards (ADR-002)', () => {
  const ok = async () => ({ summary: 'fine' });

  it.each(['create_thing', 'update_thing', 'delete_thing', 'run_thing', 'getStatus', 'get-status', 'status'])(
    'refuses the out-of-policy name %s',
    (name) => {
      expect(() => defineTool({ name, description: 'A long enough description.', input: {}, handler: ok })).toThrow(
        /out of policy/,
      );
    },
  );

  it('refuses an undescribed parameter', () => {
    expect(() =>
      defineTool({ name: 'get_thing', description: 'A long enough description.', input: { id: z.string() }, handler: ok }),
    ).toThrow(/needs a description/);
  });

  it('refuses an empty description', () => {
    expect(() => defineTool({ name: 'get_thing', description: '  ', input: {}, handler: ok })).toThrow(
      /needs a description/,
    );
  });
});
