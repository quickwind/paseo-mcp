import path from "node:path";

import type { McpServerEntry } from "../../shared/mcp";
import type { McpRoots } from "../types";
import { readJsoncFile } from "./jsonc";
import { normalizeCandidate } from "./normalize";
import { dirsUpToRepoRoot } from "./repo-root";

function extractServersFromObject(
  data: Record<string, unknown>,
  filePath: string,
): Record<string, unknown> | null {
  if (data.mcpServers && typeof data.mcpServers === "object") {
    return data.mcpServers as Record<string, unknown>;
  }
  return data;
}

export async function resolveClaudeMcpServers(options: {
  cwd: string;
  roots: McpRoots;
}): Promise<McpServerEntry[]> {
  const { cwd, roots } = options;
  const entries: McpServerEntry[] = [];
  const dirs = await dirsUpToRepoRoot(cwd);

  // 1. Scan project & repository directories up to git root
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const isProject = i === 0;
    const scope = isProject ? "project" : "repo";
    const scopeLabel = isProject ? "Project (.mcp.json)" : "Repository";

    const candidateFiles = [
      path.join(dir, ".mcp.json"),
      path.join(dir, ".claude", "mcp.json"),
      path.join(dir, ".claude.json"),
    ];

    for (const filePath of candidateFiles) {
      const data = await readJsoncFile(filePath);
      if (!data) continue;
      const servers = extractServersFromObject(data, filePath);
      if (!servers) continue;
      for (const [name, rawConfig] of Object.entries(servers)) {
        const entry = normalizeCandidate({
          name,
          provider: "claude",
          scope,
          scopeLabel: `${scopeLabel} [${path.basename(filePath)}]`,
          configSource: filePath,
          rawConfig,
        });
        if (entry) entries.push(entry);
      }
    }
  }

  // 2. Global user configs (~/.claude.json and ~/.claude/mcp.json)
  const globalFiles = [
    path.join(roots.claudeHome, "mcp.json"),
    path.join(roots.homeDir, ".claude.json"),
  ];

  for (const filePath of globalFiles) {
    const data = await readJsoncFile(filePath);
    if (!data) continue;
    const servers = extractServersFromObject(data, filePath);
    if (!servers) continue;
    for (const [name, rawConfig] of Object.entries(servers)) {
      const entry = normalizeCandidate({
        name,
        provider: "claude",
        scope: "global",
        scopeLabel: `Global [${path.basename(filePath)}]`,
        configSource: filePath,
        rawConfig,
      });
      if (entry) entries.push(entry);
    }
  }

  // 3. Claude Code Plugins (~/.claude/plugins/installed_plugins.json)
  const pluginsManifestPath = path.join(roots.claudeHome, "plugins", "installed_plugins.json");
  const pluginsData = await readJsoncFile(pluginsManifestPath);
  if (pluginsData?.plugins && typeof pluginsData.plugins === "object") {
    for (const [pluginKey, pluginEntries] of Object.entries(pluginsData.plugins)) {
      if (!Array.isArray(pluginEntries)) continue;
      const pluginName = pluginKey.split("@")[0] ?? pluginKey;
      for (const item of pluginEntries) {
        if (!item || typeof item.installPath !== "string") continue;
        const pluginMcpPath = path.join(item.installPath, ".mcp.json");
        const pluginMcp = await readJsoncFile(pluginMcpPath);
        if (!pluginMcp) continue;
        const servers = extractServersFromObject(pluginMcp, pluginMcpPath);
        if (!servers) continue;
        for (const [name, rawConfig] of Object.entries(servers)) {
          const entry = normalizeCandidate({
            name: `${pluginName}:${name}`,
            provider: "claude",
            scope: "plugin",
            scopeLabel: `Plugin [${pluginName}]`,
            configSource: pluginMcpPath,
            rawConfig,
          });
          if (entry) entries.push(entry);
        }
      }
    }
  }

  return entries;
}
