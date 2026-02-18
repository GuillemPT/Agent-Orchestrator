import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileSystemAgentRepository } from '../infrastructure/repositories/FileSystemAgentRepository';
import { FileSystemSkillRepository } from '../infrastructure/repositories/FileSystemSkillRepository';
import { FileSystemMCPRepository } from '../infrastructure/repositories/FileSystemMCPRepository';
import { KeytarSecureStorage } from '../infrastructure/services/KeytarSecureStorage';
import { CopilotSyncService } from '../infrastructure/services/CopilotSyncService';
import { MCPToolsService } from '../infrastructure/services/MCPToolsService';
import { GitService } from '../infrastructure/services/GitService';
import { RepositoryAnalyzerService } from '../infrastructure/services/RepositoryAnalyzerService';
import {
  CreateAgentUseCase,
  UpdateAgentUseCase,
  DeleteAgentUseCase,
  GetAllAgentsUseCase,
  GetAgentByIdUseCase,
  ExportAgentToMdUseCase,
} from '../application/use-cases/AgentUseCases';
import {
  CreateSkillUseCase,
  UpdateSkillUseCase,
  DeleteSkillUseCase,
  GetAllSkillsUseCase,
  ExportSkillToMdUseCase,
  ExportSkillToYamlUseCase,
  CreateSkillDirectoryUseCase,
  ValidateSkillDescriptionUseCase,
} from '../application/use-cases/SkillUseCases';
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
} from '../application/use-cases/MCPUseCases';
import {
  SyncCopilotDirectoriesUseCase,
  DetectChangesUseCase,
} from '../application/use-cases/SyncUseCases';
import { GenerateCopilotInstructionsUseCase, AnalyzeRepositoryUseCase, ValidateGlobPatternUseCase, FindFilesMatchingPatternUseCase } from '../application/use-cases/PatternAnalysisUseCases';
import {
  GetGitStatusUseCase,
  AtomicCommitUseCase,
  CheckGitRepositoryUseCase,
} from '../application/use-cases/GitUseCases';
import {
  SaveGitHubTokenUseCase,
  GetGitHubUserUseCase,
  ClearGitHubTokenUseCase,
  ListGitHubReposUseCase,
  CreatePullRequestUseCase,
  GetMarketplaceGistsUseCase,
  GetGistUseCase,
  PublishGistUseCase,
} from '../application/use-cases/GitHubUseCases';
import { GitHubService } from '../infrastructure/services/GitHubService';
import { GitProviderService } from '../infrastructure/services/GitProviderService';
import {
  GetConnectedAccountsUseCase,
  GetProviderSettingsUseCase,
  SetProviderClientIdUseCase,
  StartDeviceFlowUseCase,
  CompleteDeviceFlowUseCase,
  ConnectWithAppPasswordUseCase,
  DisconnectProviderUseCase,
  ListReposUseCase,
  PushFilesUseCase,
  CreatePRUseCase,
  ListMarketplaceSnippetsUseCase,
  GetSnippetUseCase,
  PublishSnippetUseCase,
} from '../application/use-cases/GitProviderUseCases';
import { PLATFORM_OUTPUT_PATHS } from '../domain/entities/Platform';
import type { Platform } from '../domain/entities/Platform';

let mainWindow: BrowserWindow | null = null;

// Initialize repositories and services
const dataDir = path.join(app.getPath('userData'), 'data');
const agentRepository = new FileSystemAgentRepository(dataDir);
const skillRepository = new FileSystemSkillRepository(dataDir);
const mcpRepository = new FileSystemMCPRepository(dataDir);
const secureStorage = new KeytarSecureStorage();
const syncService = new CopilotSyncService();
const mcpToolsService = new MCPToolsService();
const gitService = new GitService();
const repositoryAnalyzer = new RepositoryAnalyzerService();
const githubService = new GitHubService(secureStorage);
const gitProviderService = new GitProviderService(secureStorage, dataDir);

// Initialize use cases
const createAgentUseCase = new CreateAgentUseCase(agentRepository);
const updateAgentUseCase = new UpdateAgentUseCase(agentRepository);
const deleteAgentUseCase = new DeleteAgentUseCase(agentRepository);
const getAllAgentsUseCase = new GetAllAgentsUseCase(agentRepository);
const getAgentByIdUseCase = new GetAgentByIdUseCase(agentRepository);
const exportAgentToMdUseCase = new ExportAgentToMdUseCase(agentRepository);

const createSkillUseCase = new CreateSkillUseCase(skillRepository);
const updateSkillUseCase = new UpdateSkillUseCase(skillRepository);
const deleteSkillUseCase = new DeleteSkillUseCase(skillRepository);
const getAllSkillsUseCase = new GetAllSkillsUseCase(skillRepository);
const exportSkillToMdUseCase = new ExportSkillToMdUseCase(skillRepository);
const exportSkillToYamlUseCase = new ExportSkillToYamlUseCase(skillRepository);
const createSkillDirectoryUseCase = new CreateSkillDirectoryUseCase(skillRepository);
const validateSkillDescriptionUseCase = new ValidateSkillDescriptionUseCase(skillRepository);

const loadMCPConfigUseCase = new LoadMCPConfigUseCase(mcpRepository);
const saveMCPConfigUseCase = new SaveMCPConfigUseCase(mcpRepository);
const exportMCPConfigUseCase = new ExportMCPConfigUseCase(mcpRepository);
const getAvailableMCPToolsUseCase = new GetAvailableMCPToolsUseCase(mcpToolsService);
const searchMCPToolsUseCase = new SearchMCPToolsUseCase(mcpToolsService);

const getAllMCPProjectsUseCase = new GetAllMCPProjectsUseCase(mcpRepository);
const createMCPProjectUseCase = new CreateMCPProjectUseCase(mcpRepository);
const updateMCPProjectUseCase = new UpdateMCPProjectUseCase(mcpRepository);
const deleteMCPProjectUseCase = new DeleteMCPProjectUseCase(mcpRepository);
const deployMCPProjectUseCase = new DeployMCPProjectUseCase(mcpRepository);

const syncCopilotDirectoriesUseCase = new SyncCopilotDirectoriesUseCase(syncService);
const detectChangesUseCase = new DetectChangesUseCase(syncService);

const generateCopilotInstructionsUseCase = new GenerateCopilotInstructionsUseCase();
const analyzeRepositoryUseCase = new AnalyzeRepositoryUseCase(repositoryAnalyzer);
const validateGlobPatternUseCase = new ValidateGlobPatternUseCase(repositoryAnalyzer);
const findFilesMatchingPatternUseCase = new FindFilesMatchingPatternUseCase(repositoryAnalyzer);

const getGitStatusUseCase = new GetGitStatusUseCase(gitService);
const atomicCommitUseCase = new AtomicCommitUseCase(gitService);
const checkGitRepositoryUseCase = new CheckGitRepositoryUseCase(gitService);

const saveGitHubTokenUseCase = new SaveGitHubTokenUseCase(githubService);
const getGitHubUserUseCase = new GetGitHubUserUseCase(githubService);
const clearGitHubTokenUseCase = new ClearGitHubTokenUseCase(githubService);
const listGitHubReposUseCase = new ListGitHubReposUseCase(githubService);
const createPullRequestUseCase = new CreatePullRequestUseCase(githubService);
const getMarketplaceGistsUseCase = new GetMarketplaceGistsUseCase(githubService);
const getGistUseCase = new GetGistUseCase(githubService);
const publishGistUseCase = new PublishGistUseCase(githubService);

// Multi-provider use cases
const getConnectedAccountsUseCase = new GetConnectedAccountsUseCase(gitProviderService);
const getProviderSettingsUseCase = new GetProviderSettingsUseCase(gitProviderService);
const setProviderClientIdUseCase = new SetProviderClientIdUseCase(gitProviderService);
const startDeviceFlowUseCase = new StartDeviceFlowUseCase(gitProviderService);
const completeDeviceFlowUseCase = new CompleteDeviceFlowUseCase(gitProviderService);
const connectWithAppPasswordUseCase = new ConnectWithAppPasswordUseCase(gitProviderService);
const disconnectProviderUseCase = new DisconnectProviderUseCase(gitProviderService);
const listReposUseCase = new ListReposUseCase(gitProviderService);
const pushFilesUseCase = new PushFilesUseCase(gitProviderService);
const createPRUseCase = new CreatePRUseCase(gitProviderService);
const listMarketplaceSnippetsUseCase = new ListMarketplaceSnippetsUseCase(gitProviderService);
const getSnippetUseCase = new GetSnippetUseCase(gitProviderService);
const publishSnippetUseCase = new PublishSnippetUseCase(gitProviderService);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hidden',
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Agents
ipcMain.handle('agent:create', async (_event, data) => {
  return await createAgentUseCase.execute(data);
});

ipcMain.handle('agent:update', async (_event, id, updates) => {
  return await updateAgentUseCase.execute(id, updates);
});

ipcMain.handle('agent:delete', async (_event, id) => {
  return await deleteAgentUseCase.execute(id);
});

ipcMain.handle('agent:getAll', async () => {
  return await getAllAgentsUseCase.execute();
});

ipcMain.handle('agent:getById', async (_event, id) => {
  return await getAgentByIdUseCase.execute(id);
});

ipcMain.handle('agent:exportToMd', async (_event, agent, platform) => {
  return await exportAgentToMdUseCase.execute(agent, platform);
});

// IPC Handlers for Skills
ipcMain.handle('skill:create', async (_event, data) => {
  return await createSkillUseCase.execute(data);
});

ipcMain.handle('skill:update', async (_event, id, updates) => {
  return await updateSkillUseCase.execute(id, updates);
});

ipcMain.handle('skill:delete', async (_event, id) => {
  return await deleteSkillUseCase.execute(id);
});

ipcMain.handle('skill:getAll', async () => {
  return await getAllSkillsUseCase.execute();
});

ipcMain.handle('skill:exportToMd', async (_event, skill, platform) => {
  return await exportSkillToMdUseCase.execute(skill, platform);
});

ipcMain.handle('skill:exportToYaml', async (_event, skill) => {
  return await exportSkillToYamlUseCase.execute(skill);
});

ipcMain.handle('skill:createDirectory', async (_event, skill, basePath) => {
  return await createSkillDirectoryUseCase.execute(skill, basePath);
});

ipcMain.handle('skill:validateDescription', async (_event, description) => {
  return await validateSkillDescriptionUseCase.execute(description);
});

// IPC Handlers for MCP Config
ipcMain.handle('mcp:load', async () => {
  return await loadMCPConfigUseCase.execute();
});

ipcMain.handle('mcp:save', async (_event, config) => {
  return await saveMCPConfigUseCase.execute(config);
});

ipcMain.handle('mcp:export', async () => {
  return await exportMCPConfigUseCase.execute();
});

ipcMain.handle('mcp:getAvailableTools', async () => {
  return await getAvailableMCPToolsUseCase.execute();
});

ipcMain.handle('mcp:searchTools', async (_event, query) => {
  return await searchMCPToolsUseCase.execute(query);
});

// IPC Handlers for MCP Project Configs
ipcMain.handle('mcp:getAllProjects', async () => {
  return await getAllMCPProjectsUseCase.execute();
});

ipcMain.handle('mcp:createProject', async (_event, data) => {
  return await createMCPProjectUseCase.execute(data);
});

ipcMain.handle('mcp:updateProject', async (_event, id, updates) => {
  return await updateMCPProjectUseCase.execute(id, updates);
});

ipcMain.handle('mcp:deleteProject', async (_event, id) => {
  return await deleteMCPProjectUseCase.execute(id);
});

ipcMain.handle('mcp:deployProject', async (_event, config) => {
  return await deployMCPProjectUseCase.execute(config);
});

// IPC Handlers for Secure Storage
ipcMain.handle('secure:setPassword', async (_event, service, account, password) => {
  return await secureStorage.setPassword(service, account, password);
});

ipcMain.handle('secure:getPassword', async (_event, service, account) => {
  return await secureStorage.getPassword(service, account);
});

ipcMain.handle('secure:deletePassword', async (_event, service, account) => {
  return await secureStorage.deletePassword(service, account);
});

// IPC Handlers for Sync
ipcMain.handle('sync:syncDirectories', async (_event, options) => {
  return await syncCopilotDirectoriesUseCase.execute(options);
});

ipcMain.handle('sync:detectChanges', async () => {
  return await detectChangesUseCase.execute();
});

// IPC Handlers for Pattern Analysis
ipcMain.handle('pattern:generateInstructions', async (_event, agent, patterns) => {
  return await generateCopilotInstructionsUseCase.execute(agent, patterns);
});

ipcMain.handle('pattern:analyzeRepository', async () => {
  return await analyzeRepositoryUseCase.execute();
});

ipcMain.handle('pattern:validateGlobPattern', async (_event, pattern) => {
  return await validateGlobPatternUseCase.execute(pattern);
});

ipcMain.handle('pattern:findFilesMatchingPattern', async (_event, pattern) => {
  return await findFilesMatchingPatternUseCase.execute(pattern);
});

// IPC Handlers for Git Operations
ipcMain.handle('git:getStatus', async () => {
  return await getGitStatusUseCase.execute();
});

ipcMain.handle('git:atomicCommit', async (_event, options) => {
  return await atomicCommitUseCase.execute(options);
});

ipcMain.handle('git:isRepository', async () => {
  return await checkGitRepositoryUseCase.execute();
});

// IPC Handlers for GitHub
ipcMain.handle('github:saveToken', async (_event, token) => {
  return await saveGitHubTokenUseCase.execute(token);
});

ipcMain.handle('github:getUser', async () => {
  return await getGitHubUserUseCase.execute();
});

ipcMain.handle('github:clearToken', async () => {
  return await clearGitHubTokenUseCase.execute();
});

ipcMain.handle('github:listRepos', async () => {
  return await listGitHubReposUseCase.execute();
});

ipcMain.handle('github:createPR', async (_event, options) => {
  return await createPullRequestUseCase.execute(options);
});

ipcMain.handle('github:getMarketplaceGists', async () => {
  return await getMarketplaceGistsUseCase.execute();
});

ipcMain.handle('github:getGist', async (_event, id) => {
  return await getGistUseCase.execute(id);
});

ipcMain.handle('github:publishGist', async (_event, description, files) => {
  return await publishGistUseCase.execute(description, files);
});

ipcMain.handle('github:pushFiles', async (_event, owner, repo, baseBranch, newBranch, files, commitMessage) => {
  await githubService.pushFilesToBranch(owner, repo, baseBranch, newBranch, files, commitMessage);
});

// ── Multi-provider IPC handlers ────────────────────────────────────────────
ipcMain.handle('gitProvider:getConnectedAccounts', async () => {
  return getConnectedAccountsUseCase.execute();
});
ipcMain.handle('gitProvider:getSettings', async () => {
  return getProviderSettingsUseCase.execute();
});
ipcMain.handle('gitProvider:setClientId', async (_event, type, clientId) => {
  return setProviderClientIdUseCase.execute(type, clientId);
});
ipcMain.handle('gitProvider:startDeviceFlow', async (_event, type) => {
  return startDeviceFlowUseCase.execute(type);
});
ipcMain.handle('gitProvider:completeDeviceFlow', async (_event, type, init) => {
  return completeDeviceFlowUseCase.execute(type, init);
});
ipcMain.handle('gitProvider:connectAppPassword', async (_event, type, token, extra) => {
  return connectWithAppPasswordUseCase.execute(type, token, extra);
});
ipcMain.handle('gitProvider:disconnect', async (_event, type) => {
  return disconnectProviderUseCase.execute(type);
});
ipcMain.handle('gitProvider:listRepos', async (_event, type) => {
  return listReposUseCase.execute(type);
});
ipcMain.handle('gitProvider:pushFiles', async (_event, type, owner, repo, baseBranch, newBranch, files, message) => {
  return pushFilesUseCase.execute(type, owner, repo, baseBranch, newBranch, files, message);
});
ipcMain.handle('gitProvider:createPR', async (_event, type, options) => {
  return createPRUseCase.execute(type, options);
});
ipcMain.handle('gitProvider:listMarketplaceSnippets', async (_event, type) => {
  return listMarketplaceSnippetsUseCase.execute(type);
});
ipcMain.handle('gitProvider:getSnippet', async (_event, type, id) => {
  return getSnippetUseCase.execute(type, id);
});
ipcMain.handle('gitProvider:publishSnippet', async (_event, type, description, files, isPublic) => {
  return publishSnippetUseCase.execute(type, description, files, isPublic);
});

// IPC Handlers for Workspace Deploy
ipcMain.handle('workspace:deployAgent', async (_event, agent, platform, projectPath) => {
  const content = await exportAgentToMdUseCase.execute(agent, platform);
  const relPath = (PLATFORM_OUTPUT_PATHS[platform as Platform] || '.github/copilot-instructions.md')
    .replace('{name}', (agent.metadata?.name || 'agent').replace(/\s+/g, '-').toLowerCase());
  const destPath = path.join(projectPath, relPath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, content, 'utf-8');
  return destPath;
});

ipcMain.handle('workspace:deploySkill', async (_event, skill, platform, projectPath) => {
  const content = await exportSkillToMdUseCase.execute(skill, platform);
  const name = (skill.metadata?.name || 'skill').replace(/\s+/g, '-').toLowerCase();
  // Skills always go into a skills/ subdirectory relative to the agent instructions path
  const platformBase: Record<string, string> = {
    'github-copilot': `.github/instructions/${name}.instructions.md`,
    claude: `claude/skills/${name}.md`,
    cursor: `.cursor/rules/${name}.mdc`,
    antigravity: `antigravity.skills.json`,
    opencode: `.opencode/skills/${name}.md`,
  };
  const relPath = platformBase[platform as string] || `.github/instructions/${name}.instructions.md`;
  const destPath = path.join(projectPath, relPath);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, content, 'utf-8');
  return destPath;
});
