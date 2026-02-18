import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SaveGitHubTokenUseCase,
  GetGitHubUserUseCase,
  ClearGitHubTokenUseCase,
  ListGitHubReposUseCase,
  CreatePullRequestUseCase,
  GetMarketplaceGistsUseCase,
  GetGistUseCase,
  PublishGistUseCase,
} from '../GitHubUseCases';
import type { GitHubUser, GitHubRepo, PROptions, PRResult, GistItem } from '../../../infrastructure/services/GitHubService';

// ── Shared test data ──────────────────────────────────────────────────────────

const MOCK_USER: GitHubUser = {
  login: 'octocat',
  id: 1,
  avatar_url: 'https://github.com/images/error/octocat.png',
  name: 'The Octocat',
  email: 'octocat@github.com',
};

const MOCK_REPOS: GitHubRepo[] = [
  { id: 1, name: 'Hello-World', full_name: 'octocat/Hello-World', private: false, description: 'My first repo', html_url: 'https://github.com/octocat/Hello-World', default_branch: 'main' },
  { id: 2, name: 'Spoon-Knife', full_name: 'octocat/Spoon-Knife', private: false, description: 'A fork test repo', html_url: 'https://github.com/octocat/Spoon-Knife', default_branch: 'main' },
];

const MOCK_PR_RESULT: PRResult = {
  number: 42,
  url: 'https://github.com/octocat/Hello-World/pull/42',
  title: 'Add agent config',
};

const MOCK_GIST: GistItem = {
  id: 'abc123',
  description: 'My gist [agent-orchestrator]',
  html_url: 'https://gist.github.com/abc123',
  public: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  files: {
    'agent.md': { filename: 'agent.md', type: 'text/markdown', content: '# Agent' },
  },
};

// ── Mock GitHubService factory ────────────────────────────────────────────────

function makeMockService(overrides: Partial<Record<string, (...a: any[]) => any>> = {}) {
  return {
    validateToken: vi.fn().mockResolvedValue(MOCK_USER),
    saveToken: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue('ghp_test'),
    clearToken: vi.fn().mockResolvedValue(undefined),
    getAuthenticatedUser: vi.fn().mockResolvedValue(MOCK_USER),
    listRepositories: vi.fn().mockResolvedValue(MOCK_REPOS),
    createPullRequest: vi.fn().mockResolvedValue(MOCK_PR_RESULT),
    searchMarketplaceGists: vi.fn().mockResolvedValue([MOCK_GIST]),
    getGist: vi.fn().mockResolvedValue(MOCK_GIST),
    createGist: vi.fn().mockResolvedValue(MOCK_GIST),
    ...overrides,
  } as any;
}

// ── SaveGitHubTokenUseCase ────────────────────────────────────────────────────

describe('GitHubUseCases', () => {
  describe('SaveGitHubTokenUseCase', () => {
    it('validates the token and saves it', async () => {
      const svc = makeMockService();
      const useCase = new SaveGitHubTokenUseCase(svc);

      const user = await useCase.execute('ghp_valid');

      expect(svc.validateToken).toHaveBeenCalledWith('ghp_valid');
      expect(svc.saveToken).toHaveBeenCalledWith('ghp_valid');
      expect(user).toEqual(MOCK_USER);
    });

    it('throws when the token is invalid', async () => {
      const svc = makeMockService({ validateToken: vi.fn().mockResolvedValue(null) });
      const useCase = new SaveGitHubTokenUseCase(svc);

      await expect(useCase.execute('bad-token')).rejects.toThrow('Invalid GitHub token');
      expect(svc.saveToken).not.toHaveBeenCalled();
    });

    it('propagates service errors', async () => {
      const svc = makeMockService({ validateToken: vi.fn().mockRejectedValue(new Error('Network error')) });
      const useCase = new SaveGitHubTokenUseCase(svc);

      await expect(useCase.execute('ghp_x')).rejects.toThrow('Network error');
    });
  });

  // ── GetGitHubUserUseCase ──────────────────────────────────────────────────

  describe('GetGitHubUserUseCase', () => {
    it('returns the authenticated user when a token is stored', async () => {
      const svc = makeMockService();
      const useCase = new GetGitHubUserUseCase(svc);

      const user = await useCase.execute();

      expect(svc.getAuthenticatedUser).toHaveBeenCalled();
      expect(user).toEqual(MOCK_USER);
    });

    it('returns null when no token is stored', async () => {
      const svc = makeMockService({ getAuthenticatedUser: vi.fn().mockResolvedValue(null) });
      const useCase = new GetGitHubUserUseCase(svc);

      const user = await useCase.execute();
      expect(user).toBeNull();
    });
  });

  // ── ClearGitHubTokenUseCase ───────────────────────────────────────────────

  describe('ClearGitHubTokenUseCase', () => {
    it('delegates to the service clearToken method', async () => {
      const svc = makeMockService();
      const useCase = new ClearGitHubTokenUseCase(svc);

      await useCase.execute();

      expect(svc.clearToken).toHaveBeenCalledOnce();
    });
  });

  // ── ListGitHubReposUseCase ────────────────────────────────────────────────

  describe('ListGitHubReposUseCase', () => {
    it('returns the repository list from the service', async () => {
      const svc = makeMockService();
      const useCase = new ListGitHubReposUseCase(svc);

      const repos = await useCase.execute();

      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe('Hello-World');
      expect(repos[1].full_name).toBe('octocat/Spoon-Knife');
    });

    it('returns an empty array when no repos exist', async () => {
      const svc = makeMockService({ listRepositories: vi.fn().mockResolvedValue([]) });
      const useCase = new ListGitHubReposUseCase(svc);

      const repos = await useCase.execute();
      expect(repos).toEqual([]);
    });
  });

  // ── CreatePullRequestUseCase ──────────────────────────────────────────────

  describe('CreatePullRequestUseCase', () => {
    const options: PROptions = {
      owner: 'octocat',
      repo: 'Hello-World',
      title: 'Add agent config',
      body: 'Adds the copilot-instructions.md file.',
      head: 'feat/add-agent',
      base: 'main',
    };

    it('creates a PR and returns the result', async () => {
      const svc = makeMockService();
      const useCase = new CreatePullRequestUseCase(svc);

      const result = await useCase.execute(options);

      expect(svc.createPullRequest).toHaveBeenCalledWith(options);
      expect(result.number).toBe(42);
      expect(result.url).toContain('/pull/42');
    });

    it('propagates API errors from the service', async () => {
      const svc = makeMockService({
        createPullRequest: vi.fn().mockRejectedValue(new Error('Unprocessable Entity')),
      });
      const useCase = new CreatePullRequestUseCase(svc);

      await expect(useCase.execute(options)).rejects.toThrow('Unprocessable Entity');
    });
  });

  // ── GetMarketplaceGistsUseCase ────────────────────────────────────────────

  describe('GetMarketplaceGistsUseCase', () => {
    it('returns gists matching the marketplace tag', async () => {
      const svc = makeMockService();
      const useCase = new GetMarketplaceGistsUseCase(svc);

      const gists = await useCase.execute();

      expect(svc.searchMarketplaceGists).toHaveBeenCalled();
      expect(gists).toHaveLength(1);
      expect(gists[0].description).toContain('[agent-orchestrator]');
    });

    it('returns an empty array when no marketplace gists exist', async () => {
      const svc = makeMockService({ searchMarketplaceGists: vi.fn().mockResolvedValue([]) });
      const useCase = new GetMarketplaceGistsUseCase(svc);

      const gists = await useCase.execute();
      expect(gists).toEqual([]);
    });
  });

  // ── GetGistUseCase ────────────────────────────────────────────────────────

  describe('GetGistUseCase', () => {
    it('fetches a gist by id', async () => {
      const svc = makeMockService();
      const useCase = new GetGistUseCase(svc);

      const gist = await useCase.execute('abc123');

      expect(svc.getGist).toHaveBeenCalledWith('abc123');
      expect(gist.id).toBe('abc123');
    });

    it('propagates not-found errors', async () => {
      const svc = makeMockService({ getGist: vi.fn().mockRejectedValue(new Error('Not Found')) });
      const useCase = new GetGistUseCase(svc);

      await expect(useCase.execute('missing')).rejects.toThrow('Not Found');
    });
  });

  // ── PublishGistUseCase ────────────────────────────────────────────────────

  describe('PublishGistUseCase', () => {
    const files = [
      { filename: 'agent.md', content: '# My Agent\n...' },
      { filename: 'skill.md', content: '# My Skill\n...' },
    ];

    it('creates a public gist with the given files', async () => {
      const svc = makeMockService();
      const useCase = new PublishGistUseCase(svc);

      const result = await useCase.execute('My agent [agent-orchestrator]', files);

      expect(svc.createGist).toHaveBeenCalledWith(
        'My agent [agent-orchestrator]',
        files,
        true, // must be public
      );
      expect(result.html_url).toContain('gist.github.com');
    });

    it('propagates errors from the service', async () => {
      const svc = makeMockService({ createGist: vi.fn().mockRejectedValue(new Error('Forbidden')) });
      const useCase = new PublishGistUseCase(svc);

      await expect(useCase.execute('desc', files)).rejects.toThrow('Forbidden');
    });
  });
});
