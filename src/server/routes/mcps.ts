import { Hono } from 'hono';
import { prisma } from '../db';
import type { Session } from '../auth';

const mcps = new Hono<{ Variables: { session: Session | null } }>();

// Middleware: require authentication
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// Helper: verify project ownership
const verifyProject = async (projectId: string, userId: string) => {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
};

// ── MCP "Project Config" endpoints (must be before /:id routes) ─────────────
// The MCPConfig UI manages standalone MCP project configs (label, projectPath,
// platform, mcpServers).  Stored as MCP rows with extra fields in `config` JSON.

/** Helper: ensure the user has at least one Project to attach MCPs to. */
async function getOrCreateDefaultProject(userId: string) {
  let project = await prisma.project.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: { userId, name: 'Default' },
    });
  }
  return project;
}

/** Convert a DB MCP row → MCPProjectConfig shape the UI expects. */
function toMCPProjectConfig(mcp: { id: string; label: string; config: string; createdAt: Date; updatedAt: Date }) {
  const cfg = JSON.parse(mcp.config);
  return {
    id: mcp.id,
    label: mcp.label,
    projectPath: cfg.projectPath ?? '',
    platform: cfg.platform ?? 'github-copilot',
    mcpServers: cfg.mcpServers ?? {},
    tools: cfg.tools ?? [],
    createdAt: mcp.createdAt.toISOString(),
    updatedAt: mcp.updatedAt.toISOString(),
  };
}

// Deploy an MCP project config (returns the destination path)
mcps.post('/projects/deploy', requireAuth, async (c) => {
  const body = await c.req.json();
  const projectPath = body.projectPath;
  const platform = body.platform ?? 'github-copilot';
  const mcpServers = body.mcpServers ?? {};

  if (!projectPath) {
    return c.json({ error: 'projectPath is required' }, 400);
  }

  const CONFIG_FILE_PATHS: Record<string, string> = {
    'github-copilot': '.vscode/mcp.json',
    claude: '.claude/settings.json',
    cursor: '.cursor/mcp.json',
    antigravity: 'antigravity.config.json',
    opencode: '.opencode/mcp.json',
  };

  const relativePath = CONFIG_FILE_PATHS[platform] ?? 'mcp.json';
  const fullPath = `${projectPath}/${relativePath}`;

  const configContent = JSON.stringify({ mcpServers }, null, 2);

  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, configContent, 'utf-8');

  return c.json(fullPath);
});

// List all MCP project configs for the current user
mcps.get('/projects', requireAuth, async (c) => {
  const session = c.get('session')!;

  const list = await prisma.mCP.findMany({
    where: { project: { userId: session.user.id, deletedAt: null } },
    orderBy: { updatedAt: 'desc' },
  });

  return c.json(list.map(toMCPProjectConfig));
});

// Create a new MCP project config
mcps.post('/projects', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();

  const project = await getOrCreateDefaultProject(session.user.id);

  const mcp = await prisma.mCP.create({
    data: {
      projectId: project.id,
      label: body.label ?? 'New Project',
      config: JSON.stringify({
        projectPath: body.projectPath ?? '',
        platform: body.platform ?? 'github-copilot',
        mcpServers: body.mcpServers ?? {},
        tools: body.tools ?? [],
      }),
    },
  });

  return c.json(toMCPProjectConfig(mcp), 201);
});

// Update an MCP project config
mcps.put('/projects/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await prisma.mCP.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });

  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'MCP config not found' }, 404);
  }

  const mcp = await prisma.mCP.update({
    where: { id },
    data: {
      label: body.label ?? existing.label,
      config: JSON.stringify({
        projectPath: body.projectPath ?? '',
        platform: body.platform ?? 'github-copilot',
        mcpServers: body.mcpServers ?? {},
        tools: body.tools ?? [],
      }),
    },
  });

  return c.json(toMCPProjectConfig(mcp));
});

// Delete an MCP project config
mcps.delete('/projects/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');

  const existing = await prisma.mCP.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });

  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'MCP config not found' }, 404);
  }

  await prisma.mCP.delete({ where: { id } });
  return c.json({ success: true });
});

// ── Raw MCP CRUD (by project) ───────────────────────────────────────────────

// List all MCP configs for a project (or all if no projectId given)
mcps.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const projectId = c.req.query('projectId');
  
  if (projectId) {
    const project = await verifyProject(projectId, session.user.id);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
  }
  
  const mcpList = await prisma.mCP.findMany({
    where: projectId
      ? { projectId }
      : { project: { userId: session.user.id, deletedAt: null } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      label: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return c.json(mcpList);
});

// Get a single MCP config
mcps.get('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const mcp = await prisma.mCP.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!mcp || mcp.project.userId !== session.user.id) {
    return c.json({ error: 'MCP config not found' }, 404);
  }
  
  const config = JSON.parse(mcp.config);
  return c.json({
    id: mcp.id,
    projectId: mcp.projectId,
    label: mcp.label,
    config,
    createdAt: mcp.createdAt,
    updatedAt: mcp.updatedAt,
  });
});

// Create a new MCP config
mcps.post('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  
  const projectId = body.projectId;
  if (!projectId) {
    return c.json({ error: 'projectId required' }, 400);
  }
  
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const mcp = await prisma.mCP.create({
    data: {
      projectId,
      label: body.label ?? 'New MCP Config',
      config: JSON.stringify(body.config ?? {}),
    },
  });
  
  return c.json({
    id: mcp.id,
    projectId: mcp.projectId,
    label: mcp.label,
    config: JSON.parse(mcp.config),
    createdAt: mcp.createdAt,
    updatedAt: mcp.updatedAt,
  }, 201);
});

// Update an MCP config
mcps.put('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const existing = await prisma.mCP.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'MCP config not found' }, 404);
  }
  
  const mcp = await prisma.mCP.update({
    where: { id },
    data: {
      label: body.label ?? existing.label,
      config: body.config ? JSON.stringify(body.config) : existing.config,
    },
  });
  
  return c.json({
    id: mcp.id,
    projectId: mcp.projectId,
    label: mcp.label,
    config: JSON.parse(mcp.config),
    createdAt: mcp.createdAt,
    updatedAt: mcp.updatedAt,
  });
});

// Delete an MCP config
mcps.delete('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const existing = await prisma.mCP.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'MCP config not found' }, 404);
  }
  
  await prisma.mCP.delete({ where: { id } });
  
  return c.json({ success: true });
});

export default mcps;
