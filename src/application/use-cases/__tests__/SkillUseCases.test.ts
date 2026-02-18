import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreateSkillUseCase,
  UpdateSkillUseCase,
  DeleteSkillUseCase,
  GetAllSkillsUseCase,
  ExportSkillToMdUseCase,
  ExportSkillToYamlUseCase,
  ValidateSkillDescriptionUseCase,
} from '../SkillUseCases';
import { InMemorySkillRepository } from './helpers/InMemorySkillRepository';

describe('SkillUseCases', () => {
  let repo: InMemorySkillRepository;

  beforeEach(() => {
    repo = new InMemorySkillRepository();
  });

  describe('CreateSkillUseCase', () => {
    it('creates a skill with defaults', async () => {
      const useCase = new CreateSkillUseCase(repo);
      const skill = await useCase.execute({});

      expect(skill.id).toBeTruthy();
      expect(skill.metadata.name).toBe('New Skill');
      expect(skill.scripts).toEqual([]);
      expect(repo.size).toBe(1);
    });

    it('persists provided metadata', async () => {
      const useCase = new CreateSkillUseCase(repo);
      const skill = await useCase.execute({
        metadata: { name: 'My Skill', description: 'Does things', version: '1.0.0', category: 'testing' },
      });
      const stored = await repo.findById(skill.id);
      expect(stored?.metadata.category).toBe('testing');
    });
  });

  describe('GetAllSkillsUseCase', () => {
    it('returns empty array initially', async () => {
      const useCase = new GetAllSkillsUseCase(repo);
      expect(await useCase.execute()).toEqual([]);
    });

    it('returns all skills', async () => {
      const create = new CreateSkillUseCase(repo);
      await create.execute({});
      await create.execute({});
      const getAll = new GetAllSkillsUseCase(repo);
      expect(await getAll.execute()).toHaveLength(2);
    });
  });

  describe('UpdateSkillUseCase', () => {
    it('throws when skill does not exist', async () => {
      const useCase = new UpdateSkillUseCase(repo);
      await expect(useCase.execute('missing', {})).rejects.toThrow('not found');
    });

    it('updates skill correctly', async () => {
      const create = new CreateSkillUseCase(repo);
      const skill = await create.execute({});

      const update = new UpdateSkillUseCase(repo);
      const updated = await update.execute(skill.id, {
        metadata: { ...skill.metadata, name: 'Renamed Skill' },
      });
      expect(updated.metadata.name).toBe('Renamed Skill');
    });
  });

  describe('DeleteSkillUseCase', () => {
    it('removes skill from repository', async () => {
      const create = new CreateSkillUseCase(repo);
      const skill = await create.execute({});

      const del = new DeleteSkillUseCase(repo);
      await del.execute(skill.id);
      expect(repo.size).toBe(0);
    });
  });

  describe('ExportSkillToMdUseCase', () => {
    it('returns markdown with skill name', async () => {
      const create = new CreateSkillUseCase(repo);
      const skill = await create.execute({
        metadata: { name: 'Code Review', description: 'Reviews code', version: '1.0.0' },
      });

      const exportMd = new ExportSkillToMdUseCase(repo);
      const md = await exportMd.execute(skill);
      expect(md).toContain('Code Review');
    });
  });

  describe('ExportSkillToYamlUseCase', () => {
    it('returns a YAML string', async () => {
      const create = new CreateSkillUseCase(repo);
      const skill = await create.execute({});

      const exportYaml = new ExportSkillToYamlUseCase(repo);
      const yaml = await exportYaml.execute(skill);
      expect(typeof yaml).toBe('string');
      expect(yaml).toContain('name:');
    });
  });

  describe('ValidateSkillDescriptionUseCase', () => {
    it('returns lower score for short description', async () => {
      const useCase = new ValidateSkillDescriptionUseCase(repo);
      const result = await useCase.execute('short');
      expect(result.score).toBeLessThan(80);
    });

    it('returns higher score for longer description', async () => {
      const useCase = new ValidateSkillDescriptionUseCase(repo);
      const result = await useCase.execute('This is a longer description that exceeds twenty chars');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });
  });
});
