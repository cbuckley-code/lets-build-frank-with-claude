/** PORT defaulting to 3000 is a contract with deploy.yml's --target-port. */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("configuration from the environment", () => {
  it("defaults PORT to 3000, matching deploy.yml's --target-port", () => {
    expect(loadConfig({}).port).toBe(3000);
  });

  it("takes PORT from the environment", () => {
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
  });

  it("binds all interfaces by default, so container ingress can reach Frank", () => {
    expect(loadConfig({}).host).toBe("0.0.0.0");
  });

  it("allows no cross-origin callers unless told to", () => {
    expect(loadConfig({}).allowedOrigins).toEqual([]);
  });

  it("parses a comma-separated CORS allowlist for the console", () => {
    const config = loadConfig({
      CORS_ALLOWED_ORIGINS: "https://console.example.net, https://localhost:5173 ,",
    });
    expect(config.allowedOrigins).toEqual([
      "https://console.example.net",
      "https://localhost:5173",
    ]);
  });

  it("fails at boot on an unusable PORT, with a plain-language message", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(/environment configuration is invalid/i);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/environment configuration is invalid/i);
  });
});
