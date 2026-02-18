import { Agent } from '../../domain/entities/Agent';
import { Platform } from '../../domain/entities/Platform';
import { IAgentRepository } from '../../domain/interfaces/IAgentRepository';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSystemAgentRepository implements IAgentRepository {
  private storageDir: string;

  constructor(baseDir: string) {
    this.storageDir = path.join(baseDir, 'agents');
  }

  async findAll(): Promise<Agent[]> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const files = await fs.readdir(this.storageDir);
      const agents: Agent[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf-8');
          agents.push(JSON.parse(content));
        }
      }

      return agents;
    } catch (error) {
      console.error('Error reading agents:', error);
      return [];
    }
  }

  async findById(id: string): Promise<Agent | null> {
    try {
      const filePath = path.join(this.storageDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async save(agent: Agent): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const filePath = path.join(this.storageDir, `${agent.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(agent, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving agent:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${id}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  async exportToAgentMd(agent: Agent, platform: Platform = 'github-copilot'): Promise<string> {
    switch (platform) {
      case 'claude':
        return this.exportForClaude(agent);
      case 'cursor':
        return this.exportForCursor(agent);
      case 'antigravity':
        return this.exportForAntigravity(agent);
      case 'opencode':
        return this.exportForOpenCode(agent);
      case 'github-copilot':
      default:
        return this.exportForCopilot(agent);
    }
  }

  /** GitHub Copilot — YAML frontmatter + markdown for .github/copilot-instructions.md */
  private exportForCopilot(agent: Agent): string {
    let markdown = `---\n`;
    markdown += `name: ${agent.metadata.name}\n`;
    markdown += `version: ${agent.metadata.version}\n`;
    markdown += `description: ${agent.metadata.description}\n`;
    if (agent.metadata.author) markdown += `author: ${agent.metadata.author}\n`;
    if (agent.metadata.tags?.length) markdown += `tags: [${agent.metadata.tags.join(', ')}]\n`;
    markdown += `---\n\n`;
    markdown += `# ${agent.metadata.name}\n\n`;
    markdown += `${agent.metadata.description}\n\n`;
    if (agent.skills.length > 0) {
      markdown += `## Skills\n\n`;
      agent.skills.forEach(skill => {
        markdown += `### ${skill.name}\n${skill.description}\n\n`;
      });
    }
    if (agent.mcpConfig.tools?.length) {
      markdown += `## MCP Tools\n\n`;
      agent.mcpConfig.tools.forEach(t => { markdown += `- ${t}\n`; });
      markdown += '\n';
    }
    if (agent.instructions) markdown += `## Instructions\n\n${agent.instructions}\n`;
    return markdown;
  }

  /** Claude — plain markdown for CLAUDE.md (no YAML frontmatter) */
  private exportForClaude(agent: Agent): string {
    let md = `# ${agent.metadata.name}\n\n`;
    md += `> ${agent.metadata.description}\n\n`;
    if (agent.metadata.author) md += `**Author:** ${agent.metadata.author}  \n`;
    md += `**Version:** ${agent.metadata.version}\n\n`;
    if (agent.skills.length > 0) {
      md += `## Skills\n\n`;
      agent.skills.forEach(s => { md += `- **${s.name}**: ${s.description}\n`; });
      md += '\n';
    }
    if (agent.mcpConfig.tools?.length) {
      md += `## Available MCP Tools\n\n`;
      agent.mcpConfig.tools.forEach(t => { md += `- \`${t}\`\n`; });
      md += '\n';
    }
    if (agent.instructions) md += `## Instructions\n\n${agent.instructions}\n`;
    return md;
  }

  /** Cursor — .mdc format with alwaysApply + globs frontmatter */
  private exportForCursor(agent: Agent): string {
    // .mdc frontmatter
    let mdc = `---\ndescription: ${agent.metadata.description}\nglobs:\nalwaysApply: false\n---\n\n`;
    mdc += `# ${agent.metadata.name}\n\n`;
    mdc += `${agent.metadata.description}\n\n`;
    if (agent.skills.length > 0) {
      mdc += `## Skills\n\n`;
      agent.skills.forEach(s => { mdc += `- **${s.name}**: ${s.description}\n`; });
      mdc += '\n';
    }
    if (agent.instructions) mdc += `## Instructions\n\n${agent.instructions}\n`;
    return mdc;
  }

  /** Antigravity — JSON config format */
  private exportForAntigravity(agent: Agent): string {
    const config = {
      name: agent.metadata.name,
      version: agent.metadata.version,
      description: agent.metadata.description,
      author: agent.metadata.author,
      tags: agent.metadata.tags || [],
      skills: agent.skills.map(s => ({ id: s.id, name: s.name, description: s.description })),
      mcpTools: agent.mcpConfig.tools || [],
      instructions: agent.instructions || '',
    };
    return JSON.stringify(config, null, 2);
  }

  /** OpenCode — markdown for .opencode/instructions.md */
  private exportForOpenCode(agent: Agent): string {
    let md = `# ${agent.metadata.name}\n\n`;
    md += `${agent.metadata.description}\n\n`;
    if (agent.skills.length > 0) {
      md += `## Skills\n\n`;
      agent.skills.forEach(s => { md += `### ${s.name}\n\n${s.description}\n\n`; });
    }
    if (agent.instructions) md += `## Instructions\n\n${agent.instructions}\n`;
    return md;
  }
}
