import { Hono } from 'hono';
import { prisma } from '../db';
import type { Session } from '../auth';

const skills = new Hono<{ Variables: { session: Session | null } }>();

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

// List all skills for a project
skills.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const projectId = c.req.query('projectId');
  
  if (!projectId) {
    return c.json({ error: 'projectId query parameter required' }, 400);
  }
  
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const skillList = await prisma.skill.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return c.json(skillList);
});

// Get a single skill
skills.get('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const skill = await prisma.skill.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!skill || skill.project.userId !== session.user.id) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  const content = JSON.parse(skill.content);
  return c.json({
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    ...content,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  });
});

// Create a new skill
skills.post('/', requireAuth, async (c) => {
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
  
  const { name, ...contentData } = body;
  
  const skill = await prisma.skill.create({
    data: {
      projectId,
      name: name ?? 'New Skill',
      content: JSON.stringify(contentData),
    },
  });
  
  return c.json({
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    ...contentData,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }, 201);
});

// Update a skill
skills.put('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const existing = await prisma.skill.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  const { name, ...contentData } = body;
  
  const skill = await prisma.skill.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      content: JSON.stringify(contentData),
    },
  });
  
  return c.json({
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    ...contentData,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  });
});

// Delete a skill
skills.delete('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const existing = await prisma.skill.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  await prisma.skill.delete({ where: { id } });
  
  return c.json({ success: true });
});

export default skills;
