import type { McpServerEntry, McpTransport } from "../../shared/mcp";
import type { ResolvedMcpCandidate } from "../types";

export function normalizeCandidate(candidate: ResolvedMcpCandidate): McpServerEntry | null {
  const { name, provider, scope, scopeLabel, configSource, rawConfig } = candidate;
  if (!rawConfig || typeof rawConfig !== "object") return null;

  const conf = rawConfig as Record<string, unknown>;

  let transport: McpTransport = "stdio";
  let command: string | undefined;
  let args: string[] | undefined;
  let url: string | undefined;
  const envKeys: string[] = [];

  const rawUrl =
    typeof conf.url === "string"
      ? conf.url
      : typeof conf.serverUrl === "string"
        ? conf.serverUrl
        : undefined;

  if (typeof conf.type === "string") {
    if (conf.type === "sse") transport = "sse";
    else if (conf.type === "http") transport = "http";
    else if (conf.type === "stdio") transport = "stdio";
  } else if (rawUrl) {
    transport = rawUrl.startsWith("http") ? "http" : "sse";
  }

  if (typeof conf.command === "string") {
    command = conf.command;
  }
  if (Array.isArray(conf.args)) {
    args = conf.args.map((a) => String(a));
  }
  if (rawUrl) {
    url = rawUrl;
  }

  if (conf.env && typeof conf.env === "object") {
    envKeys.push(...Object.keys(conf.env as Record<string, unknown>).sort());
  }

  const id = `${provider}:${scope}:${name}`;

  return {
    id,
    name,
    provider,
    scope,
    scopeLabel,
    transport,
    ...(command !== undefined ? { command } : {}),
    ...(args !== undefined ? { args } : {}),
    ...(url !== undefined ? { url } : {}),
    envKeys,
    configSource,
    enabled: conf.disabled !== true && conf.enabled !== false,
  };
}
