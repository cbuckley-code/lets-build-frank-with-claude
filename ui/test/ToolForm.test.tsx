// The schema-driven form. These are really tests of ADR-002: if tools keep
// describing their parameters, the console keeps rendering them for free.
//
// Nothing here touches the network — `npm test` runs inside `docker build`
// with no Frank to talk to.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolForm, toArguments, isSupported, typeOf } from '../src/components/ToolForm';
import type { ToolSchema } from '../src/types';

const noParams: ToolSchema = { type: 'object', properties: {}, additionalProperties: false };

const filterable: ToolSchema = {
  type: 'object',
  properties: { type: { type: 'string', description: 'Full ARM type to filter to.' } },
  additionalProperties: false,
};

const twoRequired: ToolSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Exact resource name.' },
    type: { type: 'string', description: 'Full ARM type of that resource.' },
  },
  required: ['name', 'type'],
  additionalProperties: false,
};

describe('ToolForm', () => {
  it('renders a field per property, labelled by parameter name', () => {
    render(<ToolForm schema={twoRequired} values={{}} onChange={() => {}} />);
    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('type')).toBeDefined();
  });

  it("shows the parameter's own description as help text", () => {
    render(<ToolForm schema={filterable} values={{}} onChange={() => {}} />);
    expect(screen.getByText('Full ARM type to filter to.')).toBeDefined();
  });

  it('distinguishes required from optional', () => {
    render(<ToolForm schema={twoRequired} values={{}} onChange={() => {}} />);
    expect(screen.getAllByText('Required')).toHaveLength(2);
    render(<ToolForm schema={filterable} values={{}} onChange={() => {}} />);
    expect(screen.getAllByText('Optional')).toHaveLength(1);
  });

  it('renders nothing for a tool with no parameters', () => {
    const { container } = render(<ToolForm schema={noParams} values={{}} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('says so rather than guessing at a construct it cannot render', () => {
    const nested: ToolSchema = {
      type: 'object',
      properties: { filter: { type: 'object', description: 'A nested filter.' } },
    };
    render(<ToolForm schema={nested} values={{}} onChange={() => {}} />);
    expect(screen.getByText(/cannot render a object parameter yet/i)).toBeDefined();
  });
});

describe('schema interpretation', () => {
  it('reads a nullable union as its non-null type', () => {
    expect(typeOf({ type: ['string', 'null'] })).toBe('string');
  });

  it('treats string, number, integer, boolean and enums as renderable', () => {
    for (const type of ['string', 'number', 'integer', 'boolean']) {
      expect(isSupported({ type })).toBe(true);
    }
    expect(isSupported({ type: 'string', enum: ['a', 'b'] })).toBe(true);
    expect(isSupported({ type: 'array' })).toBe(false);
  });
});

describe('toArguments', () => {
  it('omits a blank optional field rather than sending an empty string', () => {
    // Frank rejects ill-typed input, so "" for an untouched filter is an error,
    // not a no-op.
    expect(toArguments(filterable, { type: '' })).toEqual({});
  });

  it('passes through a filled field', () => {
    expect(toArguments(filterable, { type: 'Microsoft.App/containerApps' })).toEqual({
      type: 'Microsoft.App/containerApps',
    });
  });

  it('never invents keys the schema does not declare', () => {
    const args = toArguments(filterable, { type: 'X', resourceGroup: 'someone-elses' });
    expect(args).toEqual({ type: 'X' });
    expect(args).not.toHaveProperty('resourceGroup');
  });

  it('converts numbers and drops unchecked booleans', () => {
    const schema: ToolSchema = {
      type: 'object',
      properties: { limit: { type: 'integer' }, verbose: { type: 'boolean' } },
    };
    expect(toArguments(schema, { limit: '25', verbose: false })).toEqual({ limit: 25 });
    expect(toArguments(schema, { limit: '25', verbose: true })).toEqual({ limit: 25, verbose: true });
  });
});
