import type { PluginAgentPanelProps } from "@getpaseo/plugin/client";

import { McpBrowser } from "./browser";

export function McpPanel({ theme, layout, agentId }: PluginAgentPanelProps) {
  return (
    <McpBrowser
      theme={theme}
      frame="screen"
      padding={layout.compact ? 12 : 20}
      agentId={agentId}
    />
  );
}
