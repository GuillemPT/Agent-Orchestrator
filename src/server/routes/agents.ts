import { Hono } from 'hono';
import { prisma } from '../db';
import type { Session } from '../auth';

const agents = new Hono<{ Variables: { session: Session | null } }>();

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

// List all agents for a project
agents.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const projectId = c.req.query('projectId');
  
  if (!projectId) {
    return c.json({ error: 'projectId query parameter required' }, 400);
  }
  
  // Verify project ownership
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const agentList = await prisma.agent.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return c.json(agentList);
});

// Get a single agent with full content
agents.get('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const agent = await prisma.agent.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!agent || agent.project.userId !== session.user.id) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  // Parse and return the content
  const content = JSON.parse(agent.content);
  return c.json({
    id: agent.id,
    projectId: agent.projectId,
    name: agent.name,
    version: agent.version,
    ...content,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
});

// Create a new agent
agents.post('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  
  const projectId = body.projectId;
  if (!projectId) {
    return c.json({ error: 'projectId required' }, 400);
  }
  
  // Verify project ownership
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const { name, version, ...contentData } = body;
  
  const agent = await prisma.agent.create({
    data: {
      projectId,
      name: name ?? 'New Agent',
      version: version ?? '1.0.0',
      content: JSON.stringify(contentData),
    },
  });
  
  return c.json({
    id: agent.id,
    projectId: agent.projectId,
    name: agent.name,
    version: agent.version,
    ...contentData,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }, 201);
});

// Update an agent
agents.put('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();
  
  // Verify ownership
  const existing = await prisma.agent.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  // Save version history
  await prisma.agentVersion.create({
    data: {
      agentId: id,
      content: existing.content,
    },
  });
  
  const { name, version, ...contentData } = body;
  
  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      version: version ?? existing.version,
      content: JSON.stringify(contentData),
    },
  });
  
  return c.json({
    id: agent.id,
    projectId: agent.projectId,
    name: agent.name,
    version: agent.version,
    ...contentData,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
});

// Delete an agent
agents.delete('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  // Verify ownership
  const existing = await prisma.agent.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  await prisma.agent.delete({ where: { id } });
  
  return c.json({ success: true });
});

// Get version history for an agent
agents.get('/:id/versions', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  // Verify ownership
  const agent = await prisma.agent.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!agent || agent.project.userId !== session.user.id) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  const versions = await prisma.agentVersion.findMany({
    where: { agentId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
    },
  });
  
  return c.json(versions);
});

// Restore a specific version
agents.post('/:id/versions/:versionId/restore', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const versionId = c.req.param('versionId');
  
  // Verify ownership
  const agent = await prisma.agent.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!agent || agent.project.userId !== session.user.id) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  
  const version = await prisma.agentVersion.findFirst({
    where: { id: versionId, agentId: id },
  });
  
  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }
  
  // Save current state as a version before restoring
  await prisma.agentVersion.create({
    data: {
      agentId: id,
      content: agent.content,
    },
  });
  
  // Restore the old version
  const updated = await prisma.agent.update({
    where: { id },
    data: { content: version.content },
  });
  
  const content = JSON.parse(updated.content);
  return c.json({
    id: updated.id,
    projectId: updated.projectId,
    name: updated.name,
    version: updated.version,
    ...content,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

export default agents;
