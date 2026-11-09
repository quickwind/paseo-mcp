# paseo-mcp

A Paseo plugin that lists and inspects Model Context Protocol (MCP) servers configured for your agent sessions.

Supports:
- **OpenCode**: Scans `opencode.json` / `opencode.jsonc` in the project (up to the git root), `$OPENCODE_CONFIG`, and `~/.config/opencode/`.
- **Claude Code**: Scans `.mcp.json`, `.claude/mcp.json`, `~/.claude.json`, Claude Desktop config, and installed plugins.
- **Codex**: Scans `.codex/mcp.json`, `.codex/config.json`, `~/.codex/config.json`, and `~/.agents/mcp.json`.
- **Devin**: Scans project `.devin/mcp_config.local.json`, `.devin/mcp_config.json`, and legacy `.devin/config.local.json` / `.devin/config.json`; global `~/.config/devin/`, `~/.devin/`, and Windows `%APPDATA%\devin\` MCP and legacy config files; plus editor-imported `%USERPROFILE%\.codeium\windsurf\mcp_config.json` and `windsurf-next\mcp_config.json`.
- **Session / Injected MCP**: Discovers MCP servers injected into runtime sessions (such as Paseo built-in MCP or plugin-injected servers).

## Features

- **Composer Pill**: Shows `MCP (N)` count badge directly above the agent composer.
- **Popover & Workspace Panel**: Click the pill or use Command Center (⌘K -> "MCP Servers") to browse configured servers.
- **Scope & Source Visibility**: Clearly shows whether each server comes from Session Injection, Project, Repository, Global configuration, or a Plugin.
- **Safe Inspection**: Displays transport (`stdio`, `http`, `sse`), executable arguments, URLs, and masked environment variables.

## Installation

From npm (after publishing):

```bash
paseo plugin install npm:paseo-mcp
```

From a local checkout:

```bash
# In Paseo CLI:
paseo plugin install /path/to/paseo-mcp
```

Make sure `"pluginsEnabled": true` is present in your Paseo `config.json`.

## Development

```bash
npm install
npm run typecheck
npm test
```

## License

MIT
