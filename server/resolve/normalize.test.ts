import { describe, expect, it } from "vitest";
import { normalizeCandidate } from "./normalize";

describe("normalizeCandidate", () => {
  it("normalizes stdio mcp config", () => {
    const entry = normalizeCandidate({
      name: "github",
      provider: "claude",
      scope: "project",
      scopeLabel: "Project (.mcp.json)",
      configSource: "/test/.mcp.json",
      rawConfig: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: "secret-token",
        },
      },
    });

    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("github");
    expect(entry?.provider).toBe("claude");
    expect(entry?.transport).toBe("stdio");
    expect(entry?.command).toBe("npx");
    expect(entry?.args).toEqual(["-y", "@modelcontextprotocol/server-github"]);
    expect(entry?.envKeys).toEqual(["GITHUB_PERSONAL_ACCESS_TOKEN"]);
    expect(entry?.enabled).toBe(true);
  });

  it("normalizes sse/http mcp config", () => {
    const entry = normalizeCandidate({
      name: "remote-tools",
      provider: "generic",
      scope: "injected",
      scopeLabel: "Session Injected",
      configSource: "agent.config.mcpServers",
      rawConfig: {
        type: "http",
        url: "https://tools.example.com/mcp",
      },
    });

    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("remote-tools");
    expect(entry?.transport).toBe("http");
    expect(entry?.url).toBe("https://tools.example.com/mcp");
  });

  it("normalizes devin serverUrl format", () => {
    const entry = normalizeCandidate({
      name: "figma-remote",
      provider: "devin",
      scope: "global",
      scopeLabel: "Global [mcp_config.json]",
      configSource: "/test/mcp_config.json",
      rawConfig: {
        serverUrl: "https://mcp.figma.com/mcp",
      },
    });

    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("figma-remote");
    expect(entry?.provider).toBe("devin");
    expect(entry?.transport).toBe("http");
    expect(entry?.url).toBe("https://mcp.figma.com/mcp");
  });
});
