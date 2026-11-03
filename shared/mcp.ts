import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const McpScopeSchema = z.enum(["injected", "project", "repo", "global", "plugin"]);
export type McpScope = z.infer<typeof McpScopeSchema>;

export const McpTransportSchema = z.enum(["stdio", "sse", "http"]);
export type McpTransport = z.infer<typeof McpTransportSchema>;

export const McpServerEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  scope: McpScopeSchema,
  scopeLabel: z.string(),
  transport: McpTransportSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  envKeys: z.array(z.string()).default([]),
  configSource: z.string().nullable(),
  enabled: z.boolean().default(true),
});
export type McpServerEntry = z.infer<typeof McpServerEntrySchema>;

export const listMcpServers = defineRpc({
  name: "mcp.list",
  input: z.object({
    agentId: z.string(),
  }),
  output: z.object({
    provider: z.string(),
    cwd: z.string().nullable(),
    scanned: z.boolean(),
    servers: z.array(McpServerEntrySchema),
  }),
});

export const readMcpServer = defineRpc({
  name: "mcp.read",
  input: z.object({
    agentId: z.string(),
    serverId: z.string(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    scope: McpScopeSchema,
    scopeLabel: z.string(),
    transport: McpTransportSchema,
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    envKeys: z.array(z.string()),
    configSource: z.string().nullable(),
    rawConfigJson: z.string(),
  }),
});
