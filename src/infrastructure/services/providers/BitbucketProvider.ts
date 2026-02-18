import { ISecureStorage } from '../../../domain/interfaces/ISecureStorage';
import type {
  IGitProvider, ProviderType, OAuthAppConfig, DeviceFlowInit,
  GitUser, GitRepo, GitPROptions, GitPRResult, GitFileEntry,
  GitSnippetFile, GitSnippet,
} from '../../../domain/interfaces/IGitProvider';

const API = 'https://api.bitbucket.org/2.0';
const KEY_SVC = 'agent-orchestrator';
const KEY_ACCT = 'bitbucket-credentials';
const MARKETPLACE_TAG = '[agent-orchestrator]';

interface BBCredentials { username: string; appPassword: string; }

/**
 * Bitbucket Cloud provider.
 * Auth: App Passwords (Bitbucket's PAT equivalent — no Device Flow available).
 * Snippets: Bitbucket Snippets API (equivalent of Gists/GitLab Snippets).
 */
export class BitbucketProvider implements IGitProvider {
  readonly type: ProviderType = 'bitbucket';

  constructor(private storage: ISecureStorage) {}

  // ── Credential storage (stored as JSON in keytar) ────────────────────────
  private async saveCreds(creds: BBCredentials) {
    await this.storage.setPassword(KEY_SVC, KEY_ACCT, JSON.stringify(creds));
  }
  private async getCreds(): Promise<BBCredentials | null> {
    const raw = await this.storage.getPassword(KEY_SVC, KEY_ACCT);
    if (!raw) return null;
    try { return JSON.parse(raw) as BBCredentials; }
    catch { return null; }
  }
  async saveToken(token: string) {
    // token = serialised JSON { username, appPassword }
    await this.storage.setPassword(KEY_SVC, KEY_ACCT, token);
  }
  async getToken(): Promise<string | null> {
    return this.storage.getPassword(KEY_SVC, KEY_ACCT);
  }
  async clearToken() { await this.storage.deletePassword(KEY_SVC, KEY_ACCT); }

  // ── Device Flow — NOT SUPPORTED; throw to signal to caller ────────────────
  async startDeviceFlow(_cfg: OAuthAppConfig): Promise<DeviceFlowInit> {
    throw new Error('Bitbucket does not support Device Flow. Use an App Password instead.');
  }
  async pollDeviceFlow(_cfg: OAuthAppConfig, _init: DeviceFlowInit): Promise<string> {
    throw new Error('Bitbucket does not support Device Flow.');
  }

  // ── App Password validation (extra.username required) ────────────────────
  async validateToken(appPassword: string, extra?: Record<string, string>): Promise<GitUser | null> {
    const username = extra?.username;
    if (!username) throw new Error('Bitbucket requires a username alongside the App Password');
    try {
      const raw = await this.req<any>('/user', {}, { username, appPassword });
      await this.saveCreds({ username, appPassword });
      return this.toGitUser(raw);
    } catch {
      return null;
    }
  }

  // ── Authenticated user ────────────────────────────────────────────────────
  async getAuthenticatedUser(): Promise<GitUser | null> {
    try { return this.toGitUser(await this.req<any>('/user')); }
    catch { return null; }
  }

  private toGitUser(raw: any): GitUser {
    return {
      login: raw.username ?? raw.nickname,
      name: raw.display_name,
      avatar_url: raw.links?.avatar?.href ?? '',
      email: raw.email,
      provider: 'bitbucket',
    };
  }

  // ── Repositories ──────────────────────────────────────────────────────────
  async listRepositories(): Promise<GitRepo[]> {
    const creds = await this.getCreds();
    if (!creds) return [];
    const data = await this.req<any>(`/repositories/${creds.username}?role=member&pagelen=30&sort=-updated_on`);
    return (data.values ?? []).map((r: any) => ({
      id: r.uuid,
      name: r.slug,
      full_name: r.full_name,
      private: r.is_private,
      description: r.description,
      html_url: r.links?.html?.href ?? '',
      default_branch: r.mainbranch?.name ?? 'main',
      provider: 'bitbucket' as ProviderType,
    }));
  }

  // ── Push files via Bitbucket src API ─────────────────────────────────────
  async pushFilesToBranch(owner: string, repo: string, baseBranch: string, newBranch: string, files: GitFileEntry[], commitMessage: string): Promise<void> {
    // Get base branch commit SHA to use as parent for the new branch
    const branchData = await this.req<any>(`/repositories/${owner}/${repo}/refs/branches/${encodeURIComponent(baseBranch)}`);
    const baseSha: string = branchData.target?.hash;

    const form = new FormData();
    form.append('message', commitMessage);
    form.append('branch', newBranch);
    if (baseSha) form.append('parents', baseSha);
    for (const f of files) form.append(f.path, new Blob([f.content], { type: 'text/plain' }));

    const creds = await this.getCreds();
    const auth = creds ? btoa(`${creds.username}:${creds.appPassword}`) : undefined;
    const res = await fetch(`${API}/repositories/${owner}/${repo}/src`, {
      method: 'POST',
      headers: auth ? { Authorization: `Basic ${auth}` } : {},
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Bitbucket ${res.status}: ${text}`);
    }
  }

  async createPullRequest(options: GitPROptions): Promise<GitPRResult> {
    const data = await this.req<any>(`/repositories/${options.owner}/${options.repo}/pullrequests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: options.title,
        description: options.body,
        source: { branch: { name: options.head } },
        destination: { branch: { name: options.base } },
      }),
    });
    return { number: data.id, url: data.links?.html?.href ?? '', title: data.title };
  }

  // ── Snippets ──────────────────────────────────────────────────────────────
  async listMarketplaceSnippets(): Promise<GitSnippet[]> {
    const data = await this.req<any>('/snippets?role=public&pagelen=50');
    return (data.values ?? [])
      .filter((s: any) => s.title?.includes(MARKETPLACE_TAG))
      .map((s: any) => this.toSnippet(s));
  }
  async getSnippet(id: string): Promise<GitSnippet> {
    return this.toSnippet(await this.req<any>(`/snippets/${id}`));
  }
  async publishSnippet(description: string, files: GitSnippetFile[], isPublic: boolean): Promise<GitSnippet> {
    const form = new FormData();
    form.append('title', description);
    form.append('is_private', isPublic ? 'false' : 'true');
    for (const f of files) form.append('file', new Blob([f.content], { type: 'text/plain' }), f.filename);
    const creds = await this.getCreds();
    const auth = creds ? btoa(`${creds.username}:${creds.appPassword}`) : undefined;
    const res = await fetch(`${API}/snippets`, {
      method: 'POST',
      headers: auth ? { Authorization: `Basic ${auth}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`Bitbucket publish failed: ${res.status}`);
    return this.toSnippet(await res.json());
  }
  private toSnippet(s: any): GitSnippet {
    const files: Record<string, { filename: string; content?: string }> = {};
    for (const [name, _] of Object.entries(s.files ?? {})) files[name] = { filename: name };
    return {
      id: s.id, description: s.title ?? '',
      html_url: s.links?.html?.href ?? '',
      public: !s.is_private,
      created_at: s.created_on ?? '', updated_at: s.updated_on ?? '',
      owner_login: s.owner?.username ?? s.owner?.nickname ?? 'anonymous',
      files, provider: 'bitbucket',
    };
  }

  // ── Internal HTTP helper ──────────────────────────────────────────────────
  private async req<T = unknown>(path: string, options: RequestInit = {}, overrideCreds?: BBCredentials): Promise<T> {
    const creds = overrideCreds ?? await this.getCreds();
    const auth = creds ? btoa(`${creds.username}:${creds.appPassword}`) : undefined;
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(auth ? { Authorization: `Basic ${auth}` } : {}),
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Bitbucket ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
