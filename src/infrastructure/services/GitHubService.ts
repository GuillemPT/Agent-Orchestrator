import { ISecureStorage } from '../../domain/interfaces/ISecureStorage';

const TOKEN_SERVICE = 'agent-orchestrator';
const TOKEN_ACCOUNT  = 'github-token';
const API = 'https://api.github.com';

export interface GitHubUser { login: string; name: string; avatar_url: string; }
export interface GitHubRepo { id: number; full_name: string; default_branch: string; private: boolean; }
export interface PROptions  { owner: string; repo: string; title: string; body: string; head: string; base: string; }
export interface PRResult   { number: number; url: string; title: string; }
export interface GistFile   { filename: string; content: string; }
export interface GistItem   {
  id: string; description: string; html_url: string;
  files: Record<string, { filename: string; content?: string; raw_url?: string }>;
  owner: { login: string }; created_at: string;
}

export class GitHubService {
  constructor(private secureStorage: ISecureStorage) {}

  async saveToken(token: string): Promise<void> {
    await this.secureStorage.setPassword(TOKEN_SERVICE, TOKEN_ACCOUNT, token);
  }
  async getToken(): Promise<string | null> {
    return this.secureStorage.getPassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
  }
  async clearToken(): Promise<void> {
    await this.secureStorage.deletePassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
  }

  private async api<T>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> {
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

  async validateToken(token: string): Promise<GitHubUser | null> {
    try { return await this.api<GitHubUser>('/user', {}, token); }
    catch { return null; }
  }
  async getAuthenticatedUser(): Promise<GitHubUser | null> {
    try { return await this.api<GitHubUser>('/user'); }
    catch { return null; }
  }
  async listRepositories(page = 1): Promise<GitHubRepo[]> {
    return this.api<GitHubRepo[]>(`/user/repos?sort=updated&per_page=30&page=${page}`);
  }
  async createPullRequest(options: PROptions): Promise<PRResult> {
    const data = await this.api<{ number: number; html_url: string; title: string }>(
      `/repos/${options.owner}/${options.repo}/pulls`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: options.title, body: options.body, head: options.head, base: options.base }) },
    );
    return { number: data.number, url: data.html_url, title: data.title };
  }

  // ── Gist helpers ──────────────────────────────────────────────────────────

  async createGist(description: string, files: GistFile[], isPublic = true): Promise<GistItem> {
    const filesObj: Record<string, { content: string }> = {};
    for (const f of files) filesObj[f.filename] = { content: f.content };
    return this.api<GistItem>('/gists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, files: filesObj, public: isPublic }),
    });
  }
  async listPublicGists(page = 1): Promise<GistItem[]> {
    return this.api<GistItem[]>(`/gists/public?per_page=30&page=${page}`);
  }
  async listUserGists(): Promise<GistItem[]> {
    return this.api<GistItem[]>('/gists?per_page=50');
  }
  async getGist(id: string): Promise<GistItem> {
    return this.api<GistItem>(`/gists/${id}`);
  }
  async searchMarketplaceGists(): Promise<GistItem[]> {
    const gists = await this.listPublicGists();
    return gists.filter(g => g.description?.includes('[agent-orchestrator]'));
  }

  // ── GitHub Git API (for direct PR creation without local git) ─────────────

  /** Get the SHA of the tip of a branch. */
  async getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
    const data = await this.api<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/refs/heads/${branch}`
    );
    return data.object.sha;
  }

  /** Create a blob with file content. Returns the blob SHA. */
  async createBlob(owner: string, repo: string, content: string): Promise<string> {
    const data = await this.api<{ sha: string }>(
      `/repos/${owner}/${repo}/git/blobs`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, encoding: 'utf-8' }) },
    );
    return data.sha;
  }

  /** Create a new tree and commit, then update (or create) a branch ref. */
  async pushFilesToBranch(
    owner: string,
    repo: string,
    baseBranch: string,
    newBranch: string,
    files: { path: string; content: string }[],
    commitMessage: string,
  ): Promise<void> {
    // 1. Get base SHA
    const baseSha = await this.getBranchSha(owner, repo, baseBranch);

    // 2. Create blobs for each file
    const treeItems = await Promise.all(files.map(async f => ({
      path: f.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: await this.createBlob(owner, repo, f.content),
    })));

    // 3. Create tree
    const treeData = await this.api<{ sha: string }>(
      `/repos/${owner}/${repo}/git/trees`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_tree: baseSha, tree: treeItems }) },
    );

    // 4. Create commit
    const commitData = await this.api<{ sha: string }>(
      `/repos/${owner}/${repo}/git/commits`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage, tree: treeData.sha, parents: [baseSha] }) },
    );

    // 5. Create or update branch ref
    try {
      await this.getBranchSha(owner, repo, newBranch);
      // Branch exists — force update
      await this.api(
        `/repos/${owner}/${repo}/git/refs/heads/${newBranch}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sha: commitData.sha, force: true }) },
      );
    } catch {
      // Branch doesn't exist yet — create it
      await this.api(
        `/repos/${owner}/${repo}/git/refs`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: commitData.sha }) },
      );
    }
  }
}

