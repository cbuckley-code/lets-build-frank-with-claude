/**
 * ADR-009 puts the console and the API on one origin, which means a static
 * handler and an SPA fallback now sit in the same Express app as `/mcp`. The
 * risk that introduces is exactly one: the fallback swallowing an API request
 * and answering it with a page of HTML. These tests exist to catch that.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createApp } from "../src/app.js";

const INDEX_HTML = "<!doctype html><title>Frank</title><div id=\"root\"></div>";
const ASSET_JS = "console.log('frank');";

let httpServer: Server;
let baseUrl: string;

beforeAll(async () => {
  // A stand-in for what the root Dockerfile copies into server/public.
  const publicDir = mkdtempSync(path.join(tmpdir(), "frank-console-"));
  writeFileSync(path.join(publicDir, "index.html"), INDEX_HTML);
  mkdirSync(path.join(publicDir, "assets"));
  writeFileSync(path.join(publicDir, "assets", "index-abc123.js"), ASSET_JS);

  const app = createApp({ port: 0, host: "127.0.0.1", publicDir });
  httpServer = await new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe("the console is served from Frank's own origin", () => {
  it("serves the app shell at /", async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    await expect(response.text()).resolves.toContain("<div id=\"root\">");
  });

  it("serves fingerprinted assets", async () => {
    const response = await fetch(`${baseUrl}/assets/index-abc123.js`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(ASSET_JS);
  });

  it("returns the app shell for a client-side route", async () => {
    const response = await fetch(`${baseUrl}/tools`);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("<div id=\"root\">");
  });

  it("404s a missing asset instead of returning HTML", async () => {
    const response = await fetch(`${baseUrl}/assets/does-not-exist.js`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type") ?? "").not.toMatch(/text\/html/);
  });

  it("does not cache the app shell, so a redeploy is picked up", async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.headers.get("cache-control")).toMatch(/no-cache/);
  });
});

describe("the SPA fallback does not swallow Frank's API", () => {
  it("still answers GET /healthz with JSON, not the app shell", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("still answers POST /mcp over the real MCP client", async () => {
    const client = new Client({ name: "frank-console-test", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain("get_status");

    const result = (await client.callTool({
      name: "get_status",
      arguments: {},
    })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { version: string }).version).toMatch(/^\d+\.\d+\.\d+/);

    await client.close();
  });

  it("answers POST /mcp with JSON even though a static handler is mounted", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    const body = await response.text();
    expect(body).not.toContain("<div id=\"root\">");
    expect(JSON.parse(body).result.tools).toBeDefined();
  });

  it("keeps GET /mcp a 405, rather than serving the app shell", async () => {
    const response = await fetch(`${baseUrl}/mcp`);
    expect(response.status).toBe(405);
    const body = await response.text();
    expect(body).not.toContain("<div id=\"root\">");
    expect(JSON.parse(body).error.message).toMatch(/POST only/i);
  });

  it("does not answer a POST to an unknown path with the app shell", async () => {
    const response = await fetch(`${baseUrl}/not-a-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.not.toContain("<div id=\"root\">");
  });
});

describe("without a console build", () => {
  let apiOnly: Server;
  let apiOnlyUrl: string;

  beforeAll(async () => {
    const app = createApp({
      port: 0,
      host: "127.0.0.1",
      publicDir: mkdtempSync(path.join(tmpdir(), "frank-unbuilt-")),
    });
    apiOnly = await new Promise<Server>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });
    apiOnlyUrl = `http://127.0.0.1:${(apiOnly.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => apiOnly.close(() => resolve()));
  });

  it("still serves the API, so a server-only checkout works", async () => {
    await expect((await fetch(`${apiOnlyUrl}/healthz`)).status).toBe(200);
  });

  it("404s the console rather than crashing", async () => {
    expect((await fetch(`${apiOnlyUrl}/`)).status).toBe(404);
  });
});
