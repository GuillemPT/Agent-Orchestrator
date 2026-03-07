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

// List all MCP configs for a project
mcps.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const projectId = c.req.query('projectId');
  
  if (!projectId) {
    return c.json({ error: 'projectId query parameter required' }, 400);
  }
  
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const mcpList = await prisma.mCP.findMany({
    where: { projectId },
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
