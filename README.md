# Agent Orchestrator

🤖 **DevTools Architect** - A modern Electron/React application for managing AI development agents, skills, and configurations with clean architecture principles.

## Features

### 🎯 Core Capabilities

- **Agent Management** - Create, edit, and export agents with comprehensive metadata and configurations
- **Skill Wizard** - Step-by-step wizard for creating agent skills with Markdown, YAML, and scripts
- **MCP Configuration** - Visual editor for Model Context Protocol (MCP) configuration with secure credential storage
- **Pattern Analysis** - Generate optimized `copilot-instructions.md` from agent patterns and codebase analysis
- **Directory Sync** - Bidirectional sync between `~/.copilot` and `.github` directories

### 🔧 Technical Features

- **Clean Architecture** - Separation of concerns with domain, application, infrastructure, and presentation layers
- **VS Code Theme** - Professional dark theme inspired by VS Code
- **Secure Storage** - Keyring integration for secure credential management
- **Multi-AI Support** - Compatible with GitHub Copilot, Claude-Code, OpenCode, Cursor, and Antigravity

## Architecture

```
src/
├── domain/              # Business logic and entities
│   ├── entities/        # Core domain models (Agent, Skill, MCPConfig)
│   └── interfaces/      # Repository and service interfaces
├── application/         # Use cases and business rules
│   └── use-cases/       # Application-specific business logic
├── infrastructure/      # External interfaces
│   ├── repositories/    # Data persistence implementations
│   └── services/        # External service integrations
├── presentation/        # UI components
│   └── components/      # React components
├── main/               # Electron main process
└── renderer/           # Electron renderer process
```

## Installation

### Prerequisites

- Node.js 18+ and npm
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/GuillemPT/Agent-Orchestrator.git
cd Agent-Orchestrator

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run the built application
npm start
```

## Usage

### Agent Editor

1. Navigate to the **Agents** tab
2. Click **+ New Agent** to create a new agent
3. Configure metadata, MCP settings, and custom instructions
4. Export as `.agent.md` file

### Skill Wizard

1. Navigate to the **Skills** tab
2. Click **+ New Skill** to launch the wizard
3. Follow the 4-step process:
   - **Metadata** - Define skill information
   - **Markdown** - Add documentation
   - **YAML** - Configure YAML settings
   - **Scripts** - Add executable scripts
4. Export as `.skill.md` or `.yaml`

### MCP Configuration

1. Navigate to the **MCP Config** tab
2. Add MCP servers with commands, arguments, and environment variables
3. Use the **🔐 Manage Credentials** button for secure credential storage
4. Export configuration as `mcp.json`

### Directory Sync

1. Navigate to the **Sync** tab
2. Choose sync direction:
   - Home → GitHub
   - GitHub → Home
   - Bidirectional
3. Select conflict resolution strategy
4. Click **🔄 Sync Now**

### Pattern Analysis

1. Navigate to the **Pattern Analysis** tab
2. Select an agent
3. Optionally add codebase-specific patterns
4. Click **🔍 Analyze & Generate**
5. Review generated instructions and export as `copilot-instructions.md`

## Development

### Scripts

- `npm run dev` - Start development server (Vite + Electron)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Tech Stack

- **Frontend**: React 18, TypeScript
- **Desktop**: Electron 28
- **Build Tool**: Vite 5
- **Styling**: CSS with VS Code theme
- **Security**: Keytar for credential storage
- **File Watching**: Chokidar

## Compatibility

Agent Orchestrator generates configurations compatible with:

- ✅ GitHub Copilot
- ✅ Claude-Code
- ✅ OpenCode
- ✅ Cursor
- ✅ Antigravity

## File Formats

### .agent.md

```markdown
---
name: Example Agent
version: 1.0.0
description: Agent description
compatibility: github-copilot, claude-code
---

# Example Agent

Agent description and documentation...
```

### SKILL.md

```markdown
# Skill Name

**Version:** 1.0.0
**Description:** Skill description

## Scripts

### bash
```bash
#!/bin/bash
echo "Skill script"
```
```

### mcp.json

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "VAR_NAME": "value"
      }
    }
  }
}
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes following the clean architecture pattern
4. Write tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Author

GuillemPT

## Acknowledgments

- Inspired by VS Code's design philosophy
- Built with Clean Architecture principles
- Designed for modern AI development workflows