import { useAgent, useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";

import { listMcpServers, readMcpServer } from "../shared/mcp";

export type McpListResult = z.infer<(typeof listMcpServers)["output"]>;
export type McpReadResult = z.infer<(typeof readMcpServer)["output"]>;

export function useMcpQuery(agentId: string) {
  const cwd = useAgent(agentId, (snapshot) => snapshot.cwd);
  const callListMcp = useRpc(listMcpServers);

  return useQuery({
    queryKey: ["mcp", agentId, cwd],
    queryFn: () => callListMcp({ agentId }),
    enabled: cwd != null,
    retry: false,
  });
}

export function useMcpDetailQuery(agentId: string, serverId: string | null) {
  const callReadMcp = useRpc(readMcpServer);

  return useQuery({
    queryKey: ["mcp-detail", agentId, serverId],
    queryFn: () => (serverId ? callReadMcp({ agentId, serverId }) : null),
    enabled: Boolean(agentId && serverId),
    retry: false,
  });
}
