import type { McpScope, McpServerEntry } from "../shared/mcp";

export interface ResolvedMcpCandidate {
  name: string;
  provider: string;
  scope: McpScope;
  scopeLabel: string;
  configSource: string | null;
  rawConfig: unknown;
}

export interface McpRoots {
  homeDir: string;
  claudeHome: string;
  codexHome: string;
  devinHome?: string;
  /** Windows roaming application data directory, typically `%APPDATA%`. */
  appDataDir?: string;
  /** Base directory for editor-managed Devin configuration imports. */
  codeiumHome?: string;
  claudeDesktopConfigPath?: string;
  /** Directory holding `opencode.json` / `opencode.jsonc`. */
  opencodeHome?: string;
  /** `OPENCODE_CONFIG` override pointing at a specific config file. */
  opencodeConfigPath?: string;
}
