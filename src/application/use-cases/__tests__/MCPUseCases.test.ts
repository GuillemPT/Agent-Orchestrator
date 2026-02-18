import { describe, it, expect, beforeEach } from 'vitest';
import {
  LoadMCPConfigUseCase,
  SaveMCPConfigUseCase,
  ExportMCPConfigUseCase,
  GetAvailableMCPToolsUseCase,
  SearchMCPToolsUseCase,
  GetAllMCPProjectsUseCase,
  CreateMCPProjectUseCase,
  UpdateMCPProjectUseCase,
  DeleteMCPProjectUseCase,
  DeployMCPProjectUseCase,
} from '../MCPUseCases';
import { InMemoryMCPRepository } from './helpers/InMemoryMCPRepository';
import { MCPToolsService } from '../../../infrastructure/services/MCPToolsService';

describe('MCPUseCases', () => {
  let repo: InMemoryMCPRepository;
  let toolsService: MCPToolsService;

  beforeEach(() => {
    repo = new InMemoryMCPRepository();
    toolsService = new MCPToolsService();
  });

  // ── Legacy global config ────────────────────────────────────────────────

  describe('LoadMCPConfigUseCase', () => {
    it('returns default empty config initially', async () => {
      const useCase = new LoadMCPConfigUseCase(repo);
      const config = await useCase.execute();
      expect(config.mcpServers).toEqual({});
    });
  });

  describe('SaveMCPConfigUseCase', () => {
    it('persists config changes', async () => {
      const save = new SaveMCPConfigUseCase(repo);
      await save.execute({
        mcpServers: { myserver: { command: 'node', args: ['server.js'] } },
      });

      const load = new LoadMCPConfigUseCase(repo);
      const loaded = await load.execute();
      expect(loaded.mcpServers['myserver'].command).toBe('node');
    });

    it('overwrites previous config on second save', async () => {
      const save = new SaveMCPConfigUseCase(repo);
      await save.execute({ mcpServers: { a: { command: 'cmd-a' } } });
      await save.execute({ mcpServers: { b: { command: 'cmd-b' } } });

      const load = new LoadMCPConfigUseCase(repo);
      const config = await load.execute();
      expect(config.mcpServers['a']).toBeUndefined();
      expect(config.mcpServers['b'].command).toBe('cmd-b');
    });
  });

  describe('ExportMCPConfigUseCase', () => {
    it('returns valid JSON string', async () => {
      const save = new SaveMCPConfigUseCase(repo);
      await save.execute({ mcpServers: { myserver: { command: 'node' } } });

      const exportUseCase = new ExportMCPConfigUseCase(repo);
      const json = await exportUseCase.execute();
      const parsed = JSON.parse(json);
      expect(parsed.mcpServers.myserver.command).toBe('node');
    });
  });

  // ── Tool discovery ──────────────────────────────────────────────────────

  describe('GetAvailableMCPToolsUseCase', () => {
    it('returns tools list', async () => {
      const useCase = new GetAvailableMCPToolsUseCase(toolsService);
      const tools = await useCase.execute();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('description');
    });
  });

  describe('SearchMCPToolsUseCase', () => {
    it('returns matching tools for a known name', async () => {
      const useCase = new SearchMCPToolsUseCase(toolsService);
      const results = await useCase.execute('git');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name === 'git')).toBe(true);
    });

    it('returns empty array for unknown query', async () => {
      const useCase = new SearchMCPToolsUseCase(toolsService);
      const results = await useCase.execute('xyzunknowntool999');
      expect(results).toEqual([]);
    });
  });

  // ── Per-project configs ─────────────────────────────────────────────────

  describe('CreateMCPProjectUseCase', () => {
    it('creates a project with generated id', async () => {
      const useCase = new CreateMCPProjectUseCase(repo);
      const project = await useCase.execute({ label: 'Test Project', platform: 'claude' });
      expect(project.id).toBeTruthy();
      expect(project.label).toBe('Test Project');
      expect(project.platform).toBe('claude');
    });

    it('stores the project so GetAll returns it', async () => {
      const create = new CreateMCPProjectUseCase(repo);
      await create.execute({ label: 'Alpha' });
      await create.execute({ label: 'Beta' });

      const getAll = new GetAllMCPProjectsUseCase(repo);
      const all = await getAll.execute();
      expect(all).toHaveLength(2);
    });
  });

  describe('UpdateMCPProjectUseCase', () => {
    it('updates mutable fields', async () => {
      const create = new CreateMCPProjectUseCase(repo);
      const project = await create.execute({ label: 'Old Name' });

      const update = new UpdateMCPProjectUseCase(repo);
      const updated = await update.execute(project.id, {
        label: 'New Name',
        mcpServers: { srv: { command: 'npx', args: ['mcp-server'] } },
      });

      expect(updated.label).toBe('New Name');
      expect(updated.mcpServers['srv'].command).toBe('npx');
      expect(updated.id).toBe(project.id);
    });

    it('throws when project not found', async () => {
      const update = new UpdateMCPProjectUseCase(repo);
      await expect(update.execute('nonexistent', { label: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('DeleteMCPProjectUseCase', () => {
    it('removes the project from storage', async () => {
      const create = new CreateMCPProjectUseCase(repo);
      const project = await create.execute({ label: 'ToDelete' });

      const del = new DeleteMCPProjectUseCase(repo);
      await del.execute(project.id);

      const getAll = new GetAllMCPProjectsUseCase(repo);
      const all = await getAll.execute();
      expect(all).toHaveLength(0);
    });
  });

  describe('DeployMCPProjectUseCase', () => {
    it('returns the config file path for the platform', async () => {
      const create = new CreateMCPProjectUseCase(repo);
      const project = await create.execute({
        label: 'Deploy Test',
        projectPath: '/home/user/myproject',
        platform: 'cursor',
      });

      const deploy = new DeployMCPProjectUseCase(repo);
      const dest = await deploy.execute(project);
      expect(dest).toBe('/home/user/myproject/.cursor/mcp.json');
    });

    it('returns .vscode/mcp.json for github-copilot', async () => {
      const create = new CreateMCPProjectUseCase(repo);
      const project = await create.execute({
        label: 'Copilot Project',
        projectPath: '/workspace',
        platform: 'github-copilot',
      });

      const deploy = new DeployMCPProjectUseCase(repo);
      const dest = await deploy.execute(project);
      expect(dest).toBe('/workspace/.vscode/mcp.json');
    });
  });
});


describe('MCPUseCases', () => {
  let repo: InMemoryMCPRepository;
  let toolsService: MCPToolsService;

  beforeEach(() => {
    repo = new InMemoryMCPRepository();
    toolsService = new MCPToolsService();
  });

  describe('LoadMCPConfigUseCase', () => {
    it('returns default empty config initially', async () => {
      const useCase = new LoadMCPConfigUseCase(repo);
      const config = await useCase.execute();
      expect(config.mcpServers).toEqual({});
    });
  });

  describe('SaveMCPConfigUseCase', () => {
    it('persists config changes', async () => {
      const save = new SaveMCPConfigUseCase(repo);
      await save.execute({
        mcpServers: { myserver: { command: 'node', args: ['server.js'] } },
      });

      const load = new LoadMCPConfigUseCase(repo);
      const loaded = await load.execute();
      expect(loaded.mcpServers['myserver'].command).toBe('node');
    });

    it('overwrites previous config on second save', async () => {
      const save = new SaveMCPConfigUseCase(repo);
      await save.execute({ mcpServers: { a: { command: 'cmd-a' } } });
      await save.execute({ mcpServers: { b: { command: 'cmd-b' } } });

      const load = new LoadMCPConfigUseCase(repo);
      const config = await load.execute();
      expect(config.mcpServers['a']).toBeUndefined();
      expect(config.mcpServers['b'].command).toBe('cmd-b');
    });
  });

  describe('ExportMCPConfigUseCase', () => {
    it('returns valid JSON string', async () => {
      const save = new SaveMCPConfigUseCase(repo);
      await save.execute({ mcpServers: { myserver: { command: 'node' } } });

      const exportUseCase = new ExportMCPConfigUseCase(repo);
      const json = await exportUseCase.execute();
      const parsed = JSON.parse(json);
      expect(parsed.mcpServers.myserver.command).toBe('node');
    });
  });

  describe('GetAvailableMCPToolsUseCase', () => {
    it('returns tools list', async () => {
      const useCase = new GetAvailableMCPToolsUseCase(toolsService);
      const tools = await useCase.execute();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('description');
    });
  });

  describe('SearchMCPToolsUseCase', () => {
    it('returns matching tools for a known name', async () => {
      const useCase = new SearchMCPToolsUseCase(toolsService);
      const results = await useCase.execute('git');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name === 'git')).toBe(true);
    });

    it('returns empty array for unknown query', async () => {
      const useCase = new SearchMCPToolsUseCase(toolsService);
      const results = await useCase.execute('xyzunknowntool999');
      expect(results).toEqual([]);
    });
  });
});
