import { Skill } from '../entities/Skill';

export interface ISkillRepository {
  findAll(): Promise<Skill[]>;
  findById(id: string): Promise<Skill | null>;
  save(skill: Skill): Promise<void>;
  delete(id: string): Promise<void>;
  exportToSkillMd(skill: Skill): Promise<string>;
  exportToYaml(skill: Skill): Promise<string>;
  createSkillDirectory(skill: Skill, basePath: string): Promise<void>;
  validateDescription(description: string): Promise<{ score: number; suggestions: string[] }>;
}
