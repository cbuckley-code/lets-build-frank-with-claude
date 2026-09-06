/** PORT defaulting to 3000 is a contract with deploy.yml's --target-port. */
import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_DIR, loadConfig } from "../src/config.js";

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

  it("defaults publicDir to the console build inside the package", () => {
    expect(loadConfig({}).publicDir).toBe(DEFAULT_PUBLIC_DIR);
    expect(loadConfig({}).publicDir.endsWith("public")).toBe(true);
  });

  it("takes PUBLIC_DIR from the environment", () => {
    expect(loadConfig({ PUBLIC_DIR: "/srv/console" }).publicDir).toBe("/srv/console");
  });

  it("fails at boot on an unusable PORT, with a plain-language message", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(/environment configuration is invalid/i);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/environment configuration is invalid/i);
  });
});
