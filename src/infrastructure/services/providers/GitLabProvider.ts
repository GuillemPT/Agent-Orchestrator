import { ISecureStorage } from '../../../domain/interfaces/ISecureStorage';
import type {
  IGitProvider, ProviderType, OAuthAppConfig, DeviceFlowInit,
  GitUser, GitRepo, GitPROptions, GitPRResult, GitFileEntry,
  GitSnippetFile, GitSnippet,
} from '../../../domain/interfaces/IGitProvider';

const KEY_SVC = 'agent-orchestrator';
const KEY_ACCT = 'gitlab-oauth-token';
const MARKETPLACE_TAG = '[agent-orchestrator]';

export class GitLabProvider implements IGitProvider {
  readonly type: ProviderType = 'gitlab';

  /** Allows self-hosted instances via a custom base URL */
  private readonly baseUrl: string;

  constructor(private storage: ISecureStorage, baseUrl = 'https://gitlab.com') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ── Token storage ─────────────────────────────────────────────────────────
  async saveToken(token: string) { await this.storage.setPassword(KEY_SVC, KEY_ACCT, token); }
  async getToken() { return this.storage.getPassword(KEY_SVC, KEY_ACCT); }
  async clearToken() { await this.storage.deletePassword(KEY_SVC, KEY_ACCT); }

  // ── Device Flow (RFC 8628) ───────────────────────────────────────────────
  async startDeviceFlow(cfg: OAuthAppConfig): Promise<DeviceFlowInit> {
    const res = await fetch(`${this.baseUrl}/oauth/authorize_device`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cfg.clientId, scope: 'api read_user' }),
    });
    if (!res.ok) throw new Error(`GitLab Device Flow init failed: ${res.status}`);
    const data = await res.json() as any;
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_url: data.verification_uri ?? `${this.baseUrl}/-/profile/applications`,
      expires_in: data.expires_in ?? 300,
      interval: data.interval ?? 5,
    };
  }

  async pollDeviceFlow(cfg: OAuthAppConfig, init: DeviceFlowInit): Promise<string> {
    const deadline = Date.now() + init.expires_in * 1000;
    const wait = (s: number) => new Promise<void>(r => setTimeout(r, s * 1000));
    let intervalSecs = init.interval;

    while (Date.now() < deadline) {
      await wait(intervalSecs);
      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: cfg.clientId,
          device_code: init.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });
      const data = await res.json() as any;
      if (data.access_token) return data.access_token;
      if (data.error === 'slow_down') { intervalSecs += 5; continue; }
      if (data.error === 'authorization_pending') continue;
      throw new Error(`OAuth denied: ${data.error_description ?? data.error}`);
    }
    throw new Error('OAuth timed out — user did not complete authorisation in time');
  }

  // ── PAT validation ───────────────────────────────────────────────────────
  async validateToken(token: string): Promise<GitUser | null> {
    try { return this.toGitUser(await this.req<any>('/user', {}, token)); }
    catch { return null; }
  }

  // ── Authenticated user ────────────────────────────────────────────────────
  async getAuthenticatedUser(): Promise<GitUser | null> {
    try { return this.toGitUser(await this.req<any>('/user')); }
    catch { return null; }
  }

  private toGitUser(raw: any): GitUser {
    return {
      login: raw.username,
      name: raw.name,
      avatar_url: raw.avatar_url,
      email: raw.email,
      provider: 'gitlab',
    };
  }

  // ── Repositories (GitLab "projects") ─────────────────────────────────────
  async listRepositories(): Promise<GitRepo[]> {
    const raw = await this.req<any[]>('/projects?membership=true&order_by=last_activity_at&per_page=30');
    return raw.map(r => ({
      id: r.id,
      name: r.path,
      full_name: r.path_with_namespace,
      private: r.visibility !== 'public',
      description: r.description,
      html_url: r.web_url,
      default_branch: r.default_branch ?? 'main',
      provider: 'gitlab' as ProviderType,
    }));
  }

  // ── Push files via Commits API ────────────────────────────────────────────
  async pushFilesToBranch(owner: string, repo: string, baseBranch: string, newBranch: string, files: GitFileEntry[], commitMessage: string): Promise<void> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    // Check if new branch already exists
    let startBranch = baseBranch;
    try {
      await this.req(`/projects/${projectId}/repository/branches/${encodeURIComponent(newBranch)}`);
      startBranch = newBranch; // exists — commit directly
    } catch {
      // doesn't exist — will be created from baseBranch
    }
    const actions = files.map(f => ({ action: 'create', file_path: f.path, content: f.content }));
    await this.req(`/projects/${projectId}/repository/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: newBranch, start_branch: startBranch, commit_message: commitMessage, actions }),
    });
  }

  async createPullRequest(options: GitPROptions): Promise<GitPRResult> {
    const projectId = encodeURIComponent(`${options.owner}/${options.repo}`);
    const data = await this.req<any>(`/projects/${projectId}/merge_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: options.title, description: options.body, source_branch: options.head, target_branch: options.base }),
    });
    return { number: data.iid, url: data.web_url, title: data.title };
  }

  // ── Snippets ──────────────────────────────────────────────────────────────
  async listMarketplaceSnippets(): Promise<GitSnippet[]> {
    const raw = await this.req<any[]>('/snippets/public?per_page=50');
    return raw
      .filter(s => s.description?.includes(MARKETPLACE_TAG))
      .map(s => this.toSnippet(s));
  }
  async getSnippet(id: string): Promise<GitSnippet> {
    const raw = await this.req<any>(`/snippets/${id}`);
    // Fetch file content for each file
    const files: Record<string, { filename: string; content?: string }> = {};
    for (const f of raw.files ?? []) {
      files[f.file_name] = { filename: f.file_name };
    }
    return { ...this.toSnippet(raw), files };
  }
  async publishSnippet(description: string, files: GitSnippetFile[], isPublic: boolean): Promise<GitSnippet> {
    const data = await this.req<any>('/snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: description,
        description,
        visibility: isPublic ? 'public' : 'private',
        files: files.map(f => ({ file_path: f.filename, content: f.content })),
      }),
    });
    return this.toSnippet(data);
  }
  private toSnippet(s: any): GitSnippet {
    const files: Record<string, { filename: string; content?: string }> = {};
    for (const f of s.files ?? []) files[f.file_name] = { filename: f.file_name };
    return {
      id: String(s.id), description: s.description ?? s.title ?? '',
      html_url: s.web_url, public: s.visibility === 'public',
      created_at: s.created_at, updated_at: s.updated_at,
      owner_login: s.author?.username ?? 'anonymous',
      files, provider: 'gitlab',
    };
  }

  // ── Internal HTTP helper ──────────────────────────────────────────────────
  private async req<T = unknown>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> {
    const token = overrideToken ?? await this.getToken();
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`GitLab ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
