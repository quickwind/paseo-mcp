import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveDevinMcpServers } from "./devin";
import type { McpRoots } from "../types";

describe("resolveDevinMcpServers", () => {
  let tmpDir: string;
  let roots: McpRoots;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "devin-mcp-test-"));
    roots = {
      homeDir: path.join(tmpDir, "home"),
      claudeHome: path.join(tmpDir, "home", ".claude"),
      codexHome: path.join(tmpDir, "home", ".codex"),
      devinHome: path.join(tmpDir, "home", ".devin"),
    };
    await mkdir(roots.homeDir, { recursive: true });
    if (roots.devinHome) {
      await mkdir(roots.devinHome, { recursive: true });
    }
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("discovers global devin mcp config", async () => {
    const xdgDir = path.join(roots.homeDir, ".config", "devin");
    await mkdir(xdgDir, { recursive: true });
    const globalConfig = path.join(xdgDir, "mcp_config.json");
    await writeFile(
      globalConfig,
      JSON.stringify({
        mcpServers: {
          "figma-remote-mcp-server": {
            serverUrl: "https://mcp.figma.com/mcp",
          },
          "github-mcp-server": {
            command: "docker",
            args: ["run", "-i", "--rm", "ghcr.io/github/github-mcp-server"],
            env: {
              GITHUB_PERSONAL_ACCESS_TOKEN: "test-token",
            },
          },
        },
      }),
    );

    const projectDir = path.join(tmpDir, "workspace");
    await mkdir(projectDir, { recursive: true });

    const entries = await resolveDevinMcpServers({ cwd: projectDir, roots });
    expect(entries).toHaveLength(2);

    const figma = entries.find((e) => e.name === "figma-remote-mcp-server");
    expect(figma).toBeDefined();
    expect(figma?.provider).toBe("devin");
    expect(figma?.scope).toBe("global");
    expect(figma?.transport).toBe("http");
    expect(figma?.url).toBe("https://mcp.figma.com/mcp");

    const github = entries.find((e) => e.name === "github-mcp-server");
    expect(github).toBeDefined();
    expect(github?.command).toBe("docker");
    expect(github?.envKeys).toEqual(["GITHUB_PERSONAL_ACCESS_TOKEN"]);
  });

  it("discovers project level devin mcp config", async () => {
    const projectDir = path.join(tmpDir, "workspace");
    const devinProjectDir = path.join(projectDir, ".devin");
    await mkdir(devinProjectDir, { recursive: true });

    await writeFile(
      path.join(devinProjectDir, "mcp_config.json"),
      JSON.stringify({
        mcpServers: {
          "local-tool": {
            command: "node",
            args: ["./tool.js"],
          },
        },
      }),
    );

    const entries = await resolveDevinMcpServers({ cwd: projectDir, roots });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("local-tool");
    expect(entries[0]!.scope).toBe("project");
  });
});
