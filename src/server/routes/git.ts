import { Hono } from 'hono';
import { prisma } from '../db';
import type { Session } from '../auth';

// This route provides git provider functionality for the web app.
// It wraps the existing GitProviderService logic and uses stored tokens from the database.

const git = new Hono<{ Variables: { session: Session | null } }>();

// Middleware: require authentication
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// Helper: get user's git token for a provider
const getToken = async (userId: string, provider: string) => {
  const gitToken = await prisma.gitToken.findFirst({
    where: { userId, provider },
  });
  return gitToken?.token ?? null;
};

// List connected providers (which have tokens stored)
git.get('/providers', requireAuth, async (c) => {
  const session = c.get('session')!;
  
  const tokens = await prisma.gitToken.findMany({
    where: { userId: session.user.id },
    select: { provider: true },
  });
  
  return c.json(tokens.map((t) => t.provider));
});

// Connect a provider (store token)
git.post('/providers/:provider/connect', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  const body = await c.req.json();
  
  if (!['github', 'gitlab', 'bitbucket'].includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }
  
  if (!body.token) {
    return c.json({ error: 'Token required' }, 400);
  }
  
  // Upsert the token
  await prisma.gitToken.upsert({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider,
      },
    },
    create: {
      userId: session.user.id,
      provider,
      token: body.token,
    },
    update: {
      token: body.token,
    },
  });
  
  return c.json({ success: true });
});

// Disconnect a provider (remove token)
git.delete('/providers/:provider/disconnect', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  
  await prisma.gitToken.deleteMany({
    where: {
      userId: session.user.id,
      provider,
    },
  });
  
  return c.json({ success: true });
});

// List repositories for a provider
git.get('/providers/:provider/repos', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  
  const token = await getToken(session.user.id, provider);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }
  
  // TODO: Implement actual Git provider API calls
  // For now, return a placeholder response
  // In production, this would use the existing provider implementations:
  // - GitHubProvider.listRepositories(token)
  // - GitLabProvider.listRepositories(token)
  // - BitbucketProvider.listRepositories(token)
  
  return c.json({
    message: 'Repository listing - implement with provider API',
    provider,
  });
});

// Create a pull request / merge request
git.post('/providers/:provider/pull-requests', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  const body = await c.req.json();
  
  const token = await getToken(session.user.id, provider);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }
  
  const { owner, repo, title, body: prBody, head, base, files } = body;
  
  if (!owner || !repo || !title || !head || !base) {
    return c.json(
      { error: 'Missing required fields: owner, repo, title, head, base' },
      400
    );
  }
  
  // TODO: Implement actual Git provider API calls
  // In production:
  // 1. If files provided, push them to the head branch first
  // 2. Create the PR/MR using the provider API
  
  return c.json({
    message: 'PR creation - implement with provider API',
    provider,
    input: { owner, repo, title, head, base },
  });
});

// Get marketplace snippets (gists/snippets from providers)
git.get('/marketplace', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.query('provider'); // Optional filter
  
  // Get all connected providers
  const tokens = await prisma.gitToken.findMany({
    where: {
      userId: session.user.id,
      ...(provider ? { provider } : {}),
    },
  });
  
  if (tokens.length === 0) {
    return c.json([]);
  }
  
  // TODO: Aggregate snippets from all connected providers
  // Each provider has different APIs:
  // - GitHub: Gists API
  // - GitLab: Snippets API
  // - Bitbucket: Snippets API
  
  return c.json({
    message: 'Marketplace listing - implement with provider APIs',
    connectedProviders: tokens.map((t) => t.provider),
  });
});

// Publish to marketplace (create gist/snippet)
git.post('/marketplace', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  const { provider, title, description, content, isPublic } = body;
  
  if (!provider || !title || !content) {
    return c.json({ error: 'Missing required fields: provider, title, content' }, 400);
  }
  
  const token = await getToken(session.user.id, provider);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }
  
  // TODO: Create gist/snippet using provider API
  
  return c.json({
    message: 'Publishing - implement with provider API',
    provider,
    title,
  });
});

export default git;
