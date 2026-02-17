import { MCPGlobalConfig, MCPConfigEntity } from '@domain/entities/MCPConfig';
import { IMCPRepository } from '@domain/interfaces/IMCPRepository';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSystemMCPRepository implements IMCPRepository {
  private configPath: string;

  constructor(baseDir: string) {
    this.configPath = path.join(baseDir, 'mcp.json');
  }

  async load(): Promise<MCPGlobalConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const data = JSON.parse(content);
      return MCPConfigEntity.create(data);
    } catch (error) {
      // Return default config if file doesn't exist
      return MCPConfigEntity.create();
    }
  }

  async save(config: MCPGlobalConfig): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving MCP config:', error);
      throw error;
    }
  }

  async exportToJson(): Promise<string> {
    const config = await this.load();
    return JSON.stringify(config, null, 2);
  }
}
