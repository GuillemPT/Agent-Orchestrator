import {
  MCPGlobalConfig,
  MCPConfigEntity,
  MCPProjectConfig,
  MCPProjectConfigEntity,
} from '../../domain/entities/MCPConfig';
import { IMCPRepository } from '../../domain/interfaces/IMCPRepository';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSystemMCPRepository implements IMCPRepository {
  private configPath: string;
  private projectsDir: string;

  constructor(baseDir: string) {
    this.configPath = path.join(baseDir, 'mcp.json');
    this.projectsDir = path.join(baseDir, 'mcp-projects');
  }

  // ── Legacy global config ──────────────────────────────────────────────────

  async load(): Promise<MCPGlobalConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const data = JSON.parse(content);
      return MCPConfigEntity.create(data);
    } catch {
      return MCPConfigEntity.create();
    }
  }

  async save(config: MCPGlobalConfig): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async exportToJson(): Promise<string> {
    const config = await this.load();
    return JSON.stringify(config, null, 2);
  }

  // ── Per-project configs ───────────────────────────────────────────────────

  async listProjectConfigs(): Promise<MCPProjectConfig[]> {
    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
      const files = await fs.readdir(this.projectsDir);
      const configs: MCPProjectConfig[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await fs.readFile(path.join(this.projectsDir, file), 'utf-8');
          const data = JSON.parse(raw);
          configs.push(MCPProjectConfigEntity.create(data));
        } catch {
          // Skip malformed files
        }
      }
      return configs.sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return [];
    }
  }

  async saveProjectConfig(config: MCPProjectConfig): Promise<void> {
    await fs.mkdir(this.projectsDir, { recursive: true });
    const filePath = path.join(this.projectsDir, `${config.id}.json`);
    const entity = MCPProjectConfigEntity.create({ ...config, updatedAt: new Date().toISOString() });
    await fs.writeFile(filePath, JSON.stringify(entity, null, 2), 'utf-8');
  }

  async deleteProjectConfig(id: string): Promise<void> {
    const filePath = path.join(this.projectsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if already deleted
    }
  }

  /** Write the serialised config to the project directory in its platform-specific location. */
  async deployProjectConfig(config: MCPProjectConfig): Promise<void> {
    const entity = MCPProjectConfigEntity.create(config);
    const destPath = entity.getConfigFilePath();
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, entity.toExportJson(), 'utf-8');
  }
}
