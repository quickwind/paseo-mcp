import {
  type PluginButtonIconProps,
  type PluginButtonRegistration,
  type PluginClientContext,
} from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useEffect } from "react";

import { followAgents, type AgentList, type AgentUpdate } from "./agents";
import { useMcpQuery } from "./mcp-query";
import { createMcpPopover } from "./popover";

const TITLE = "MCP";

function createPillIcon(agentId: string, pill: { current?: PluginButtonRegistration }) {
  return function McpPillIcon({ size, color }: PluginButtonIconProps) {
    const query = useMcpQuery(agentId);
    const count = query.data?.servers.length ?? 0;
    const label = query.data ? `${TITLE} ${count}` : TITLE;

    useEffect(() => {
      pill.current?.update({ label });
    }, [pill, label]);

    return <Icon name="Cpu" size={size} color={color} />;
  };
}

export function contributePills(client: PluginClientContext) {
  const pills = new Map<string, { workspaceId: string; registration: PluginButtonRegistration }>();
  let stopped = false;
  const Popover = createMcpPopover((target) => client.openPanel("mcp", target));

  function addPill(agentId: string, workspaceId: string) {
    if (stopped) return;
    const current = pills.get(agentId);
    if (current?.workspaceId === workspaceId) return;
    if (current) removePill(agentId);

    const pill: { current?: PluginButtonRegistration } = {};
    pill.current = client.addComposerPill({
      id: "mcp",
      workspaceId,
      agentId,
      button: {
        title: TITLE,
        label: TITLE,
        icon: createPillIcon(agentId, pill),
        behavior: { kind: "popover", Content: Popover },
      },
    });
    pills.set(agentId, { workspaceId, registration: pill.current });
  }

  function removePill(agentId: string) {
    pills.get(agentId)?.registration.remove();
    pills.delete(agentId);
  }

  function applyUpdate(update: AgentUpdate) {
    if (update.kind === "remove") {
      removePill(update.agentId);
      return;
    }
    const { id, workspaceId } = update.agent;
    if (workspaceId) addPill(id, workspaceId);
  }

  function applySnapshot(list: AgentList) {
    if (stopped) return;
    const listed = new Map<string, string>();
    list.entries.forEach(({ agent }) => {
      if (agent.workspaceId) listed.set(agent.id, agent.workspaceId);
    });
    [...pills.keys()].forEach((agentId) => {
      if (!listed.has(agentId)) removePill(agentId);
    });
    listed.forEach((workspaceId, agentId) => addPill(agentId, workspaceId));
  }

  const unfollow = followAgents(
    client.paseo,
    { snapshot: applySnapshot, update: applyUpdate },
    () => {
      const unsubscribe = client.paseo.agents.subscribe(applyUpdate);
      client.paseo.agents
        .list()
        .then((result) => {
          result.entries.forEach(({ agent }) => {
            if (agent.workspaceId) addPill(agent.id, agent.workspaceId);
          });
        })
        .catch((error: unknown) => {
          console.error("mcp: could not seed composer pills", error);
        });
      return unsubscribe;
    },
  );

  return () => {
    stopped = true;
    unfollow();
    pills.forEach((pill) => pill.registration.remove());
    pills.clear();
  };
}
