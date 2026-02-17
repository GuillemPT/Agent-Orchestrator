import { Agent } from '@domain/entities/Agent';
import { IAgentRepository } from '@domain/interfaces/IAgentRepository';
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

  async exportToAgentMd(agent: Agent): Promise<string> {
    let markdown = `---\n`;
    markdown += `name: ${agent.metadata.name}\n`;
    markdown += `version: ${agent.metadata.version}\n`;
    markdown += `description: ${agent.metadata.description}\n`;
    if (agent.metadata.author) {
      markdown += `author: ${agent.metadata.author}\n`;
    }
    if (agent.metadata.tags && agent.metadata.tags.length > 0) {
      markdown += `tags: ${agent.metadata.tags.join(', ')}\n`;
    }
    markdown += `compatibility: ${agent.metadata.compatibility.join(', ')}\n`;
    markdown += `---\n\n`;

    markdown += `# ${agent.metadata.name}\n\n`;
    markdown += `${agent.metadata.description}\n\n`;

    if (agent.skills.length > 0) {
      markdown += `## Skills\n\n`;
      agent.skills.forEach((skill) => {
        markdown += `### ${skill.name}\n`;
        markdown += `${skill.description}\n\n`;
      });
    }

    if (agent.mcpConfig.tools && agent.mcpConfig.tools.length > 0) {
      markdown += `## MCP Configuration\n\n`;
      markdown += `\`\`\`yaml\n`;
      markdown += `tools:\n`;
      agent.mcpConfig.tools.forEach((tool) => {
        markdown += `  - ${tool}\n`;
      });
      if (agent.mcpConfig.target) {
        markdown += `target: ${agent.mcpConfig.target}\n`;
      }
      markdown += `\`\`\`\n\n`;
    }

    if (agent.instructions) {
      markdown += `## Instructions\n\n`;
      markdown += `${agent.instructions}\n`;
    }

    return markdown;
  }
}
