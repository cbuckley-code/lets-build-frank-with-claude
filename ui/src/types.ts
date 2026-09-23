// Shared types, kept separate so pages do not import the transport just to name
// its shapes (and so tests can build a fake client without touching the SDK).
export type { FrankClient, ToolResult, ToolSchema, ToolSummary, SchemaProperty } from './mcp/client';

export type ConnectionState = 'connecting' | 'connected' | 'error';
