import { describe, expect, it } from "vitest";
import { defaultMcpRoots } from "./mcp";

describe("defaultMcpRoots", () => {
  it("resolves default roots with environment overrides", () => {
    const roots = defaultMcpRoots({
      CODEX_HOME: "/custom/codex",
    });

    expect(roots.codexHome).toBe("/custom/codex");
    expect(roots.claudeHome).toContain(".claude");
  });

  it("falls back to the Windows roaming profile when APPDATA is unavailable", () => {
    const roots = defaultMcpRoots({
      CODEX_HOME: "/custom/codex",
      APPDATA: undefined,
      USERPROFILE: "C:\\Users\\test-user",
    });

    if (process.platform === "win32") {
      expect(roots.appDataDir).toBe("C:\\Users\\test-user\\AppData\\Roaming");
    }
  });
});
