import path from "node:path";

import type { McpServerEntry } from "../../shared/mcp";
import type { McpRoots } from "../types";
import { readJsoncFile } from "./jsonc";
import { normalizeCandidate } from "./normalize";
import { dirsUpToRepoRoot } from "./repo-root";

const CONFIG_FILENAMES = ["opencode.json", "opencode.jsonc"];

/** Keys under `mcp` that hold settings rather than server definitions. */
const RESERVED_MCP_KEYS = new Set(["servers", "timeout"]);

/**
 * OpenCode stores servers under `mcp.servers.<name>` (current schema) and also
 * accepts the deprecated flat `mcp.<name>` form. Both are collected here.
 */
export function extractOpencodeServers(data: Record<string, unknown>): Record<string, unknown> {
  const mcp = data.mcp;
  if (!mcp || typeof mcp !== "object" || Array.isArray(mcp)) return {};

  const mcpRecord = mcp as Record<string, unknown>;
  const servers: Record<string, unknown> = {};

  if (mcpRecord.servers && typeof mcpRecord.servers === "object" && !Array.isArray(mcpRecord.servers)) {
    Object.assign(servers, mcpRecord.servers as Record<string, unknown>);
  }

  for (const [name, value] of Object.entries(mcpRecord)) {
    if (RESERVED_MCP_KEYS.has(name)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      servers[name] = value;
    }
  }

  return servers;
}

/**
 * Converts an OpenCode MCP entry into the common shape understood by
 * `normalizeCandidate`: `command`/`args` instead of a command array,
 * `env` instead of `environment`, and `stdio`/`http` instead of
 * `local`/`remote`.
 */
export function translateOpencodeServerConfig(rawConfig: unknown): Record<string, unknown> | null {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) return null;

  const conf = rawConfig as Record<string, unknown>;
  const command = Array.isArray(conf.command)
    ? conf.command.map((part) => String(part))
    : typeof conf.command === "string"
      ? [conf.command]
      : [];

  const envSource = conf.environment ?? conf.env;
  const env =
    envSource && typeof envSource === "object" && !Array.isArray(envSource)
      ? (envSource as Record<string, unknown>)
      : undefined;

  const isRemote = conf.type === "remote" || (conf.type !== "local" && typeof conf.url === "string");

  return {
    ...conf,
    type: isRemote ? "http" : "stdio",
    ...(command.length > 0 ? { command: command[0], args: command.slice(1) } : {}),
    ...(env ? { env } : {}),
    enabled: conf.enabled !== false,
  };
}

function toEntries(
  provider: string,
  scope: McpServerEntry["scope"],
  scopeLabel: string,
  configSource: string,
  servers: Record<string, unknown>,
): McpServerEntry[] {
  const entries: McpServerEntry[] = [];
  for (const [name, rawConfig] of Object.entries(servers)) {
    const entry = normalizeCandidate({
      name,
      provider,
      scope,
      scopeLabel,
      configSource,
      rawConfig: translateOpencodeServerConfig(rawConfig),
    });
    if (entry) entries.push(entry);
  }
  return entries;
}

export async function resolveOpencodeMcpServers(options: {
  cwd: string;
  roots: McpRoots;
}): Promise<McpServerEntry[]> {
  const { cwd, roots } = options;
  const entries: McpServerEntry[] = [];
  const dirs = await dirsUpToRepoRoot(cwd);

  // 1. Project & repository configs (OpenCode walks up to the git root)
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i]!;
    const isProject = i === 0;
    const scope = isProject ? "project" : "repo";
    const scopeLabel = isProject ? "Project (opencode.json)" : "Repository";

    for (const fileName of CONFIG_FILENAMES) {
      const filePath = path.join(dir, fileName);
      const data = await readJsoncFile(filePath);
      if (!data) continue;
      entries.push(
        ...toEntries(
          "opencode",
          scope,
          `${scopeLabel} [${fileName}]`,
          filePath,
          extractOpencodeServers(data),
        ),
      );
    }
  }

  // 2. Global user config: OPENCODE_CONFIG override, then $XDG_CONFIG_HOME/opencode
  const opencodeHome = roots.opencodeHome ?? path.join(roots.homeDir, ".config", "opencode");
  const globalFiles = [
    ...(roots.opencodeConfigPath ? [roots.opencodeConfigPath] : []),
    ...CONFIG_FILENAMES.map((fileName) => path.join(opencodeHome, fileName)),
  ];

  for (const filePath of globalFiles) {
    const data = await readJsoncFile(filePath);
    if (!data) continue;
    entries.push(
      ...toEntries(
        "opencode",
        "global",
        `Global [${path.basename(filePath)}]`,
        filePath,
        extractOpencodeServers(data),
      ),
    );
  }

  return entries;
}
