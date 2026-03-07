/**
 * Unified API layer.
 *
 * In Electron (VITE_MODE !== 'web') all calls delegate to window.api.*
 * which is injected via the contextBridge.
 *
 * In web mode (VITE_MODE === 'web') calls go to the Hono server via fetch.
 */

const IS_WEB = import.meta.env.VITE_MODE === 'web';

// ── helpers ───────────────────────────────────────────────────────────────

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return fetchJSON<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return fetchJSON<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

function del<T>(path: string): Promise<T> {
  return fetchJSON<T>(path, { method: 'DELETE' });
}

// ── web implementations ───────────────────────────────────────────────────

const webApi = {
  agent: {
    getAll: () => fetchJSON<any[]>('/api/agents'),
    getById: (id: string) => fetchJSON<any>(`/api/agents/${id}`),
    create: (data: any) => post<any>('/api/agents', data),
    update: (id: string, updates: any) => put<any>(`/api/agents/${id}`, updates),
    delete: (id: string) => del<void>(`/api/agents/${id}`),
    exportToMd: (agent: any, platform?: string) =>
      post<string>('/api/agents/export-md', { agent, platform }),
  },

  skill: {
    getAll: () => fetchJSON<any[]>('/api/skills'),
    getById: (id: string) => fetchJSON<any>(`/api/skills/${id}`),
    create: (data: any) => post<any>('/api/skills', data),
    update: (id: string, updates: any) => put<any>(`/api/skills/${id}`, updates),
    delete: (id: string) => del<void>(`/api/skills/${id}`),
    exportToMd: (skill: any, platform?: string) =>
      post<string>('/api/skills/export-md', { skill, platform }),
    exportToYaml: (skill: any) =>
      post<string>('/api/skills/export-yaml', { skill }),
    createDirectory: (skill: any, basePath: string) =>
      post<void>('/api/skills/create-directory', { skill, basePath }),
    validateDescription: (description: string) =>
      post<{ score: number; suggestions: string[] }>('/api/skills/validate-description', { description }),
  },

  project: {
    getAll: () => fetchJSON<any[]>('/api/projects'),
    getById: (id: string) => fetchJSON<any>(`/api/projects/${id}`),
    create: (data: any) => post<any>('/api/projects', data),
    update: (id: string, updates: any) => put<any>(`/api/projects/${id}`, updates),
    delete: (id: string) => del<void>(`/api/projects/${id}`),
  },

  mcp: {
    load: () => fetchJSON<any>('/api/mcps'),
    save: (config: any) => post<void>('/api/mcps', config),
    export: () => fetchJSON<string>('/api/mcps/export'),
    getAvailableTools: () => fetchJSON<any[]>('/api/mcps/tools'),
    searchTools: (query: string) => fetchJSON<any[]>(`/api/mcps/tools/search?q=${encodeURIComponent(query)}`),
    getAllProjects: () => fetchJSON<any[]>('/api/mcps/projects'),
    createProject: (data: any) => post<any>('/api/mcps/projects', data),
    updateProject: (id: string, updates: any) => put<any>(`/api/mcps/projects/${id}`, updates),
    deleteProject: (id: string) => del<void>(`/api/mcps/projects/${id}`),
    deployProject: (config: any) => post<string>('/api/mcps/projects/deploy', config),
  },

  gitProvider: {
    getConnectedAccounts: () => fetchJSON<any[]>('/api/git/accounts'),
    getSettings: () => fetchJSON<any>('/api/git/settings'),
    setClientId: (type: string, clientId: string) => put<void>('/api/git/settings', { type, clientId }),
    startDeviceFlow: (type: string) => post<any>('/api/git/device-flow/start', { type }),
    completeDeviceFlow: (type: string, init: any) => post<any>('/api/git/device-flow/complete', { type, init }),
    connectAppPassword: (type: string, token: string, extra?: Record<string, string>) =>
      post<any>('/api/git/connect-app-password', { type, token, extra }),
    disconnect: (type: string) => post<void>('/api/git/disconnect', { type }),
    listRepos: (type: string) => fetchJSON<any[]>(`/api/git/repos?provider=${type}`),
    pushFiles: (type: string, owner: string, repo: string, baseBranch: string, newBranch: string, files: any[], message: string) =>
      post<void>('/api/git/push-files', { type, owner, repo, baseBranch, newBranch, files, message }),
    createPR: (type: string, options: any) =>
      post<any>('/api/git/pull-requests', { type, ...options }),
    listMarketplaceSnippets: (type: string) =>
      fetchJSON<any[]>(`/api/git/snippets?provider=${type}`),
    getSnippet: (type: string, id: string) =>
      fetchJSON<any>(`/api/git/snippets/${id}?provider=${type}`),
    publishSnippet: (type: string, description: string, files: any[], isPublic: boolean) =>
      post<any>('/api/git/snippets', { type, description, files, isPublic }),
  },

  generate: {
    agent: (prompt: string) => post<any>('/api/generate/agent', { prompt }),
    skill: (prompt: string) => post<any>('/api/generate/skill', { prompt }),
  },
} as const;

// ── electron implementation (delegates to contextBridge) ──────────────────

const electronApi = {
  get agent()       { return window.api.agent; },
  get skill()       { return window.api.skill; },
  get project()     { return window.api.project; },
  get mcp()         { return window.api.mcp; },
  get gitProvider() { return window.api.gitProvider; },
  generate: {
    agent: () => { throw new Error('AI generation requires web mode'); },
    skill: () => { throw new Error('AI generation requires web mode'); },
  },
} as const;

// ── export ────────────────────────────────────────────────────────────────

export const api = IS_WEB ? webApi : electronApi;

export type AppApi = typeof api;
