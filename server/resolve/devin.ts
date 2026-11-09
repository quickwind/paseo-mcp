import { readFile } from "node:fs/promises";
import path from "node:path";

import type { McpServerEntry } from "../../shared/mcp";
import type { McpRoots } from "../types";
import { normalizeCandidate } from "./normalize";
import { dirsUpToRepoRoot } from "./repo-root";

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function extractDevinServers(
  data: Record<string, unknown>,
  filePath: string,
): Record<string, unknown> | null {
  if (data.mcpServers && typeof data.mcpServers === "object") {
    return data.mcpServers as Record<string, unknown>;
  }
  if (data.mcp_servers && typeof data.mcp_servers === "object") {
    return data.mcp_servers as Record<string, unknown>;
  }
  const fileName = path.basename(filePath);
  if (fileName === "config.json" || fileName === "config.local.json") {
    return null;
  }
  return data;
}

export async function resolveDevinMcpServers(options: {
  cwd: string;
  roots: McpRoots;
}): Promise<McpServerEntry[]> {
  const { cwd, roots } = options;
  const entries: McpServerEntry[] = [];
  const dirs = await dirsUpToRepoRoot(cwd);

  // 1. Project & repo search
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const isProject = i === 0;
    const scope = isProject ? "project" : "repo";
    const scopeLabel = isProject ? "Project (.devin)" : "Repository";

    const candidateFiles = [
      path.join(dir, ".devin", "mcp_config.local.json"),
      path.join(dir, ".devin", "mcp_config.json"),
      path.join(dir, ".devin", "mcp.json"),
      path.join(dir, ".devin", "config.local.json"),
      path.join(dir, ".devin", "config.json"),
    ];

    for (const filePath of candidateFiles) {
      const data = await readJsonFile(filePath);
      if (!data) continue;
      const servers = extractDevinServers(data, filePath);
      if (!servers) continue;
      for (const [name, rawConfig] of Object.entries(servers)) {
        const entry = normalizeCandidate({
          name,
          provider: "devin",
          scope,
          scopeLabel: `${scopeLabel} [${path.basename(filePath)}]`,
          configSource: filePath,
          rawConfig,
        });
        if (entry) entries.push(entry);
      }
    }
  }

  // 2. Global Devin config
  const xdgConfigDevin = path.join(
    process.env.XDG_CONFIG_HOME || path.join(roots.homeDir, ".config"),
    "devin",
  );
  const devinHome = roots.devinHome ?? path.join(roots.homeDir, ".devin");
  const appDataDevin = roots.appDataDir ? path.join(roots.appDataDir, "devin") : null;
  const editorConfigDirs = roots.codeiumHome
    ? [path.join(roots.codeiumHome, "windsurf"), path.join(roots.codeiumHome, "windsurf-next")]
    : [];
  const globalFiles = [
    ...[xdgConfigDevin, devinHome, appDataDevin]
      .filter((dir): dir is string => dir !== null)
      .flatMap((dir) => [
        path.join(dir, "mcp_config.json"),
        path.join(dir, "mcp.json"),
        path.join(dir, "config.local.json"),
        path.join(dir, "config.json"),
      ]),
    ...editorConfigDirs.map((dir) => path.join(dir, "mcp_config.json")),
  ];

  for (const filePath of globalFiles) {
    const data = await readJsonFile(filePath);
    if (!data) continue;
    const servers = extractDevinServers(data, filePath);
    if (!servers) continue;
    for (const [name, rawConfig] of Object.entries(servers)) {
      const entry = normalizeCandidate({
        name,
        provider: "devin",
        scope: "global",
        scopeLabel: `Global [${path.basename(filePath)}]`,
        configSource: filePath,
        rawConfig,
      });
      if (entry) entries.push(entry);
    }
  }

  return entries;
}
