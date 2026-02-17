import { Skill } from '@domain/entities/Skill';
import { ISkillRepository } from '@domain/interfaces/ISkillRepository';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

export class FileSystemSkillRepository implements ISkillRepository {
  private storageDir: string;

  constructor(baseDir: string) {
    this.storageDir = path.join(baseDir, 'skills');
  }

  async findAll(): Promise<Skill[]> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const files = await fs.readdir(this.storageDir);
      const skills: Skill[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf-8');
          skills.push(JSON.parse(content));
        }
      }

      return skills;
    } catch (error) {
      console.error('Error reading skills:', error);
      return [];
    }
  }

  async findById(id: string): Promise<Skill | null> {
    try {
      const filePath = path.join(this.storageDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async save(skill: Skill): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const filePath = path.join(this.storageDir, `${skill.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(skill, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving skill:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${id}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting skill:', error);
      throw error;
    }
  }

  async exportToSkillMd(skill: Skill): Promise<string> {
    let markdown = `# ${skill.metadata.name}\n\n`;
    markdown += `**Version:** ${skill.metadata.version}\n\n`;
    markdown += `**Description:** ${skill.metadata.description}\n\n`;

    if (skill.metadata.category) {
      markdown += `**Category:** ${skill.metadata.category}\n\n`;
    }

    if (skill.markdown) {
      markdown += skill.markdown;
    }

    if (skill.scripts.length > 0) {
      markdown += `\n## Scripts\n\n`;
      skill.scripts.forEach((script) => {
        markdown += `### ${script.language}\n\n`;
        markdown += `\`\`\`${script.language}\n`;
        markdown += script.content;
        markdown += `\n\`\`\`\n\n`;
      });
    }

    return markdown;
  }

  async exportToYaml(skill: Skill): Promise<string> {
    const yamlData = {
      name: skill.metadata.name,
      version: skill.metadata.version,
      description: skill.metadata.description,
      category: skill.metadata.category,
      scripts: skill.scripts.map((s) => ({
        language: s.language,
        path: s.path,
      })),
    };

    if (skill.yaml?.content) {
      return skill.yaml.content;
    }

    return yaml.stringify(yamlData);
  }
}
