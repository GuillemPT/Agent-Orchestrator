/**
 * Discovers agents, skills, and MCP configs inside a Git repository
 * by scanning the file tree via provider API (no cloning required).
 */

export type DiscoveredItemType = 'agent' | 'skill' | 'mcp';

export interface DiscoveredItem {
  type: DiscoveredItemType;
  name: string;
  path: string;
  /** Platform origin: github-copilot, claude, cursor, antigravity, opencode, or generic */
  platform: string;
  content: string;
}

export interface DiscoveryResult {
  items: DiscoveredItem[];
  scannedFiles: number;
}

// ── Known file patterns ────────────────────────────────────────────────────

interface PatternDef {
  type: DiscoveredItemType;
  platform: string;
  /** Exact path match */
  exact?: string;
  /** Path prefix (directory) */
  prefix?: string;
  /** Regex for path matching */
  regex?: RegExp;
}

const PATTERNS: PatternDef[] = [
  // Agents
  { type: 'agent', platform: 'github-copilot', exact: '.github/copilot-instructions.md' },
  { type: 'agent', platform: 'claude',         exact: 'CLAUDE.md' },
  { type: 'agent', platform: 'antigravity',    exact: 'antigravity.config.json' },
  { type: 'agent', platform: 'opencode',       exact: '.opencode/instructions.md' },
  { type: 'agent', platform: 'cursor',         prefix: '.cursor/rules/' },
  { type: 'agent', platform: 'generic',        regex: /\.agent\.md$/i },
  { type: 'agent', platform: 'generic',        regex: /\.instructions\.md$/i },

  // Skills
  { type: 'skill', platform: 'generic', regex: /SKILL\.md$/i },
  { type: 'skill', platform: 'generic', regex: /\.skill\.md$/i },
  { type: 'skill', platform: 'generic', prefix: '.github/skills/' },

  // MCP configs
  { type: 'mcp', platform: 'github-copilot', exact: '.vscode/mcp.json' },
  { type: 'mcp', platform: 'cursor',         exact: '.cursor/mcp.json' },
  { type: 'mcp', platform: 'claude',         exact: '.claude/settings.json' },
  { type: 'mcp', platform: 'opencode',       exact: '.opencode/mcp.json' },
];

function matchesPattern(filePath: string, pattern: PatternDef): boolean {
  if (pattern.exact && filePath === pattern.exact) return true;
  if (pattern.prefix && filePath.startsWith(pattern.prefix)) return true;
  if (pattern.regex && pattern.regex.test(filePath)) return true;
  return false;
}

function deriveName(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  return filename
    .replace(/\.(agent|skill|instructions)\.md$/i, '')
    .replace(/\.(md|json|mdc)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Provider-specific tree + content fetchers ──────────────────────────────

type TreeEntry = { path: string };

async function fetchGitHubTree(token: string, owner: string, repo: string): Promise<TreeEntry[]> {
  // Get default branch first
  const repoRes = await apiFetch(`https://api.github.com/repos/${owner}/${repo}`, token, { Accept: 'application/vnd.github+json' });
  const defaultBranch = repoRes.default_branch ?? 'main';
  // Get recursive tree
  const treeRes = await apiFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    token,
    { Accept: 'application/vnd.github+json' },
  );
  return (treeRes.tree ?? [])
    .filter((e: any) => e.type === 'blob')
    .map((e: any) => ({ path: e.path }));
}

async function fetchGitHubFileContent(token: string, owner: string, repo: string, path: string): Promise<string> {
  const data = await apiFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    token,
    { Accept: 'application/vnd.github.raw+json' },
    true,
  );
  return data;
}

async function fetchGitLabTree(token: string, owner: string, repo: string): Promise<TreeEntry[]> {
  const projectId = encodeURIComponent(`${owner}/${repo}`);
  const items: TreeEntry[] = [];
  let page = 1;
  while (page <= 5) { // cap at 5 pages
    const res = await apiFetch(
      `https://gitlab.com/api/v4/projects/${projectId}/repository/tree?recursive=true&per_page=100&page=${page}`,
      token,
    );
    if (!Array.isArray(res) || res.length === 0) break;
    for (const e of res) {
      if (e.type === 'blob') items.push({ path: e.path });
    }
    page++;
  }
  return items;
}

async function fetchGitLabFileContent(token: string, owner: string, repo: string, path: string): Promise<string> {
  const projectId = encodeURIComponent(`${owner}/${repo}`);
  const filePath = encodeURIComponent(path);
  return await apiFetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${filePath}/raw?ref=HEAD`,
    token,
    {},
    true,
  );
}

async function fetchBitbucketTree(token: string, owner: string, repo: string): Promise<TreeEntry[]> {
  const items: TreeEntry[] = [];
  let url: string | null = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/?max_depth=5&pagelen=100`;
  let pages = 0;
  while (url && pages < 5) {
    const data = await apiFetch(url, token);
    for (const e of data.values ?? []) {
      if (e.type === 'commit_file') items.push({ path: e.path });
    }
    url = data.next ?? null;
    pages++;
  }
  return items;
}

async function fetchBitbucketFileContent(token: string, owner: string, repo: string, path: string): Promise<string> {
  return await apiFetch(
    `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/HEAD/${encodeURIComponent(path)}`,
    token,
    {},
    true,
  );
}

// ── Generic fetch helper ───────────────────────────────────────────────────

async function apiFetch(url: string, token: string, extraHeaders: Record<string, string> = {}, asText = false): Promise<any> {
  const isBitbucket = url.includes('bitbucket.org');
  const headers: Record<string, string> = {
    ...extraHeaders,
  };
  if (isBitbucket) {
    // Bitbucket tokens may be JSON {username, appPassword}
    if (token) {
      try {
        const creds = JSON.parse(token);
        if (creds.username && creds.appPassword) {
          headers['Authorization'] = `Basic ${btoa(`${creds.username}:${creds.appPassword}`)}`;
        } else {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return asText ? res.text() : res.json();
}

// ── Main discovery function ────────────────────────────────────────────────

export type ProviderType = 'github' | 'gitlab' | 'bitbucket';

/**
 * Parse a repo URL into { provider, owner, repo }.
 * Handles both HTTPS and SSH URLs.
 */
export function parseRepoUrl(repoUrl: string): { provider: ProviderType; owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo or https://github.com/owner/repo.git
  const httpsMatch = repoUrl.match(/https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    const host = httpsMatch[1];
    const providerMap: Record<string, ProviderType> = {
      'github.com': 'github',
      'gitlab.com': 'gitlab',
      'bitbucket.org': 'bitbucket',
    };
    return {
      provider: providerMap[host],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    };
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = repoUrl.match(/git@(github\.com|gitlab\.com|bitbucket\.org):([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    const host = sshMatch[1];
    const providerMap: Record<string, ProviderType> = {
      'github.com': 'github',
      'gitlab.com': 'gitlab',
      'bitbucket.org': 'bitbucket',
    };
    return {
      provider: providerMap[host],
      owner: sshMatch[2],
      repo: sshMatch[3],
    };
  }

  return null;
}

/**
 * Discover agents, skills, and MCP configs inside a repository.
 */
export async function discoverRepoContent(
  provider: ProviderType,
  token: string,
  owner: string,
  repo: string,
): Promise<DiscoveryResult> {
  // 1. Fetch repo file tree
  let tree: TreeEntry[];
  switch (provider) {
    case 'github':    tree = await fetchGitHubTree(token, owner, repo); break;
    case 'gitlab':    tree = await fetchGitLabTree(token, owner, repo); break;
    case 'bitbucket': tree = await fetchBitbucketTree(token, owner, repo); break;
  }

  // 2. Match files against known patterns
  const matches: { path: string; pattern: PatternDef }[] = [];
  for (const entry of tree) {
    for (const pattern of PATTERNS) {
      if (matchesPattern(entry.path, pattern)) {
        matches.push({ path: entry.path, pattern });
        break; // first match wins
      }
    }
  }

  // 3. Fetch content for matched files (max 20 to avoid rate limits)
  const toFetch = matches.slice(0, 20);
  const items: DiscoveredItem[] = [];

  for (const { path, pattern } of toFetch) {
    try {
      let content: string;
      switch (provider) {
        case 'github':    content = await fetchGitHubFileContent(token, owner, repo, path); break;
        case 'gitlab':    content = await fetchGitLabFileContent(token, owner, repo, path); break;
        case 'bitbucket': content = await fetchBitbucketFileContent(token, owner, repo, path); break;
      }
      items.push({
        type: pattern.type,
        name: deriveName(path),
        path,
        platform: pattern.platform,
        content,
      });
    } catch (err) {
      console.error(`Failed to fetch ${path}:`, err);
    }
  }

  return { items, scannedFiles: tree.length };
}
