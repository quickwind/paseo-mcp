import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { PluginHandlerContext } from "@getpaseo/plugin/server";

import type { McpServerEntry } from "../shared/mcp";
import { stripJsonc } from "./resolve/jsonc";
import { resolveClaudeMcpServers } from "./resolve/claude";
import { resolveCodexMcpServers } from "./resolve/codex";
import { resolveDevinMcpServers } from "./resolve/devin";
import { resolveInjectedServers } from "./resolve/generic";
import { extractOpencodeServers, resolveOpencodeMcpServers } from "./resolve/opencode";
import type { McpRoots } from "./types";

export function defaultMcpRoots(env: NodeJS.ProcessEnv = process.env): McpRoots {
  const home = os.homedir();
  const userProfile = env.USERPROFILE ?? home;
  let desktopPath: string | undefined;

  if (process.platform === "darwin") {
    desktopPath = path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (process.platform === "win32" && env.APPDATA) {
    desktopPath = path.join(env.APPDATA, "Claude", "claude_desktop_config.json");
  } else {
    desktopPath = path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }

  const configHome = env.XDG_CONFIG_HOME ?? path.join(home, ".config");

  return {
    homeDir: home,
    claudeHome: path.join(home, ".claude"),
    codexHome: env.CODEX_HOME ?? path.join(home, ".codex"),
    devinHome: env.DEVIN_HOME ?? path.join(home, ".devin"),
    appDataDir:
      env.APPDATA ??
      (process.platform === "win32" ? path.join(userProfile, "AppData", "Roaming") : undefined),
    codeiumHome: path.join(home, ".codeium"),
    claudeDesktopConfigPath: desktopPath,
    opencodeHome: path.join(configHome, "opencode"),
    opencodeConfigPath: env.OPENCODE_CONFIG || undefined,
  };
}

interface LoadedAgent {
  id: string;
  provider: string;
  cwd: string;
  config?: { mcpServers?: Record<string, unknown> };
}

async function loadAgent(agentId: string, context: PluginHandlerContext): Promise<LoadedAgent> {
  const handle = context.paseo.agents.ref(agentId);
  const refreshed = await handle.refresh();
  const agent = refreshed?.agent ?? handle.current();
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  return {
    id: agent.id,
    provider: agent.provider,
    cwd: agent.cwd,
    config: (agent as unknown as { config?: { mcpServers?: Record<string, unknown> } }).config,
  };
}

/**
 * Deduplicate by server name. Priority order:
 * injected > project > repo > global > plugin.
 */
function deduplicateServers(servers: McpServerEntry[]): McpServerEntry[] {
  const precedence: Record<string, number> = {
    injected: 5,
    project: 4,
    repo: 3,
    global: 2,
    plugin: 1,
  };

  const seen = new Map<string, McpServerEntry>();
  for (const s of servers) {
    const existing = seen.get(s.name);
    if (!existing) {
      seen.set(s.name, s);
    } else {
      const currentRank = precedence[s.scope] ?? 0;
      const existingRank = precedence[existing.scope] ?? 0;
      if (currentRank > existingRank) {
        seen.set(s.name, s);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function createListMcpServersHandler(roots: McpRoots = defaultMcpRoots()) {
  return async (input: { agentId: string }, context: PluginHandlerContext) => {
    const agent = await loadAgent(input.agentId, context);

    // 1. Session injected servers
    const candidates: McpServerEntry[] = resolveInjectedServers(agent.provider, agent.config);

    // 2. Provider specific discovery
    let scanned = false;
    if (agent.provider === "claude") {
      scanned = true;
      const claudeServers = await resolveClaudeMcpServers({ cwd: agent.cwd, roots });
      candidates.push(...claudeServers);
    } else if (agent.provider === "codex") {
      scanned = true;
      const codexServers = await resolveCodexMcpServers({ cwd: agent.cwd, roots });
      candidates.push(...codexServers);
    } else if (agent.provider === "devin") {
      scanned = true;
      const devinServers = await resolveDevinMcpServers({ cwd: agent.cwd, roots });
      candidates.push(...devinServers);
    } else if (agent.provider === "opencode") {
      scanned = true;
      const opencodeServers = await resolveOpencodeMcpServers({ cwd: agent.cwd, roots });
      candidates.push(...opencodeServers);
    }

    const servers = deduplicateServers(candidates);

    return {
      provider: agent.provider,
      cwd: agent.cwd,
      scanned,
      servers,
    };
  };
}

function maskSecretValues(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config };
  for (const key of ["env", "environment", "headers"] as const) {
    const value = masked[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const secrets: Record<string, string> = {};
      for (const name of Object.keys(value as Record<string, unknown>)) {
        secrets[name] = "********";
      }
      masked[key] = secrets;
    }
  }
  return masked;
}

/** Pulls the server map out of a provider config file's parsed contents. */
function extractServersForProvider(
  provider: string,
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  if (provider === "opencode") return extractOpencodeServers(parsed);
  const containers = [parsed.mcp_servers, parsed.mcpServers];
  for (const container of containers) {
    if (container && typeof container === "object" && !Array.isArray(container)) {
      return container as Record<string, unknown>;
    }
  }
  return parsed;
}

function parseConfigFile(content: string): Record<string, unknown> {
  const normalized = content.replace(/^\uFEFF/, "");
  try {
    return JSON.parse(normalized);
  } catch {
    return JSON.parse(stripJsonc(normalized));
  }
}

export function createReadMcpServerHandler(roots: McpRoots = defaultMcpRoots()) {
  return async (input: { agentId: string; serverId: string }, context: PluginHandlerContext) => {
    const listHandler = createListMcpServersHandler(roots);
    const result = await listHandler({ agentId: input.agentId }, context);
    const server = result.servers.find((s) => s.id === input.serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${input.serverId}`);
    }

    let rawConfigJson = "{}";
    if (server.configSource && server.configSource !== "agent.config.mcpServers") {
      try {
        const fileContent = await readFile(server.configSource, "utf8");
        const parsed = parseConfigFile(fileContent);
        const servers = extractServersForProvider(server.provider, parsed);
        const raw = servers[server.name] ?? {};
        rawConfigJson = JSON.stringify(maskSecretValues(raw as Record<string, unknown>), null, 2);
      } catch {
        rawConfigJson = JSON.stringify(server, null, 2);
      }
    } else {
      rawConfigJson = JSON.stringify(
        maskSecretValues({
          command: server.command,
          args: server.args,
          url: server.url,
          transport: server.transport,
          env: server.envKeys.reduce<Record<string, string>>((acc, k) => {
            acc[k] = "********";
            return acc;
          }, {}),
        }),
        null,
        2,
      );
    }

    return {
      id: server.id,
      name: server.name,
      provider: server.provider,
      scope: server.scope,
      scopeLabel: server.scopeLabel,
      transport: server.transport,
      command: server.command,
      args: server.args,
      url: server.url,
      envKeys: server.envKeys,
      configSource: server.configSource,
      rawConfigJson,
    };
  };
}
