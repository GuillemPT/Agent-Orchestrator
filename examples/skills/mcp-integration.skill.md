# MCP Integration Skill

**Version:** 1.0.0

**Description:** Create, validate, and manage Model Context Protocol (MCP) server configurations for use within the Agent Orchestrator.

**Category:** MCP

## Overview

The Agent Orchestrator manages MCP configurations through:

- **`MCPConfig` entity** (`src/domain/entities/MCPConfig.ts`) — domain model for a single MCP server entry
- **`FileSystemMCPRepository`** (`src/infrastructure/repositories/FileSystemMCPRepository.ts`) — persists `mcp.json` to disk
- **`MCPToolsService`** (`src/infrastructure/services/MCPToolsService.ts`) — resolves available tools from a running MCP server
- **`MCPConfig` React component** (`src/renderer/components/MCPConfig.tsx`) — visual editor

An `mcp.json` file follows this schema:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

Secrets (API keys, tokens) stored as env vars must be saved via `KeytarSecureStorage` and resolved at runtime — never hardcoded in `mcp.json`.

## Common MCP Servers

| Server | Package | Notes |
|---|---|---|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Read/write local files |
| GitHub | `@modelcontextprotocol/server-github` | GitHub API, requires `GITHUB_TOKEN` |
| Git | `@modelcontextprotocol/server-git` | Local git operations |
| Brave Search | `@modelcontextprotocol/server-brave-search` | Web search, requires `BRAVE_API_KEY` |
| Fetch | `@modelcontextprotocol/server-fetch` | HTTP requests |

## Scripts

### bash

```bash
#!/bin/bash
# Validate an mcp.json file against the expected schema

MCP_FILE="${1:-mcp.json}"

if [ ! -f "$MCP_FILE" ]; then
  echo "❌ File not found: $MCP_FILE"
  exit 1
fi

echo "=== Validating $MCP_FILE ==="

# Check top-level key
if ! python3 -c "
import json, sys
with open('$MCP_FILE') as f:
    data = json.load(f)
if 'mcpServers' not in data:
    print('❌ Missing top-level key: mcpServers')
    sys.exit(1)
for name, cfg in data['mcpServers'].items():
    if 'command' not in cfg:
        print(f'❌ Server \"{name}\" missing required field: command')
        sys.exit(1)
    if not isinstance(cfg.get('args', []), list):
        print(f'❌ Server \"{name}\" args must be an array')
        sys.exit(1)
print('✅ Schema valid')
"; then
  exit 1
fi

echo ""
echo "=== Checking for hardcoded secrets ==="
secrets=$(grep -in "password\|api_key\|secret\|token" "$MCP_FILE" | grep -v "ENV_VAR\|description\|placeholder" || true)
if [ -n "$secrets" ]; then
  echo "⚠️  Potential hardcoded secrets detected:"
  echo "$secrets"
  echo "   Use KeytarSecureStorage and reference via env vars instead."
else
  echo "✅ No hardcoded secrets found"
fi
```

### python

```python
#!/usr/bin/env python3
"""Generate a valid mcp.json snippet for common servers."""

import json
import sys

TEMPLATES = {
    "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
        "env": {}
    },
    "github": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {"GITHUB_TOKEN": "<stored-in-keytar>"}
    },
    "git": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "."],
        "env": {}
    },
    "fetch": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-fetch"],
        "env": {}
    },
}

def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "filesystem"
    if name not in TEMPLATES:
        print(f"Unknown server: {name}. Available: {', '.join(TEMPLATES)}")
        sys.exit(1)

    snippet = {"mcpServers": {name: TEMPLATES[name]}}
    print(json.dumps(snippet, indent=2))

if __name__ == "__main__":
    main()
```

### typescript

```typescript
// Example: Adding a new MCP server via MCPUseCases
// Mirrors how MCPConfig.tsx calls the IPC layer

const newServer: MCPServerConfig = {
  name: 'my-server',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
  env: {},
  tools: [],
};

// Via IPC from renderer
const saved = await window.electronAPI.mcpSave(newServer);
console.log('Saved MCP server:', saved.name);
```

## Configuration

```yaml
name: mcp-integration
version: 1.0.0
category: mcp
enabled: true

schema:
  topLevelKey: mcpServers
  requiredServerFields:
    - command
  optionalServerFields:
    - args
    - env
    - tools

security:
  neverHardcodeSecrets: true
  secretStorage: KeytarSecureStorage
  sensitiveEnvKeys:
    - GITHUB_TOKEN
    - BRAVE_API_KEY
    - OPENAI_API_KEY
    - ANTHROPIC_API_KEY

settings:
  validateOnSave: true
  resolveToolsOnConnect: true
```
