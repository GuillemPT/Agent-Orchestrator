export interface ValidationResult {
  score: number;
  suggestions: string[];
}

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface MCPToolItem {
  name: string;
  description: string;
  category?: string;
  enabled: boolean;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPProjectConfig {
  id: string;
  label: string;
  projectPath: string;
  platform: string;
  mcpServers: Record<string, MCPServerConfig>;
  tools?: { name: string; enabled: boolean }[];
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryAnalysis {
  languages: Record<string, number>;
  frameworks: string[];
  patterns: string[];
  suggestedInstructions: string;
}

export interface GeneratedInstructions {
  content: string;
  patterns: string[];
  recommendations: string[];
}

export interface SyncOptions {
  direction: 'toGithub' | 'toHome' | 'bidirectional';
  conflictResolution: 'newer' | 'github' | 'home' | 'manual';
  specificPath?: string;
}

export interface CommitOptions {
  message: string;
  files?: string[];
  push?: boolean;
}

export interface GitHubUser { login: string; name: string; avatar_url: string; }
export interface GitHubRepo { id: number; full_name: string; default_branch: string; private: boolean; }
export interface PROptions  { owner: string; repo: string; title: string; body: string; head: string; base: string; }
export interface PRResult   { number: number; url: string; title: string; }
export interface GistFileEntry { filename: string; content?: string; raw_url?: string; }
export interface GistItem {
  id: string; description: string; html_url: string;
  files: Record<string, GistFileEntry>;
  owner: { login: string }; created_at: string;
}

// ── Multi-provider types ─────────────────────────────────────────────────
export type ProviderType = 'github' | 'gitlab' | 'bitbucket';
export interface GitUser { login: string; name?: string; avatar_url: string; email?: string; provider: ProviderType; }
export interface GitRepo { id: string | number; name: string; full_name: string; private: boolean; description?: string; html_url: string; default_branch: string; provider: ProviderType; }
export interface GitPROptions { owner: string; repo: string; title: string; body: string; head: string; base: string; }
export interface GitPRResult { number: number; url: string; title: string; }
export interface GitSnippet { id: string; description: string; html_url: string; public: boolean; created_at: string; updated_at: string; owner_login: string; files: Record<string, { filename: string; content?: string }>; provider: ProviderType; }
export interface DeviceFlowInit { device_code: string; user_code: string; verification_url: string; expires_in: number; interval: number; }
export interface ProviderSettings { github?: { clientId?: string }; gitlab?: { clientId?: string; baseUrl?: string }; bitbucket?: Record<string, never>; }

export interface IElectronAPI {
  agent: {
    create: (data: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any>;
    exportToMd: (agent: any, platform?: string) => Promise<string>;
  };
  skill: {
    create: (data: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    getAll: () => Promise<any[]>;
    exportToMd: (skill: any, platform?: string) => Promise<string>;
    exportToYaml: (skill: any) => Promise<string>;
    createDirectory: (skill: any, basePath: string) => Promise<void>;
    validateDescription: (description: string) => Promise<ValidationResult>;
  };
  mcp: {
    load: () => Promise<any>;
    save: (config: any) => Promise<void>;
    export: () => Promise<string>;
    getAvailableTools: () => Promise<MCPToolItem[]>;
    searchTools: (query: string) => Promise<MCPToolItem[]>;
    getAllProjects: () => Promise<MCPProjectConfig[]>;
    createProject: (data: Partial<MCPProjectConfig>) => Promise<MCPProjectConfig>;
    updateProject: (id: string, updates: Partial<MCPProjectConfig>) => Promise<MCPProjectConfig>;
    deleteProject: (id: string) => Promise<void>;
    deployProject: (config: MCPProjectConfig) => Promise<string>;
  };
  secure: {
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    getPassword: (service: string, account: string) => Promise<string | null>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
  };
  sync: {
    syncDirectories: (options: SyncOptions) => Promise<void>;
    detectChanges: () => Promise<{ github: string[]; home: string[] }>;
  };
  pattern: {
    generateInstructions: (agent: any, patterns?: string[]) => Promise<GeneratedInstructions>;
    analyzeRepository: () => Promise<RepositoryAnalysis>;
    validateGlobPattern: (pattern: string) => Promise<boolean>;
    findFilesMatchingPattern: (pattern: string) => Promise<string[]>;
  };
  git: {
    getStatus: () => Promise<GitStatus>;
    atomicCommit: (options: CommitOptions) => Promise<void>;
    isRepository: () => Promise<boolean>;
  };
  github: {
    saveToken: (token: string) => Promise<GitHubUser>;
    getUser: () => Promise<GitHubUser | null>;
    clearToken: () => Promise<void>;
    listRepos: () => Promise<GitHubRepo[]>;
    createPR: (options: PROptions) => Promise<PRResult>;
    getMarketplaceGists: () => Promise<GistItem[]>;
    getGist: (id: string) => Promise<GistItem>;
    publishGist: (description: string, files: { filename: string; content: string }[]) => Promise<GistItem>;
    pushFiles: (owner: string, repo: string, baseBranch: string, newBranch: string, files: { path: string; content: string }[], commitMessage: string) => Promise<void>;
  };
  gitProvider: {
    getConnectedAccounts: () => Promise<{ type: ProviderType; user: GitUser }[]>;
    getSettings: () => Promise<ProviderSettings>;
    setClientId: (type: ProviderType, clientId: string) => Promise<void>;
    startDeviceFlow: (type: ProviderType) => Promise<DeviceFlowInit>;
    completeDeviceFlow: (type: ProviderType, init: DeviceFlowInit) => Promise<GitUser>;
    connectAppPassword: (type: ProviderType, token: string, extra?: Record<string, string>) => Promise<GitUser>;
    disconnect: (type: ProviderType) => Promise<void>;
    listRepos: (type: ProviderType) => Promise<GitRepo[]>;
    pushFiles: (type: ProviderType, owner: string, repo: string, baseBranch: string, newBranch: string, files: { path: string; content: string }[], message: string) => Promise<void>;
    createPR: (type: ProviderType, options: GitPROptions) => Promise<GitPRResult>;
    listMarketplaceSnippets: (type: ProviderType) => Promise<GitSnippet[]>;
    getSnippet: (type: ProviderType, id: string) => Promise<GitSnippet>;
    publishSnippet: (type: ProviderType, description: string, files: { filename: string; content: string }[], isPublic: boolean) => Promise<GitSnippet>;
  };
  workspace: {
    deployAgent: (agent: any, platform: string, projectPath: string) => Promise<string>;
    deploySkill: (skill: any, platform: string, projectPath: string) => Promise<string>;
  };
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}

export {};
