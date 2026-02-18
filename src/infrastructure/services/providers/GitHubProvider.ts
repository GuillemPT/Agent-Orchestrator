import { ISecureStorage } from '../../../domain/interfaces/ISecureStorage';
import type {
  IGitProvider, ProviderType, OAuthAppConfig, DeviceFlowInit,
  GitUser, GitRepo, GitPROptions, GitPRResult, GitFileEntry,
  GitSnippetFile, GitSnippet,
} from '../../../domain/interfaces/IGitProvider';

const API = 'https://api.github.com';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const KEY_SVC = 'agent-orchestrator';
const KEY_ACCT = 'github-oauth-token';
const MARKETPLACE_TAG = '[agent-orchestrator]';

export class GitHubProvider implements IGitProvider {
  readonly type: ProviderType = 'github';

  constructor(private storage: ISecureStorage) {}

  // ── Token storage ─────────────────────────────────────────────────────────
  async saveToken(token: string) { await this.storage.setPassword(KEY_SVC, KEY_ACCT, token); }
  async getToken() { return this.storage.getPassword(KEY_SVC, KEY_ACCT); }
  async clearToken() { await this.storage.deletePassword(KEY_SVC, KEY_ACCT); }

  // ── Device Flow OAuth ────────────────────────────────────────────────────
  async startDeviceFlow(cfg: OAuthAppConfig): Promise<DeviceFlowInit> {
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cfg.clientId, scope: 'repo,gist,read:user' }),
    });
    if (!res.ok) throw new Error(`GitHub Device Flow init failed: ${res.status}`);
    const data = await res.json() as any;
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_url: data.verification_uri ?? 'https://github.com/login/device',
      expires_in: data.expires_in ?? 900,
      interval: data.interval ?? 5,
    };
  }

  async pollDeviceFlow(cfg: OAuthAppConfig, init: DeviceFlowInit): Promise<string> {
    const deadline = Date.now() + init.expires_in * 1000;
    const wait = (s: number) => new Promise<void>(r => setTimeout(r, s * 1000));
    let intervalSecs = init.interval;

    while (Date.now() < deadline) {
      await wait(intervalSecs);
      const res = await fetch(TOKEN_URL, {
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

  // ── PAT / Token validation ────────────────────────────────────────────────
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
    return { login: raw.login, name: raw.name, avatar_url: raw.avatar_url, email: raw.email, provider: 'github' };
  }

  // ── Repositories ─────────────────────────────────────────────────────────
  async listRepositories(): Promise<GitRepo[]> {
    const raw = await this.req<any[]>('/user/repos?sort=updated&per_page=30');
    return raw.map(r => ({
      id: r.id, name: r.name, full_name: r.full_name, private: r.private,
      description: r.description, html_url: r.html_url, default_branch: r.default_branch,
      provider: 'github' as ProviderType,
    }));
  }

  // ── PR creation via Git Trees API ─────────────────────────────────────────
  async pushFilesToBranch(owner: string, repo: string, baseBranch: string, newBranch: string, files: GitFileEntry[], commitMessage: string): Promise<void> {
    const baseSha = await this.getBranchSha(owner, repo, baseBranch);
    const treeItems = await Promise.all(files.map(async f => ({
      path: f.path, mode: '100644' as const, type: 'blob' as const,
      sha: await this.createBlob(owner, repo, f.content),
    })));
    const tree = await this.req<any>(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
    });
    const commit = await this.req<any>(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commitMessage, tree: tree.sha, parents: [baseSha] }),
    });
    try {
      await this.getBranchSha(owner, repo, newBranch);
      await this.req(`/repos/${owner}/${repo}/git/refs/heads/${newBranch}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: commit.sha, force: true }),
      });
    } catch {
      await this.req(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: commit.sha }),
      });
    }
  }

  private async getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
    const data = await this.req<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
    return data.object.sha;
  }
  private async createBlob(owner: string, repo: string, content: string): Promise<string> {
    const data = await this.req<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, encoding: 'utf-8' }),
    });
    return data.sha;
  }

  async createPullRequest(options: GitPROptions): Promise<GitPRResult> {
    const data = await this.req<any>(`/repos/${options.owner}/${options.repo}/pulls`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: options.title, body: options.body, head: options.head, base: options.base }),
    });
    return { number: data.number, url: data.html_url, title: data.title };
  }

  // ── Snippets (Gists) ─────────────────────────────────────────────────────
  async listMarketplaceSnippets(): Promise<GitSnippet[]> {
    const gists = await this.req<any[]>('/gists/public?per_page=50');
    return gists
      .filter(g => g.description?.includes(MARKETPLACE_TAG))
      .map(g => this.toSnippet(g));
  }
  async getSnippet(id: string): Promise<GitSnippet> {
    return this.toSnippet(await this.req<any>(`/gists/${id}`));
  }
  async publishSnippet(description: string, files: GitSnippetFile[], isPublic: boolean): Promise<GitSnippet> {
    const filesObj: Record<string, { content: string }> = {};
    for (const f of files) filesObj[f.filename] = { content: f.content };
    return this.toSnippet(await this.req<any>('/gists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, files: filesObj, public: isPublic }),
    }));
  }
  private toSnippet(g: any): GitSnippet {
    return {
      id: g.id, description: g.description ?? '', html_url: g.html_url,
      public: g.public, created_at: g.created_at, updated_at: g.updated_at,
      owner_login: g.owner?.login ?? 'anonymous',
      files: g.files ?? {},
      provider: 'github',
    };
  }

  // ── Internal HTTP helper ──────────────────────────────────────────────────
  private async req<T = unknown>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> {
    const token = overrideToken ?? await this.getToken();
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`GitHub ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
