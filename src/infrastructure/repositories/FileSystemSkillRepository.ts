import { Skill } from '../../domain/entities/Skill';
import { Platform } from '../../domain/entities/Platform';
import { ISkillRepository } from '../../domain/interfaces/ISkillRepository';
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

  async exportToSkillMd(skill: Skill, platform: Platform = 'github-copilot'): Promise<string> {
    switch (platform) {
      case 'cursor':
        return this.exportSkillForCursor(skill);
      case 'claude':
      case 'opencode':
        return this.exportSkillPlainMarkdown(skill);
      case 'antigravity':
        return this.exportSkillForAntigravity(skill);
      case 'github-copilot':
      default:
        return this.exportSkillForCopilot(skill);
    }
  }

  private exportSkillForCopilot(skill: Skill): string {
    let markdown = '---\n';
    markdown += `name: ${skill.metadata.name}\n`;
    markdown += `version: ${skill.metadata.version}\n`;
    markdown += `description: ${skill.metadata.description}\n`;
    if (skill.metadata.category) markdown += `category: ${skill.metadata.category}\n`;
    markdown += `created: ${skill.createdAt}\n`;
    markdown += `updated: ${skill.updatedAt}\n`;
    markdown += '---\n\n';
    markdown += `# ${skill.metadata.name}\n\n`;
    markdown += `**Version:** ${skill.metadata.version}\n\n`;
    markdown += `**Description:** ${skill.metadata.description}\n\n`;
    if (skill.metadata.category) markdown += `**Category:** ${skill.metadata.category}\n\n`;
    if (skill.markdown) markdown += skill.markdown;
    if (skill.scripts.length > 0) {
      markdown += `\n## Scripts\n\n`;
      skill.scripts.forEach(script => {
        markdown += `### ${script.language}\n\n\`\`\`${script.language}\n${script.content}\n\`\`\`\n\n`;
      });
    }
    return markdown;
  }

  private exportSkillPlainMarkdown(skill: Skill): string {
    let md = `# ${skill.metadata.name}\n\n`;
    md += `> ${skill.metadata.description}\n\n`;
    if (skill.metadata.category) md += `**Category:** ${skill.metadata.category}  \n`;
    md += `**Version:** ${skill.metadata.version}\n\n`;
    if (skill.markdown) md += skill.markdown + '\n\n';
    if (skill.scripts.length > 0) {
      md += `## Scripts\n\n`;
      skill.scripts.forEach(s => { md += `\`\`\`${s.language}\n${s.content}\n\`\`\`\n\n`; });
    }
    return md;
  }

  private exportSkillForCursor(skill: Skill): string {
    let mdc = `---\ndescription: ${skill.metadata.description}\nglobs:\nalwaysApply: false\n---\n\n`;
    mdc += `# ${skill.metadata.name}\n\n`;
    if (skill.markdown) mdc += skill.markdown + '\n\n';
    if (skill.scripts.length > 0) {
      mdc += `## Scripts\n\n`;
      skill.scripts.forEach(s => { mdc += `\`\`\`${s.language}\n${s.content}\n\`\`\`\n\n`; });
    }
    return mdc;
  }

  private exportSkillForAntigravity(skill: Skill): string {
    return JSON.stringify({
      name: skill.metadata.name,
      version: skill.metadata.version,
      description: skill.metadata.description,
      category: skill.metadata.category,
      scripts: skill.scripts.map(s => ({ language: s.language, path: s.path })),
    }, null, 2);
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

  async createSkillDirectory(skill: Skill, basePath: string): Promise<void> {
    try {
      const skillDir = path.join(basePath, skill.metadata.name.toLowerCase().replace(/\s+/g, '-'));
      
      // Create main skill directory
      await fs.mkdir(skillDir, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'assets'), { recursive: true });
      
      // Generate and save SKILL.md with YAML frontmatter
      const skillMd = await this.exportToSkillMd(skill);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd, 'utf-8');
      
      // Save scripts to scripts directory
      for (const script of skill.scripts) {
        const scriptPath = script.path || `script-${skill.scripts.indexOf(script)}.${this.getScriptExtension(script.language)}`;
        await fs.writeFile(
          path.join(skillDir, 'scripts', scriptPath),
          script.content,
          'utf-8'
        );
      }
      
      // Create README in references
      await fs.writeFile(
        path.join(skillDir, 'references', 'README.md'),
        '# References\n\nAdd reference documentation and materials here.\n',
        'utf-8'
      );
      
    } catch (error) {
      console.error('Error creating skill directory:', error);
      throw error;
    }
  }

  private getScriptExtension(language: string): string {
    const extensions: Record<string, string> = {
      bash: 'sh',
      python: 'py',
      javascript: 'js',
      typescript: 'ts',
      powershell: 'ps1',
    };
    return extensions[language.toLowerCase()] || 'txt';
  }

  async validateDescription(description: string): Promise<{ score: number; suggestions: string[] }> {
    // Basic validation - could be enhanced with LLM call
    const suggestions: string[] = [];
    let score = 100;

    // Check length
    if (description.length < 20) {
      score -= 30;
      suggestions.push('Description is too short. Provide more detail (minimum 20 characters).');
    }

    if (description.length > 200) {
      score -= 10;
      suggestions.push('Description is quite long. Consider being more concise.');
    }

    // Check for specific keywords that improve discoverability
    const keywords = ['create', 'manage', 'analyze', 'automate', 'test', 'deploy', 'configure'];
    const hasActionVerb = keywords.some(keyword => description.toLowerCase().includes(keyword));
    
    if (!hasActionVerb) {
      score -= 20;
      suggestions.push('Consider starting with an action verb (e.g., create, manage, analyze) to improve clarity.');
    }

    // Check for technical terms
    if (!/[A-Z]{2,}/.test(description) && !/\b(API|SDK|CLI|UI|UX)\b/.test(description)) {
      score -= 10;
      suggestions.push('Consider including relevant technical terms or acronyms for better discoverability.');
    }

    return {
      score: Math.max(0, score),
      suggestions,
    };
  }
}
