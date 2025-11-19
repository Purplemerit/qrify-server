import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { auth, type AuthReq } from '../middleware/auth.js';
import { getTeamMemberIds } from '../lib/team.js';

const router = Router();

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  designOptions: z.object({
    frame: z.number().min(1).max(10),
    shape: z.number().min(1).max(4),
    logo: z.number().min(0).max(6),
    level: z.number().min(1).max(4),
    dotStyle: z.number().min(1).max(8).optional(),
    bgColor: z.string().optional(),
    outerBorder: z.number().min(1).max(8).optional()
  })
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  designOptions: z.object({
    frame: z.number().min(1).max(10),
    shape: z.number().min(1).max(4),
    logo: z.number().min(0).max(6),
    level: z.number().min(1).max(4),
    dotStyle: z.number().min(1).max(8).optional(),
    bgColor: z.string().optional(),
    outerBorder: z.number().min(1).max(8).optional()
  }).optional()
});

// GET /templates - Get all templates for the authenticated user and team
router.get('/', auth, async (req: AuthReq, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    
    // Get team member IDs to show all team templates
    const teamMemberIds = await getTeamMemberIds(userId);

    const templates = await prisma.template.findMany({
      where: {
        ownerId: { in: teamMemberIds }
      },
      select: {
        id: true,
        name: true,
        description: true,
        designFrame: true,
        designShape: true,
        designLogo: true,
        designLevel: true,
        designDotStyle: true,
        designBgColor: true,
        designOuterBorder: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        owner: {
          select: { email: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to match frontend interface
    const transformedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      owner: template.owner.email,
      isOwner: template.ownerId === userId, // To show different UI for owned vs team items
      designOptions: {
        frame: template.designFrame,
        shape: template.designShape,
        logo: template.designLogo,
        level: template.designLevel,
        dotStyle: template.designDotStyle || 1,
        bgColor: template.designBgColor || '#ffffff',
        outerBorder: template.designOuterBorder || 1
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));

    res.json(transformedTemplates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /templates - Create a new template
router.post('/', auth, async (req: AuthReq, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    const validation = createTemplateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validation.error.issues 
      });
    }

    const { name, description, designOptions } = validation.data;

    const template = await prisma.template.create({
      data: {
        name,
        description,
        designFrame: designOptions.frame,
        designShape: designOptions.shape,
        designLogo: designOptions.logo,
        designLevel: designOptions.level,
        designDotStyle: designOptions.dotStyle || 1,
        designBgColor: designOptions.bgColor || '#ffffff',
        designOuterBorder: designOptions.outerBorder || 1,
        ownerId: userId
      },
      select: {
        id: true,
        name: true,
        description: true,
        designFrame: true,
        designShape: true,
        designLogo: true,
        designLevel: true,
        designDotStyle: true,
        designBgColor: true,
        designOuterBorder: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Transform to match frontend interface
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      designOptions: {
        frame: template.designFrame,
        shape: template.designShape,
        logo: template.designLogo,
        level: template.designLevel,
        dotStyle: template.designDotStyle || 1,
        bgColor: template.designBgColor || '#ffffff',
        outerBorder: template.designOuterBorder || 1
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };

    res.status(201).json(transformedTemplate);
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /templates/:id - Update a template
router.put('/:id', auth, async (req: AuthReq, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    const templateId = req.params.id;
    const validation = updateTemplateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validation.error.issues 
      });
    }

    // Check if template exists and belongs to user
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        ownerId: userId
      }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { name, description, designOptions } = validation.data;
    
    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (designOptions) {
      updateData.designFrame = designOptions.frame;
      updateData.designShape = designOptions.shape;
      updateData.designLogo = designOptions.logo;
      updateData.designLevel = designOptions.level;
      if (designOptions.dotStyle !== undefined) updateData.designDotStyle = designOptions.dotStyle;
      if (designOptions.bgColor !== undefined) updateData.designBgColor = designOptions.bgColor;
      if (designOptions.outerBorder !== undefined) updateData.designOuterBorder = designOptions.outerBorder;
    }

    const template = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        designFrame: true,
        designShape: true,
        designLogo: true,
        designLevel: true,
        designDotStyle: true,
        designBgColor: true,
        designOuterBorder: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Transform to match frontend interface
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      designOptions: {
        frame: template.designFrame,
        shape: template.designShape,
        logo: template.designLogo,
        level: template.designLevel,
        dotStyle: template.designDotStyle || 1,
        bgColor: template.designBgColor || '#ffffff',
        outerBorder: template.designOuterBorder || 1
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };

    res.json(transformedTemplate);
  } catch (error) {
    console.error('Failed to update template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /templates/:id - Delete a template
router.delete('/:id', auth, async (req: AuthReq, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    const templateId = req.params.id;

    // Check if template exists and belongs to user
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: templateId,
        ownerId: userId
      }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.template.delete({
      where: { id: templateId }
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Failed to delete template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// GET /templates/:id - Get a specific template
router.get('/:id', auth, async (req: AuthReq, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const userId = req.user.id;
    const templateId = req.params.id;

    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        ownerId: userId
      },
      select: {
        id: true,
        name: true,
        description: true,
        designFrame: true,
        designShape: true,
        designLogo: true,
        designLevel: true,
        designDotStyle: true,
        designBgColor: true,
        designOuterBorder: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Transform to match frontend interface
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      designOptions: {
        frame: template.designFrame,
        shape: template.designShape,
        logo: template.designLogo,
        level: template.designLevel,
        dotStyle: template.designDotStyle || 1,
        bgColor: template.designBgColor || '#ffffff',
        outerBorder: template.designOuterBorder || 1
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };

    res.json(transformedTemplate);
  } catch (error) {
    console.error('Failed to fetch template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

export default router;