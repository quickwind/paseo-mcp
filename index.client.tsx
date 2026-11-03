import type { PluginClientContext } from "@getpaseo/plugin/client";

import { McpPanel } from "./client/panel";
import { contributePills } from "./client/pill";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "mcp",
    title: "MCP Servers",
    icon: "Cpu",
    context: "agent",
    Component: McpPanel,
  });

  client.addCommandCenterItem({
    id: "open-mcp",
    title: "MCP Servers",
    icon: "Cpu",
    keywords: ["mcp", "servers", "tools", "model context protocol"],
    context: "agent",
    onSelect: ({ openPanel }) => {
      openPanel("mcp");
    },
  });

  return contributePills(client);
}
