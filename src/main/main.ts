import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { FileSystemAgentRepository } from '../infrastructure/repositories/FileSystemAgentRepository';
import { FileSystemSkillRepository } from '../infrastructure/repositories/FileSystemSkillRepository';
import { FileSystemMCPRepository } from '../infrastructure/repositories/FileSystemMCPRepository';
import { KeytarSecureStorage } from '../infrastructure/services/KeytarSecureStorage';
import { CopilotSyncService } from '../infrastructure/services/CopilotSyncService';
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
} from '../application/use-cases/SkillUseCases';
import {
  LoadMCPConfigUseCase,
  SaveMCPConfigUseCase,
  ExportMCPConfigUseCase,
} from '../application/use-cases/MCPUseCases';
import {
  SyncCopilotDirectoriesUseCase,
  DetectChangesUseCase,
} from '../application/use-cases/SyncUseCases';
import { GenerateCopilotInstructionsUseCase } from '../application/use-cases/PatternAnalysisUseCases';

let mainWindow: BrowserWindow | null = null;

// Initialize repositories and services
const dataDir = path.join(app.getPath('userData'), 'data');
const agentRepository = new FileSystemAgentRepository(dataDir);
const skillRepository = new FileSystemSkillRepository(dataDir);
const mcpRepository = new FileSystemMCPRepository(dataDir);
const secureStorage = new KeytarSecureStorage();
const syncService = new CopilotSyncService();

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

const loadMCPConfigUseCase = new LoadMCPConfigUseCase(mcpRepository);
const saveMCPConfigUseCase = new SaveMCPConfigUseCase(mcpRepository);
const exportMCPConfigUseCase = new ExportMCPConfigUseCase(mcpRepository);

const syncCopilotDirectoriesUseCase = new SyncCopilotDirectoriesUseCase(syncService);
const detectChangesUseCase = new DetectChangesUseCase(syncService);

const generateCopilotInstructionsUseCase = new GenerateCopilotInstructionsUseCase();

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

ipcMain.handle('agent:exportToMd', async (_event, agent) => {
  return await exportAgentToMdUseCase.execute(agent);
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

ipcMain.handle('skill:exportToMd', async (_event, skill) => {
  return await exportSkillToMdUseCase.execute(skill);
});

ipcMain.handle('skill:exportToYaml', async (_event, skill) => {
  return await exportSkillToYamlUseCase.execute(skill);
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
