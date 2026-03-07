# Agent Orchestrator

🤖 **Agent Orchestrator** is a free, open-source web app for managing AI development agents, skills, and MCP configurations across your projects — with GitHub, GitLab, and Bitbucket integration.

> **No installation required.** Just open the app in your browser and start managing your AI configurations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## 🌐 Use it online

> 🚧 Hosted version coming soon — a public URL will be listed here once deployed.

In the meantime, you can [run it locally](#self-hosting--local-setup) in under a minute.

## Features

### 🎯 Core Capabilities

- **Agent Management** - Create, edit, and export agents with comprehensive metadata and configurations
- **Skill Wizard** - Step-by-step wizard for creating agent skills with Markdown, YAML, and scripts
- **MCP Configuration** - Visual editor for Model Context Protocol (MCP) configuration with secure credential storage
- **Pattern Analysis** - Generate optimized `copilot-instructions.md` from agent patterns and codebase analysis
- **Git Provider Integration** - Connect GitHub, GitLab, or Bitbucket to import repositories as projects
- **Directory Sync** - Bidirectional sync between `~/.copilot` and `.github` directories

### 🔧 Technical Features

- **Clean Architecture** - Separation of concerns with domain, application, infrastructure, and presentation layers
- **VS Code-inspired Theme** - Professional dark theme
- **Multi-AI Support** - Compatible with GitHub Copilot, Claude-Code, OpenCode, Cursor, and Antigravity
- **OAuth Device Flow** - Secure authentication with GitHub and GitLab

## 🔒 Data Privacy

Agent Orchestrator is a **metadata management tool** that stores ONLY:

- Agent definitions (`.agent.md` files)
- Skill configurations (`.skill.md` files)
- MCP server configurations (`mcp.json`)
- Project references (repository URLs and local paths)

**Your source code is NEVER stored, copied, or transmitted by this application.** The app only manages the configuration files that AI assistants use to understand your projects. All data lives in your browser or on your own infrastructure — nothing is sent to third-party servers.

## Architecture

```text
src/
├── domain/              # Business logic and entities
│   ├── entities/        # Core domain models (Agent, Skill, MCPConfig)
│   └── interfaces/      # Repository and service interfaces
├── application/         # Use cases and business rules
│   └── use-cases/       # Application-specific business logic
├── infrastructure/      # External interfaces
│   ├── repositories/    # Data persistence implementations
│   └── services/        # External service integrations
├── renderer/            # React frontend
│   ├── components/      # UI components
│   └── styles/          # CSS modules
└── main/                # Backend / Electron main process
```

## Self-hosting / Local setup

You can run your own instance if you prefer to keep everything fully local or on your own infrastructure.

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

# Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser.

```bash
# Production build
npm run build

# Run tests
npm test
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

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5.3 |
| Build tool | Vite 5 |
| Styling | CSS (VS Code-inspired theme) |
| Testing | Vitest |
| Git OAuth | Device Flow (GitHub/GitLab), App Passwords (Bitbucket) |

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

Agent Orchestrator is open source and contributions are very welcome — bug fixes, new features, documentation improvements, and ideas all count.

### Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce
- 💡 **Suggest features** — open an issue with the `enhancement` label
- 📝 **Improve docs** — fix typos, add examples, clarify explanations
- 🔧 **Submit code** — pick an open issue or start a discussion first for larger changes

### Development workflow

1. **Fork** the repository and clone your fork

   ```bash
   git clone https://github.com/<your-username>/Agent-Orchestrator.git
   cd Agent-Orchestrator
   npm install
   ```

2. **Create a branch** from `main` with a descriptive name

   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/some-bug
   ```

3. **Make your changes**, following the existing clean architecture pattern:
   - Domain logic → `src/domain/`
   - Use cases → `src/application/use-cases/`
   - Infrastructure / external services → `src/infrastructure/`
   - UI components → `src/renderer/components/`

4. **Write or update tests** for anything you add or fix

   ```bash
   npm test
   ```

5. **Lint and format** before committing

   ```bash
   npm run lint
   npm run format
   ```

6. **Commit** using clear, conventional messages
   - `feat: add multi-select import`
   - `fix: resolve device flow 400 error`
   - `docs: update contributing guide`

7. **Push** to your fork and open a **Pull Request** against `main`
   - Describe what the PR does and link any related issues
   - Keep PRs focused — one logical change per PR

### Code style

- TypeScript strict mode is enabled — avoid `any`
- New React components should be function components with named exports
- CSS follows the existing VS Code-inspired variable system (`var(--bg-primary)`, etc.)
- Tests live next to the code they test in `__tests__/` subdirectories

### Reporting security issues

Please **do not** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).

## License

MIT License - see LICENSE file for details

## Author

GuillemPT

## Acknowledgments

- Inspired by VS Code's design philosophy
- Built with Clean Architecture principles
- Designed for modern AI development workflows