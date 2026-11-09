import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { McpRoots } from "../types";
import { resolveClaudeMcpServers } from "./claude";

describe("resolveClaudeMcpServers", () => {
  let tmpDir: string;
  let roots: McpRoots;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "claude-mcp-test-"));
    roots = {
      homeDir: path.join(tmpDir, "home"),
      claudeHome: path.join(tmpDir, "home", ".claude"),
      codexHome: path.join(tmpDir, "home", ".codex"),
      claudeDesktopConfigPath: path.join(tmpDir, "appdata", "Claude", "claude_desktop_config.json"),
    };
    await mkdir(roots.claudeHome, { recursive: true });
    await mkdir(path.dirname(roots.claudeDesktopConfigPath!), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("ignores Claude Desktop settings because this provider is Claude Code", async () => {
    await writeFile(
      roots.claudeDesktopConfigPath!,
      JSON.stringify({
        preferences: {
          coworkBrowserToolsEnabled: true,
        },
      }),
    );

    await writeFile(
      path.join(roots.homeDir, ".claude.json"),
      JSON.stringify({
        mcpServers: {
          "claude-code-server": {
            type: "http",
            url: "https://example.test/mcp",
            headers: {
              Authorization: "Bearer test-token",
            },
          },
        },
      }),
    );

    const entries = await resolveClaudeMcpServers({
      cwd: path.join(tmpDir, "workspace"),
      roots,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("claude-code-server");
    expect(entries[0]!.transport).toBe("http");
    expect(entries[0]!.url).toBe("https://example.test/mcp");
  });

  it("discovers project Claude Code MCP servers", async () => {
    const projectDir = path.join(tmpDir, "workspace");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
          },
        },
      }),
    );
    const entries = await resolveClaudeMcpServers({
      cwd: projectDir,
      roots,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("filesystem");
  });
});
