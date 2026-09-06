/**
 * End-to-end over real HTTP, driven by the official MCP client — the same way
 * Claude Desktop, Claude Code and the Cloudscape console will reach Frank.
 * If the transport contract in ADR-001 breaks, this test breaks.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";

const emptyDir = mkdtempSync(path.join(tmpdir(), "frank-no-console-"));

let httpServer: Server;
let baseUrl: string;

beforeAll(async () => {
  // No console build here: the API must stand on its own.
  const app = createApp({ port: 0, host: "127.0.0.1", publicDir: emptyDir });
  httpServer = await new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

async function connect(): Promise<Client> {
  const client = new Client({ name: "frank-test-client", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
  return client;
}

/** A stack trace must never reach a caller (ADR-002). */
function looksLikeAStackTrace(text: string): boolean {
  return /\n\s+at\s|\.ts:\d+:\d+|\.js:\d+:\d+/.test(text);
}

describe("HTTP surface", () => {
  it("answers the Container Apps health probe with 200", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("rejects GET on the MCP endpoint with a plain-language 405", async () => {
    const response = await fetch(`${baseUrl}/mcp`);
    expect(response.status).toBe(405);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/POST only/i);
  });
});

describe("MCP over Streamable HTTP", () => {
  it("completes the MCP handshake", async () => {
    const client = await connect();
    expect(client.getServerVersion()?.name).toBe("frank");
    await client.close();
  });

  it("advertises get_status as a read-only tool with a described schema", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    const getStatus = tools.find((tool) => tool.name === "get_status");
    expect(getStatus).toBeDefined();
    expect(getStatus?.description).toBeTruthy();
    expect(getStatus?.annotations?.readOnlyHint).toBe(true);

    const schema = getStatus?.inputSchema as {
      properties?: Record<string, { description?: string }>;
      additionalProperties?: boolean;
    };
    expect(schema.properties?.name?.description).toBeTruthy();
    // Strict schema: clients are told extra fields are not accepted.
    expect(schema.additionalProperties).toBe(false);

    await client.close();
  });

  it("returns version, uptime and a greeting as structured JSON", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_status",
      arguments: { name: "the class" },
    })) as CallToolResult;

    expect(result.isError).toBeFalsy();

    const payload = result.structuredContent as {
      summary: string;
      version: string;
      uptimeSeconds: number;
      startedAt: string;
      greeting: string;
    };

    expect(typeof payload.summary).toBe("string");
    expect(payload.summary.length).toBeGreaterThan(0);
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(payload.uptimeSeconds)).toBe(true);
    expect(Date.parse(payload.startedAt)).not.toBeNaN();
    expect(payload.greeting).toContain("the class");

    // The text block carries the same payload, for clients that only read text.
    const [block] = result.content;
    expect(block?.type).toBe("text");
    expect(JSON.parse(String(block?.text))).toEqual(payload);

    await client.close();
  });

  it("works with no arguments at all", async () => {
    const client = await connect();
    const result = (await client.callTool({ name: "get_status" })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { greeting: string }).greeting).toBe(
      "Hello — Frank here.",
    );
    await client.close();
  });

  it("rejects an unknown input field with isError and no stack trace", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_status",
      arguments: { nmae: "typo" },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    const text = String(result.content[0]?.text ?? "");
    expect(text.length).toBeGreaterThan(0);
    expect(looksLikeAStackTrace(text)).toBe(false);

    await client.close();
  });

  it("rejects a wrongly typed argument the same way", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_status",
      arguments: { name: 42 },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(looksLikeAStackTrace(String(result.content[0]?.text ?? ""))).toBe(false);
    await client.close();
  });

  it("reports an unknown tool without crashing", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_nothing",
      arguments: {},
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    await client.close();
  });

  it("serves concurrent clients independently", async () => {
    const clients = await Promise.all([connect(), connect(), connect()]);
    const results = await Promise.all(
      clients.map((client) => client.callTool({ name: "get_status", arguments: {} })),
    );

    for (const result of results as CallToolResult[]) {
      expect(result.isError).toBeFalsy();
    }
    await Promise.all(clients.map((client) => client.close()));
  });
});

describe("get_node_version over the wire", () => {
  it("is advertised as a read-only tool that takes no arguments", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    const tool = tools.find((candidate) => candidate.name === "get_node_version");
    expect(tool).toBeDefined();
    expect(tool?.description).toBeTruthy();
    expect(tool?.annotations?.readOnlyHint).toBe(true);

    const schema = tool?.inputSchema as {
      properties?: Record<string, unknown>;
      additionalProperties?: boolean;
    };
    expect(schema.properties ?? {}).toEqual({});
    expect(schema.additionalProperties).toBe(false);

    await client.close();
  });

  it("returns the running Node version as structured JSON", async () => {
    const client = await connect();
    const result = (await client.callTool({ name: "get_node_version" })) as CallToolResult;

    expect(result.isError).toBeFalsy();

    const payload = result.structuredContent as {
      summary: string;
      nodeVersion: string;
      major: number;
      v8Version: string;
      platform: string;
      arch: string;
    };

    // The test runs in the same process as the server, so this is exact.
    expect(payload.nodeVersion).toBe(process.version);
    expect(payload.major).toBe(Number.parseInt(process.versions.node, 10));
    expect(payload.v8Version).toBe(process.versions.v8);
    expect(payload.platform).toBe(process.platform);
    expect(payload.arch).toBe(process.arch);
    expect(payload.summary).toContain(process.version);

    const [block] = result.content;
    expect(block?.type).toBe("text");
    expect(JSON.parse(String(block?.text))).toEqual(payload);

    await client.close();
  });

  it("rejects an unknown input field with isError and no stack trace", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_node_version",
      arguments: { verbose: true },
    })) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(looksLikeAStackTrace(String(result.content[0]?.text ?? ""))).toBe(false);
    await client.close();
  });
});
