import { Skill } from '../../domain/entities/Skill';
import { ISkillRepository } from '../../domain/interfaces/ISkillRepository';

export class InMemorySkillRepository implements ISkillRepository {
  private store = new Map<string, Skill>();

  async findAll(): Promise<Skill[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<Skill | null> {
    return this.store.get(id) ?? null;
  }

  async save(skill: Skill): Promise<void> {
    this.store.set(skill.id, { ...skill });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async exportToSkillMd(skill: Skill): Promise<string> {
    return `# ${skill.metadata.name}\n\n${skill.metadata.description}`;
  }

  async exportToYaml(skill: Skill): Promise<string> {
    return `name: ${skill.metadata.name}\nversion: ${skill.metadata.version}`;
  }

  async createSkillDirectory(_skill: Skill, _basePath: string): Promise<void> {
    // no-op in tests
  }

  async validateDescription(description: string): Promise<{ score: number; suggestions: string[] }> {
    return { score: description.length > 20 ? 80 : 40, suggestions: [] };
  }

  get size() {
    return this.store.size;
  }
}
