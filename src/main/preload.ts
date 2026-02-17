import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Agent operations
  agent: {
    create: (data: any) => ipcRenderer.invoke('agent:create', data),
    update: (id: string, updates: any) => ipcRenderer.invoke('agent:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('agent:delete', id),
    getAll: () => ipcRenderer.invoke('agent:getAll'),
    getById: (id: string) => ipcRenderer.invoke('agent:getById', id),
    exportToMd: (agent: any) => ipcRenderer.invoke('agent:exportToMd', agent),
  },

  // Skill operations
  skill: {
    create: (data: any) => ipcRenderer.invoke('skill:create', data),
    update: (id: string, updates: any) => ipcRenderer.invoke('skill:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('skill:delete', id),
    getAll: () => ipcRenderer.invoke('skill:getAll'),
    exportToMd: (skill: any) => ipcRenderer.invoke('skill:exportToMd', skill),
    exportToYaml: (skill: any) => ipcRenderer.invoke('skill:exportToYaml', skill),
    createDirectory: (skill: any, basePath: string) => ipcRenderer.invoke('skill:createDirectory', skill, basePath),
    validateDescription: (description: string) => ipcRenderer.invoke('skill:validateDescription', description),
  },

  // MCP Config operations
  mcp: {
    load: () => ipcRenderer.invoke('mcp:load'),
    save: (config: any) => ipcRenderer.invoke('mcp:save', config),
    export: () => ipcRenderer.invoke('mcp:export'),
    getAvailableTools: () => ipcRenderer.invoke('mcp:getAvailableTools'),
    searchTools: (query: string) => ipcRenderer.invoke('mcp:searchTools', query),
  },

  // Secure storage operations
  secure: {
    setPassword: (service: string, account: string, password: string) =>
      ipcRenderer.invoke('secure:setPassword', service, account, password),
    getPassword: (service: string, account: string) =>
      ipcRenderer.invoke('secure:getPassword', service, account),
    deletePassword: (service: string, account: string) =>
      ipcRenderer.invoke('secure:deletePassword', service, account),
  },

  // Sync operations
  sync: {
    syncDirectories: (options: any) => ipcRenderer.invoke('sync:syncDirectories', options),
    detectChanges: () => ipcRenderer.invoke('sync:detectChanges'),
  },

  // Pattern analysis operations
  pattern: {
    generateInstructions: (agent: any, patterns?: string[]) =>
      ipcRenderer.invoke('pattern:generateInstructions', agent, patterns),
    analyzeRepository: () => ipcRenderer.invoke('pattern:analyzeRepository'),
    validateGlobPattern: (pattern: string) => ipcRenderer.invoke('pattern:validateGlobPattern', pattern),
    findFilesMatchingPattern: (pattern: string) => ipcRenderer.invoke('pattern:findFilesMatchingPattern', pattern),
  },

  // Git operations
  git: {
    getStatus: () => ipcRenderer.invoke('git:getStatus'),
    atomicCommit: (options: any) => ipcRenderer.invoke('git:atomicCommit', options),
    isRepository: () => ipcRenderer.invoke('git:isRepository'),
  },
});
