import type { PluginServerContext } from "@getpaseo/plugin/server";

import { createListMcpServersHandler, createReadMcpServerHandler } from "./server/mcp";
import { listMcpServers, readMcpServer } from "./shared/mcp";

export default function contribute(server: PluginServerContext) {
  server.handle(listMcpServers, createListMcpServersHandler());
  server.handle(readMcpServer, createReadMcpServerHandler());
  return () => {};
}
