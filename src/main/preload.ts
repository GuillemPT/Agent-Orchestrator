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
    exportToMd: (agent: any, platform?: string) => ipcRenderer.invoke('agent:exportToMd', agent, platform),
  },

  // Skill operations
  skill: {
    create: (data: any) => ipcRenderer.invoke('skill:create', data),
    update: (id: string, updates: any) => ipcRenderer.invoke('skill:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('skill:delete', id),
    getAll: () => ipcRenderer.invoke('skill:getAll'),
    exportToMd: (skill: any, platform?: string) => ipcRenderer.invoke('skill:exportToMd', skill, platform),
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
    getAllProjects: () => ipcRenderer.invoke('mcp:getAllProjects'),
    createProject: (data: any) => ipcRenderer.invoke('mcp:createProject', data),
    updateProject: (id: string, updates: any) => ipcRenderer.invoke('mcp:updateProject', id, updates),
    deleteProject: (id: string) => ipcRenderer.invoke('mcp:deleteProject', id),
    deployProject: (config: any) => ipcRenderer.invoke('mcp:deployProject', config),
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

  // GitHub operations
  github: {
    saveToken: (token: string) => ipcRenderer.invoke('github:saveToken', token),
    getUser: () => ipcRenderer.invoke('github:getUser'),
    clearToken: () => ipcRenderer.invoke('github:clearToken'),
    listRepos: () => ipcRenderer.invoke('github:listRepos'),
    createPR: (options: any) => ipcRenderer.invoke('github:createPR', options),
    getMarketplaceGists: () => ipcRenderer.invoke('github:getMarketplaceGists'),
    getGist: (id: string) => ipcRenderer.invoke('github:getGist', id),
    publishGist: (description: string, files: any[]) => ipcRenderer.invoke('github:publishGist', description, files),
    pushFiles: (owner: string, repo: string, baseBranch: string, newBranch: string, files: any[], commitMessage: string) =>
      ipcRenderer.invoke('github:pushFiles', owner, repo, baseBranch, newBranch, files, commitMessage),
  },

  // Multi-provider Git operations
  gitProvider: {
    getConnectedAccounts: () => ipcRenderer.invoke('gitProvider:getConnectedAccounts'),
    getSettings: () => ipcRenderer.invoke('gitProvider:getSettings'),
    setClientId: (type: string, clientId: string) => ipcRenderer.invoke('gitProvider:setClientId', type, clientId),
    startDeviceFlow: (type: string) => ipcRenderer.invoke('gitProvider:startDeviceFlow', type),
    completeDeviceFlow: (type: string, init: any) => ipcRenderer.invoke('gitProvider:completeDeviceFlow', type, init),
    connectAppPassword: (type: string, token: string, extra?: any) => ipcRenderer.invoke('gitProvider:connectAppPassword', type, token, extra),
    disconnect: (type: string) => ipcRenderer.invoke('gitProvider:disconnect', type),
    listRepos: (type: string) => ipcRenderer.invoke('gitProvider:listRepos', type),
    pushFiles: (type: string, owner: string, repo: string, baseBranch: string, newBranch: string, files: any[], message: string) =>
      ipcRenderer.invoke('gitProvider:pushFiles', type, owner, repo, baseBranch, newBranch, files, message),
    createPR: (type: string, options: any) => ipcRenderer.invoke('gitProvider:createPR', type, options),
    listMarketplaceSnippets: (type: string) => ipcRenderer.invoke('gitProvider:listMarketplaceSnippets', type),
    getSnippet: (type: string, id: string) => ipcRenderer.invoke('gitProvider:getSnippet', type, id),
    publishSnippet: (type: string, description: string, files: any[], isPublic: boolean) =>
      ipcRenderer.invoke('gitProvider:publishSnippet', type, description, files, isPublic),
  },

  // Workspace deploy operations
  workspace: {
    deployAgent: (agent: any, platform: string, projectPath: string) =>
      ipcRenderer.invoke('workspace:deployAgent', agent, platform, projectPath),
    deploySkill: (skill: any, platform: string, projectPath: string) =>
      ipcRenderer.invoke('workspace:deploySkill', skill, platform, projectPath),
  },
});
