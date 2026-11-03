import type { McpServerEntry } from "../../shared/mcp";
import { normalizeCandidate } from "./normalize";

export function resolveInjectedServers(
  provider: string,
  sessionConfig: { mcpServers?: Record<string, unknown> } | null | undefined,
): McpServerEntry[] {
  if (!sessionConfig?.mcpServers || typeof sessionConfig.mcpServers !== "object") {
    return [];
  }

  const entries: McpServerEntry[] = [];
  for (const [name, rawConfig] of Object.entries(sessionConfig.mcpServers)) {
    const entry = normalizeCandidate({
      name,
      provider,
      scope: "injected",
      scopeLabel: "Session Injected",
      configSource: "agent.config.mcpServers",
      rawConfig,
    });
    if (entry) entries.push(entry);
  }

  return entries;
}
