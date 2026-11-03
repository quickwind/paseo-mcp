import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { McpRoots } from "../types";
import { parseJsonc, stripJsonc } from "./jsonc";
import {
  extractOpencodeServers,
  resolveOpencodeMcpServers,
  translateOpencodeServerConfig,
} from "./opencode";

const created: string[] = [];

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "paseo-mcp-opencode-"));
  created.push(dir);
  return dir;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeRoots(homeDir: string): McpRoots {
  return {
    homeDir,
    claudeHome: path.join(homeDir, ".claude"),
    codexHome: path.join(homeDir, ".codex"),
    opencodeHome: path.join(homeDir, ".config", "opencode"),
  };
}

describe("stripJsonc", () => {
  it("removes comments and trailing commas", () => {
    const text = `{
      // line comment
      "a": "http://example.com/*not-a-comment*/",
      /* block comment */
      "b": [1, 2, 3,],
    }`;
    expect(JSON.parse(stripJsonc(text))).toEqual({
      a: "http://example.com/*not-a-comment*/",
      b: [1, 2, 3],
    });
  });

  it("preserves escaped quotes inside strings", () => {
    expect(parseJsonc('{"a": "he said \\"hi\\" // nope"}')).toEqual({
      a: 'he said "hi" // nope',
    });
  });
});

describe("extractOpencodeServers", () => {
  it("reads the current mcp.servers schema", () => {
    expect(
      extractOpencodeServers({
        mcp: {
          timeout: { startup: 5000 },
          servers: { context7: { type: "remote", url: "https://mcp.context7.com/mcp" } },
        },
      }),
    ).toEqual({ context7: { type: "remote", url: "https://mcp.context7.com/mcp" } });
  });

  it("reads the deprecated flat mcp.<name> schema", () => {
    expect(
      extractOpencodeServers({
        mcp: { github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" } },
      }),
    ).toEqual({ github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" } });
  });
});

describe("translateOpencodeServerConfig", () => {
  it("maps local command arrays to command/args", () => {
    const translated = translateOpencodeServerConfig({
      type: "local",
      command: ["npx", "@playwright/mcp@latest"],
      environment: { TOKEN: "secret" },
    });

    expect(translated).toMatchObject({
      type: "stdio",
      command: "npx",
      args: ["@playwright/mcp@latest"],
      env: { TOKEN: "secret" },
      enabled: true,
    });
  });

  it("maps remote servers to http", () => {
    expect(
      translateOpencodeServerConfig({ type: "remote", url: "https://mcp.example.com" }),
    ).toMatchObject({ type: "http", url: "https://mcp.example.com" });
  });

  it("keeps explicitly disabled servers disabled", () => {
    expect(
      translateOpencodeServerConfig({ type: "remote", url: "https://x.dev", enabled: false }),
    ).toMatchObject({ enabled: false });
  });
});

describe("resolveOpencodeMcpServers", () => {
  it("discovers project and global jsonc configs", async () => {
    const project = await makeDir();
    const home = await makeDir();
    const roots = makeRoots(home);

    await mkdir(path.join(home, ".config", "opencode"), { recursive: true });
    await writeFile(
      path.join(home, ".config", "opencode", "opencode.jsonc"),
      `{
        // global servers
        "mcp": {
          "servers": {
            "context7": { "type": "remote", "url": "https://mcp.context7.com/mcp" },
          },
        },
      }`,
    );
    await writeFile(
      path.join(project, "opencode.json"),
      JSON.stringify({
        mcp: {
          playwright: { type: "local", command: ["npx", "@playwright/mcp@latest"] },
        },
      }),
    );

    const entries = await resolveOpencodeMcpServers({ cwd: project, roots });
    const byName = new Map(entries.map((entry) => [entry.name, entry]));

    expect(byName.get("context7")).toMatchObject({
      provider: "opencode",
      scope: "global",
      transport: "http",
      url: "https://mcp.context7.com/mcp",
    });
    expect(byName.get("playwright")).toMatchObject({
      provider: "opencode",
      scope: "project",
      transport: "stdio",
      command: "npx",
      args: ["@playwright/mcp@latest"],
    });
    expect(byName.get("context7")?.id).toBe("opencode:global:context7");
    expect(byName.get("playwright")?.configSource).toBe(path.join(project, "opencode.json"));
  });

  it("prefers OPENCODE_CONFIG when provided", async () => {
    const project = await makeDir();
    const home = await makeDir();
    const custom = path.join(home, "custom-opencode.json");
    await writeFile(
      custom,
      JSON.stringify({ mcp: { github: { type: "remote", url: "https://api.githubcopilot.com/mcp/" } } }),
    );

    const entries = await resolveOpencodeMcpServers({
      cwd: project,
      roots: { ...makeRoots(home), opencodeConfigPath: custom },
    });

    expect(entries.map((entry) => entry.name)).toContain("github");
    expect(entries.find((entry) => entry.name === "github")?.configSource).toBe(custom);
  });
});
