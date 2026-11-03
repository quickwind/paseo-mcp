import { type PluginHostProps, useAgent } from "@getpaseo/plugin/client";
import { copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useMcpDetailQuery, useMcpQuery } from "./mcp-query";
import type { McpServerEntry } from "../shared/mcp";

type Theme = PluginHostProps["theme"];

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

export type McpBrowserFrame = "screen" | "popover";

function Frame({
  frame,
  theme,
  padding,
  children,
}: {
  frame: McpBrowserFrame;
  theme: Theme;
  padding: number;
  children: ReactNode;
}) {
  const styles = useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding },
    }),
    [theme, padding],
  );
  if (frame === "popover") return <View>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

function ServerDetail({
  theme,
  padding,
  agentId,
  serverId,
  onBack,
}: {
  theme: Theme;
  padding: number;
  agentId: string;
  serverId: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const query = useMcpDetailQuery(agentId, serverId);

  const styles = useMemo(
    () => ({
      back: { color: theme.colors.accent, marginBottom: padding, fontSize: 14, fontWeight: "600" as const },
      header: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 8 },
      name: { color: theme.colors.foreground, fontSize: 20, fontWeight: "700" as const },
      badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: theme.colors.surface2,
      },
      badgeText: { color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" as const },
      metaRow: { marginBottom: 12 },
      metaLabel: { color: theme.colors.foregroundMuted, fontSize: 12, marginBottom: 2 },
      metaValue: { color: theme.colors.foreground, fontSize: 13, fontFamily: MONO },
      sectionTitle: { color: theme.colors.foreground, fontSize: 15, fontWeight: "600" as const, marginTop: 12, marginBottom: 8 },
      codeBlock: {
        backgroundColor: theme.colors.surface1,
        borderRadius: 8,
        padding: 12,
        fontFamily: MONO,
        fontSize: 12,
        color: theme.colors.foreground,
      },
      copyBtn: {
        marginTop: 6,
        color: theme.colors.accent,
        fontSize: 12,
      },
    }),
    [theme, padding],
  );

  if (query.isPending) {
    return (
      <View style={{ padding }}>
        <ActivityIndicator color={theme.colors.foregroundMuted} />
      </View>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <View style={{ padding }}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back to servers</Text>
        </Pressable>
        <Text style={{ color: theme.colors.foregroundMuted }}>Server details unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={{ padding }}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back to servers</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.name}>{data.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data.transport.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Scope</Text>
        <Text style={{ color: theme.colors.foreground, fontSize: 13 }}>{data.scopeLabel}</Text>
      </View>

      {data.configSource ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Source</Text>
          <Text style={styles.metaValue} numberOfLines={2}>
            {data.configSource}
          </Text>
          <Pressable
            onPress={() => {
              void copyText(data.configSource!);
              toast.show("Path copied to clipboard");
            }}
          >
            <Text style={styles.copyBtn}>Copy path</Text>
          </Pressable>
        </View>
      ) : null}

      {data.command ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Command</Text>
          <Text style={styles.metaValue}>
            {data.command} {data.args ? data.args.join(" ") : ""}
          </Text>
        </View>
      ) : null}

      {data.url ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>URL</Text>
          <Text style={styles.metaValue}>{data.url}</Text>
        </View>
      ) : null}

      {data.envKeys.length > 0 ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Environment Keys (Masked)</Text>
          <Text style={styles.metaValue}>{data.envKeys.join(", ")}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Configuration</Text>
      <ScrollView horizontal>
        <Text style={styles.codeBlock}>{data.rawConfigJson}</Text>
      </ScrollView>
    </View>
  );
}

export function McpBrowser({
  agentId,
  theme,
  frame,
  padding = 16,
}: {
  agentId: string;
  theme: Theme;
  frame: McpBrowserFrame;
  padding?: number;
}) {
  const [search, setSearch] = useState("");
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const agentCwd = useAgent(agentId, (s) => s.cwd);
  const query = useMcpQuery(agentId);

  const styles = useMemo(
    () => ({
      search: {
        backgroundColor: theme.colors.surface1,
        color: theme.colors.foreground,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        marginBottom: 12,
      },
      groupLabel: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        fontWeight: "700" as const,
        textTransform: "uppercase" as const,
        marginTop: 12,
        marginBottom: 6,
      },
      row: {
        backgroundColor: theme.colors.surface1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
      },
      rowHeader: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        marginBottom: 4,
      },
      name: {
        color: theme.colors.foreground,
        fontSize: 15,
        fontWeight: "600" as const,
      },
      pill: {
        backgroundColor: theme.colors.surface2,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
      },
      pillText: {
        fontSize: 11,
        fontFamily: MONO,
        color: theme.colors.accent,
      },
      detail: {
        color: theme.colors.foregroundMuted,
        fontSize: 12,
        fontFamily: MONO,
      },
      empty: {
        color: theme.colors.foregroundMuted,
        fontSize: 14,
        textAlign: "center" as const,
        marginTop: 20,
      },
    }),
    [theme],
  );

  const servers = query.data?.servers ?? [];
  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return servers;
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.transport.toLowerCase().includes(term) ||
        (s.command && s.command.toLowerCase().includes(term)) ||
        (s.url && s.url.toLowerCase().includes(term)),
    );
  }, [servers, term]);

  const groups = useMemo(() => {
    const map = new Map<string, McpServerEntry[]>();
    for (const s of filtered) {
      const label = s.scopeLabel;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (selectedServerId) {
    return (
      <Frame frame={frame} theme={theme} padding={0}>
        <ServerDetail
          theme={theme}
          padding={padding}
          agentId={agentId}
          serverId={selectedServerId}
          onBack={() => setSelectedServerId(null)}
        />
      </Frame>
    );
  }

  if (agentCwd == null) {
    return (
      <Frame frame={frame} theme={theme} padding={padding}>
        <Text style={styles.empty}>Agent is not currently active.</Text>
      </Frame>
    );
  }

  if (query.isPending) {
    return (
      <Frame frame={frame} theme={theme} padding={padding}>
        <ActivityIndicator color={theme.colors.foregroundMuted} />
      </Frame>
    );
  }

  return (
    <Frame frame={frame} theme={theme} padding={padding}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Filter MCP servers..."
        placeholderTextColor={theme.colors.foregroundMuted}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {groups.length === 0 ? (
        <Text style={styles.empty}>
          {term ? "No matching MCP servers found." : "No MCP servers configured."}
        </Text>
      ) : null}

      {groups.map(([groupLabel, items]) => (
        <View key={groupLabel}>
          <Text style={styles.groupLabel}>{groupLabel}</Text>
          {items.map((server) => (
            <Pressable
              key={server.id}
              style={styles.row}
              onPress={() => setSelectedServerId(server.id)}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.name}>{server.name}</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{server.transport.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.detail} numberOfLines={1}>
                {server.command ? `${server.command} ${server.args?.join(" ") ?? ""}` : server.url ?? ""}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </Frame>
  );
}
