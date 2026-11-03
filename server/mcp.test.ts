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
});
