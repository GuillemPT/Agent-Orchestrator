// ── Provider types ─────────────────────────────────────────────────────────
export type ProviderType = 'github' | 'gitlab' | 'bitbucket';

// ── Shared value objects ───────────────────────────────────────────────────
export interface GitUser {
  login: string;
  name?: string;
  avatar_url: string;
  email?: string;
  provider: ProviderType;
}

export interface GitRepo {
  id: string | number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string;
  html_url: string;
  default_branch: string;
  provider: ProviderType;
}

export interface GitPROptions {
  owner: string;  // workspace for Bitbucket
  repo: string;
  title: string;
  body: string;
  head: string;   // source branch
  base: string;   // target branch
}

export interface GitPRResult {
  number: number;
  url: string;
  title: string;
}

export interface GitFileEntry {
  path: string;
  content: string;
}

export interface GitSnippetFile {
  filename: string;
  content: string;
}

export interface GitSnippet {
  id: string;
  description: string;
  html_url: string;
  public: boolean;
  created_at: string;
  updated_at: string;
  owner_login: string;
  files: Record<string, { filename: string; content?: string }>;
  provider: ProviderType;
}

// ── OAuth Device Flow ───────────────────────────────────────────────────────
export interface DeviceFlowInit {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface OAuthAppConfig {
  clientId: string;
}

// ── Provider config stored on disk (secrets in keytar) ─────────────────────
export interface ProviderConfig {
  type: ProviderType;
  /** OAuth App client_id — semi-public, stored in config file */
  clientId?: string;
  label: string;
  baseUrl?: string;  // for self-hosted GitLab instances
}

// ── The core interface every provider must implement ───────────────────────
export interface IGitProvider {
  readonly type: ProviderType;

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** Initiate Device Authorization Flow. Returns code + URL to show user. */
  startDeviceFlow(config: OAuthAppConfig): Promise<DeviceFlowInit>;
  /** Poll until user authorises. Throws on denial / timeout. Returns access token. */
  pollDeviceFlow(config: OAuthAppConfig, init: DeviceFlowInit): Promise<string>;
  /** For providers that support PAT/App Passwords directly (e.g. Bitbucket). */
  validateToken(token: string, extra?: Record<string, string>): Promise<GitUser | null>;
  saveToken(token: string): Promise<void>;
  getToken(): Promise<string | null>;
  clearToken(): Promise<void>;

  // ── User ──────────────────────────────────────────────────────────────────
  getAuthenticatedUser(): Promise<GitUser | null>;

  // ── Repositories ──────────────────────────────────────────────────────────
  listRepositories(): Promise<GitRepo[]>;

  // ── Git operations (branch + commit + PR/MR) ──────────────────────────────
  pushFilesToBranch(
    owner: string,
    repo: string,
    baseBranch: string,
    newBranch: string,
    files: GitFileEntry[],
    commitMessage: string,
  ): Promise<void>;
  createPullRequest(options: GitPROptions): Promise<GitPRResult>;

  // ── Snippets / Marketplace ─────────────────────────────────────────────────
  listMarketplaceSnippets(): Promise<GitSnippet[]>;
  getSnippet(id: string): Promise<GitSnippet>;
  publishSnippet(description: string, files: GitSnippetFile[], isPublic: boolean): Promise<GitSnippet>;
}
