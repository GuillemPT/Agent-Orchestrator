import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreateAgentUseCase,
  UpdateAgentUseCase,
  DeleteAgentUseCase,
  GetAllAgentsUseCase,
  GetAgentByIdUseCase,
  ExportAgentToMdUseCase,
} from '../AgentUseCases';
import { InMemoryAgentRepository } from './helpers/InMemoryAgentRepository';

describe('AgentUseCases', () => {
  let repo: InMemoryAgentRepository;

  beforeEach(() => {
    repo = new InMemoryAgentRepository();
  });

  describe('CreateAgentUseCase', () => {
    it('creates an agent with defaults when no data provided', async () => {
      const useCase = new CreateAgentUseCase(repo);
      const agent = await useCase.execute({});

      expect(agent.id).toBeTruthy();
      expect(agent.metadata.name).toBe('New Agent');
      expect(agent.metadata.version).toBe('1.0.0');
      expect(agent.metadata.compatibility).toContain('github-copilot');
      expect(repo.size).toBe(1);
    });

    it('persists the agent in the repository', async () => {
      const useCase = new CreateAgentUseCase(repo);
      const agent = await useCase.execute({ metadata: { name: 'Test', version: '2.0.0', description: 'test', compatibility: [] } });

      const stored = await repo.findById(agent.id);
      expect(stored?.metadata.name).toBe('Test');
    });

    it('creates unique IDs for different agents', async () => {
      const useCase = new CreateAgentUseCase(repo);
      const a1 = await useCase.execute({});
      const a2 = await useCase.execute({});
      expect(a1.id).not.toBe(a2.id);
    });
  });

  describe('GetAllAgentsUseCase', () => {
    it('returns empty array when no agents exist', async () => {
      const useCase = new GetAllAgentsUseCase(repo);
      const agents = await useCase.execute();
      expect(agents).toEqual([]);
    });

    it('returns all stored agents', async () => {
      const createUseCase = new CreateAgentUseCase(repo);
      await createUseCase.execute({});
      await createUseCase.execute({});

      const getAllUseCase = new GetAllAgentsUseCase(repo);
      const agents = await getAllUseCase.execute();
      expect(agents).toHaveLength(2);
    });
  });

  describe('GetAgentByIdUseCase', () => {
    it('returns null when agent does not exist', async () => {
      const useCase = new GetAgentByIdUseCase(repo);
      const agent = await useCase.execute('nonexistent-id');
      expect(agent).toBeNull();
    });

    it('returns the correct agent by id', async () => {
      const createUseCase = new CreateAgentUseCase(repo);
      const created = await createUseCase.execute({ metadata: { name: 'Find Me', version: '1.0', description: '', compatibility: [] } });

      const getByIdUseCase = new GetAgentByIdUseCase(repo);
      const found = await getByIdUseCase.execute(created.id);
      expect(found?.metadata.name).toBe('Find Me');
    });
  });

  describe('UpdateAgentUseCase', () => {
    it('throws when agent does not exist', async () => {
      const useCase = new UpdateAgentUseCase(repo);
      await expect(useCase.execute('missing', {})).rejects.toThrow('not found');
    });

    it('updates and returns the updated agent', async () => {
      const createUseCase = new CreateAgentUseCase(repo);
      const agent = await createUseCase.execute({});

      const updateUseCase = new UpdateAgentUseCase(repo);
      const updated = await updateUseCase.execute(agent.id, {
        metadata: { ...agent.metadata, name: 'Updated Name' },
      });

      expect(updated.metadata.name).toBe('Updated Name');
      expect(updated.id).toBe(agent.id);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('DeleteAgentUseCase', () => {
    it('removes agent from repository', async () => {
      const createUseCase = new CreateAgentUseCase(repo);
      const agent = await createUseCase.execute({});
      expect(repo.size).toBe(1);

      const deleteUseCase = new DeleteAgentUseCase(repo);
      await deleteUseCase.execute(agent.id);
      expect(repo.size).toBe(0);
    });
  });

  describe('ExportAgentToMdUseCase', () => {
    it('returns a markdown string', async () => {
      const createUseCase = new CreateAgentUseCase(repo);
      const agent = await createUseCase.execute({ metadata: { name: 'Export Me', version: '1.0', description: 'desc', compatibility: [] } });

      const exportUseCase = new ExportAgentToMdUseCase(repo);
      const md = await exportUseCase.execute(agent);
      expect(typeof md).toBe('string');
      expect(md).toContain('Export Me');
    });
  });
});
