import type { PluginButtonContentProps, PluginHostProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { McpBrowser } from "./browser";

export type McpTabTarget = { workspaceId: string; agentId: string };

const PADDING = 12;

export function createMcpPopover(openTab: (target: McpTabTarget) => void) {
  return function McpPopover(props: PluginButtonContentProps) {
    if (props.context !== "agent") return null;
    return (
      <McpPopoverBody
        theme={props.theme}
        compact={props.layout.compact}
        target={{ workspaceId: props.workspaceId, agentId: props.agentId }}
        close={props.close}
        openTab={openTab}
      />
    );
  };
}

function McpPopoverBody({
  theme,
  compact,
  target,
  close,
  openTab,
}: {
  theme: PluginHostProps["theme"];
  compact: boolean;
  target: McpTabTarget;
  close: () => void;
  openTab: (target: McpTabTarget) => void;
}) {
  const { workspaceId, agentId } = target;
  const styles = useMemo(
    () => ({
      header: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        marginBottom: PADDING,
      },
      title: { color: theme.colors.foreground, fontSize: 15, fontWeight: "600" as const },
      open: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        marginLeft: "auto" as const,
      },
      openLabel: { color: theme.colors.accent, fontSize: 13 },
    }),
    [theme],
  );

  const handleOpenTab = useCallback(() => {
    openTab({ workspaceId, agentId });
    close();
  }, [openTab, close, workspaceId, agentId]);

  return (
    <View>
      <View style={styles.header}>
        {compact ? null : <Text style={styles.title}>MCP Servers</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the MCP tab"
          hitSlop={8}
          style={styles.open}
          onPress={handleOpenTab}
        >
          <Text style={styles.openLabel}>Open tab</Text>
          <Icon name="Maximize2" size={13} color={theme.colors.accent} />
        </Pressable>
      </View>
      <McpBrowser
        theme={theme}
        frame="popover"
        padding={PADDING}
        agentId={agentId}
      />
    </View>
  );
}
