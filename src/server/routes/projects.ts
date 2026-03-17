import { Hono } from 'hono';
import { prisma } from '../db';
import { auth } from '../auth';
import type { Session } from '../auth';
import { discoverRepoContent, parseRepoUrl } from '../services/RepoContentDiscoveryService';

const projects = new Hono<{ Variables: { session: Session | null } }>();

// Middleware: require authentication
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// List all projects for the authenticated user (excludes soft-deleted)
projects.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  
  const userProjects = await prisma.project.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { agents: true, skills: true, mcps: true },
      },
    },
  });
  
  return c.json(userProjects);
});

// Get a single project
projects.get('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      agents: { select: { id: true, name: true, version: true, updatedAt: true } },
      skills: { select: { id: true, name: true, updatedAt: true } },
      mcps: { select: { id: true, label: true, updatedAt: true } },
    },
  });
  
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  return c.json(project);
});

// Create a new project
projects.post('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  
  // Prevent duplicate projects with the same repoUrl
  if (body.repoUrl) {
    const existing = await prisma.project.findFirst({
      where: { userId: session.user.id, repoUrl: body.repoUrl, deletedAt: null },
    });
    if (existing) {
      return c.json(existing);
    }
  }
  
  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      name: body.name,
      repoUrl: body.repoUrl ?? null,
    },
  });
  
  return c.json(project, 201);
});

// Update a project
projects.put('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();
  
  // Verify ownership
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      repoUrl: body.repoUrl ?? existing.repoUrl,
    },
  });
  
  return c.json(project);
});

// Soft-delete a project (marks as deleted without removing data)
projects.delete('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  // Verify ownership
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  
  return c.json({ success: true });
});

// Restore a soft-deleted project
projects.post('/:id/restore', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: { not: null } },
  });

  if (!existing) {
    return c.json({ error: 'Project not found or not deleted' }, 404);
  }

  const project = await prisma.project.update({
    where: { id },
    data: { deletedAt: null },
  });

  return c.json(project);
});

// Discover agents, skills, and MCP configs in a project's repository
projects.post('/:id/discover', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  // Get project
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (!project.repoUrl) {
    return c.json({ error: 'Project has no repository URL' }, 400);
  }

  // Parse repo URL to extract provider, owner, repo
  const parsed = parseRepoUrl(project.repoUrl);
  if (!parsed) {
    return c.json({ error: 'Could not parse repository URL' }, 400);
  }

  // Get user's token for this provider (optional for public repos)
  const gitToken = await prisma.gitToken.findFirst({
    where: { userId: session.user.id, provider: parsed.provider },
  });
  const token = gitToken?.token ?? '';

  const result = await discoverRepoContent(parsed.provider, token, parsed.owner, parsed.repo);
  return c.json(result);
});

// Import discovered items into a project
projects.post('/:id/import-discovered', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const items: Array<{ type: string; name: string; path: string; platform: string; content: string }> = body.items ?? [];
  if (items.length === 0) {
    return c.json({ error: 'No items to import' }, 400);
  }

  const created = { agents: 0, skills: 0, mcps: 0, skipped: 0 };

  // Fetch existing names to avoid duplicates on re-scan
  const [existingAgents, existingSkills, existingMcps] = await Promise.all([
    prisma.agent.findMany({ where: { projectId: id }, select: { name: true } }),
    prisma.skill.findMany({ where: { projectId: id }, select: { name: true } }),
    prisma.mCP.findMany({ where: { projectId: id }, select: { label: true } }),
  ]);
  const existingNames = new Set([
    ...existingAgents.map(a => `agent:${a.name}`),
    ...existingSkills.map(s => `skill:${s.name}`),
    ...existingMcps.map(m => `mcp:${m.label}`),
  ]);

  for (const item of items) {
    const key = `${item.type}:${item.name}`;
    if (existingNames.has(key)) { created.skipped++; continue; }

    switch (item.type) {
      case 'agent': {
        await prisma.agent.create({
          data: {
            projectId: id,
            name: item.name,
            version: '1.0.0',
            content: JSON.stringify({
              metadata: { name: item.name, version: '1.0.0', description: `Imported from ${item.path}` },
              instructions: item.content,
              skills: [],
              mcpConfig: { tools: [], target: item.platform },
              sourcePath: item.path,
              platform: item.platform,
            }),
          },
        });
        created.agents++;
        break;
      }
      case 'skill': {
        await prisma.skill.create({
          data: {
            projectId: id,
            name: item.name,
            content: JSON.stringify({
              metadata: { name: item.name, description: `Imported from ${item.path}`, version: '1.0.0' },
              markdown: item.content,
              scripts: [],
              sourcePath: item.path,
            }),
          },
        });
        created.skills++;
        break;
      }
      case 'mcp': {
        // Try to parse JSON content for MCP configs
        let config = {};
        try { config = JSON.parse(item.content); } catch { config = { raw: item.content }; }
        await prisma.mCP.create({
          data: {
            projectId: id,
            label: item.name,
            config: JSON.stringify({
              platform: item.platform,
              sourcePath: item.path,
              ...config,
            }),
          },
        });
        created.mcps++;
        break;
      }
    }
  }

  return c.json({ success: true, created });
});

// Clear all imported agents, skills and MCPs from a project
projects.post('/:id/clear-items', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const [agents, skills, mcps] = await Promise.all([
    prisma.agent.deleteMany({ where: { projectId: id } }),
    prisma.skill.deleteMany({ where: { projectId: id } }),
    prisma.mCP.deleteMany({ where: { projectId: id } }),
  ]);

  return c.json({ success: true, deleted: { agents: agents.count, skills: skills.count, mcps: mcps.count } });
});

export default projects;
