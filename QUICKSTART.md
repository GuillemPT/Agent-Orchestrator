# Quick Start Guide

Get up and running with Agent Orchestrator in 5 minutes!

## Installation

```bash
# Clone the repository
git clone https://github.com/GuillemPT/Agent-Orchestrator.git

# Navigate to the directory
cd Agent-Orchestrator

# Install dependencies
npm install

# Start the application
npm run dev
```

The application will launch in development mode with hot-reloading enabled.

## First Steps

### 1. Create Your First Agent

1. Click on the **Agents** tab in the sidebar
2. Click the **+ New Agent** button
3. Fill in the agent details:
   - **Name**: My First Agent
   - **Version**: 1.0.0
   - **Description**: A test agent for learning
   - **Author**: Your name

4. Click **Save**

### 2. Add MCP Configuration

1. Navigate to the **MCP Config** tab
2. Click **+ Add Server**
3. Name it "filesystem"
4. Configure:
   - **Command**: `npx`
   - **Arguments**: Add `-y`, `@modelcontextprotocol/server-filesystem`
   - **Environment**: Add any needed env vars

5. Click **Save**

### 3. Create a Skill

1. Go to the **Skills** tab
2. Click **+ New Skill**
3. Follow the wizard:
   - **Step 1 - Metadata**: Add name, version, description
   - **Step 2 - Markdown**: Add documentation
   - **Step 3 - YAML**: Add configuration (optional)
   - **Step 4 - Scripts**: Add executable scripts

4. Click **Save** and **Export .md** or **Export .yaml**

### 4. Generate Copilot Instructions

1. Navigate to **Pattern Analysis**
2. Select an agent from the dropdown
3. (Optional) Add codebase patterns
4. Click **🔍 Analyze & Generate**
5. Review the generated instructions
6. Click **💾 Export** to save as `copilot-instructions.md`

### 5. Sync Directories

1. Go to the **Sync** tab
2. Choose sync direction (e.g., Bidirectional)
3. Select conflict resolution strategy
4. Click **🔄 Sync Now**

## Next Steps

- Explore the **examples/** folder for pre-built agents and skills
- Read the [README.md](README.md) for detailed feature documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system design
- See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to contribute

## Tips

- **Keyboard Shortcuts**: Coming soon!
- **Dark Theme**: The app uses a VS Code-inspired dark theme by default
- **Data Storage**: Your data is stored in the app's user data directory
- **Export/Import**: Export agents and skills as markdown for sharing

## Troubleshooting

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Application Won't Start

```bash
# Check Node.js version (must be 18+)
node --version

# Rebuild dependencies
npm run build
npm start
```

### Keyring Issues (Credentials)

If the secure credential storage isn't working, the app will fall back to in-memory storage (insecure). This is expected on systems without keyring support.

## Getting Help

- Check existing [GitHub Issues](https://github.com/GuillemPT/Agent-Orchestrator/issues)
- Create a new issue with details about your problem
- Include your OS, Node.js version, and error messages

## What's Next?

Congratulations! You now have a working Agent Orchestrator setup. Start creating agents and skills to supercharge your AI development workflow!

Happy orchestrating! 🤖✨
