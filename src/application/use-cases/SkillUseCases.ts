import { Skill, SkillEntity } from '@domain/entities/Skill';
import { ISkillRepository } from '@domain/interfaces/ISkillRepository';

export class CreateSkillUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(data: Partial<Skill>): Promise<Skill> {
    const skill = SkillEntity.create(data);
    await this.skillRepository.save(skill);
    return skill;
  }
}

export class UpdateSkillUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(id: string, updates: Partial<Skill>): Promise<Skill> {
    const skill = await this.skillRepository.findById(id);
    if (!skill) {
      throw new Error(`Skill with id ${id} not found`);
    }

    const updatedSkill = { ...skill, ...updates, updatedAt: new Date() };
    await this.skillRepository.save(updatedSkill);
    return updatedSkill;
  }
}

export class DeleteSkillUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(id: string): Promise<void> {
    await this.skillRepository.delete(id);
  }
}

export class GetAllSkillsUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(): Promise<Skill[]> {
    return await this.skillRepository.findAll();
  }
}

export class ExportSkillToMdUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(skill: Skill): Promise<string> {
    return await this.skillRepository.exportToSkillMd(skill);
  }
}

export class ExportSkillToYamlUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(skill: Skill): Promise<string> {
    return await this.skillRepository.exportToYaml(skill);
  }
}

export class CreateSkillDirectoryUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(skill: Skill, basePath: string): Promise<void> {
    return await this.skillRepository.createSkillDirectory(skill, basePath);
  }
}

export class ValidateSkillDescriptionUseCase {
  constructor(private skillRepository: ISkillRepository) {}

  async execute(description: string): Promise<{ score: number; suggestions: string[] }> {
    return await this.skillRepository.validateDescription(description);
  }
}
