// The schema-driven form. These tests are really a test of ADR-002: if tools
// keep describing their parameters, the console keeps rendering them for free.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemaForm, toArguments } from '../src/components/SchemaForm';
import type { ToolSchema } from '../src/mcp';

const listResources: ToolSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', description: 'Full ARM type to filter to.' },
  },
  additionalProperties: false,
};

const getResource: ToolSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Exact resource name.' },
    type: { type: 'string', description: 'Full ARM type of that resource.' },
  },
  required: ['name', 'type'],
  additionalProperties: false,
};

describe('SchemaForm', () => {
  it('renders a field per property, labelled by parameter name', () => {
    render(<SchemaForm schema={getResource} values={{}} onChange={() => {}} />);
    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('type')).toBeDefined();
  });

  it("shows the parameter's own description as help text", () => {
    render(<SchemaForm schema={listResources} values={{}} onChange={() => {}} />);
    expect(screen.getByText('Full ARM type to filter to.')).toBeDefined();
  });

  it('distinguishes required from optional', () => {
    render(<SchemaForm schema={getResource} values={{}} onChange={() => {}} />);
    expect(screen.getAllByText('Required')).toHaveLength(2);
  });

  it('renders nothing for a tool with no parameters', () => {
    const { container } = render(
      <SchemaForm schema={{ type: 'object' }} values={{}} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('toArguments', () => {
  it('omits a blank optional field rather than sending an empty string', () => {
    // Frank rejects ill-typed input, so "" for an untouched filter is an error,
    // not a no-op.
    expect(toArguments(listResources, { type: '' })).toEqual({});
  });

  it('passes through a filled field', () => {
    expect(toArguments(listResources, { type: 'Microsoft.App/containerApps' })).toEqual({
      type: 'Microsoft.App/containerApps',
    });
  });

  it('never invents keys the schema does not declare', () => {
    const args = toArguments(listResources, { type: 'X', resourceGroup: 'someone-elses' });
    expect(args).toEqual({ type: 'X' });
    expect(args).not.toHaveProperty('resourceGroup');
  });

  it('converts numbers, and drops unchecked booleans', () => {
    const schema: ToolSchema = {
      type: 'object',
      properties: { limit: { type: 'integer' }, verbose: { type: 'boolean' } },
    };
    expect(toArguments(schema, { limit: '25', verbose: false })).toEqual({ limit: 25 });
    expect(toArguments(schema, { limit: '25', verbose: true })).toEqual({ limit: 25, verbose: true });
  });
});
