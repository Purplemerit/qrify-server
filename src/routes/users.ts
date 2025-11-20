import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { auth, type AuthReq } from '../middleware/auth.js';
import { generateToken, generateTokenExpiry, sendInvitationEmail } from '../lib/email.js';

const router = Router();

// Validation schemas
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['editor', 'viewer']).refine(val => val !== undefined, {
    message: 'Role must be editor or viewer'
  })
});

const updateUserRoleSchema = z.object({
  role: z.enum(['editor', 'viewer'])
});

// Middleware to check if user is admin
const requireAdmin = (req: AuthReq, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /users - Get current admin and all users invited by them (admin only)
router.get('/', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: req.user!.id }, // Include current admin
          { invitedBy: req.user!.id } // Include users invited by current admin
        ]
      },
      include: {
        _count: {
          select: {
            qrCodes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const usersWithStats = users.map(user => ({
      id: user.id,
      name: user.email.split('@')[0], // Use email prefix as name
      email: user.email,
      role: user.role,
      status: user.emailVerified ? 'Active' : 'Pending',
      lastActive: 'Recent', 
      qrCodes: user._count.qrCodes,
      invitedBy: user.invitedBy,
      createdAt: user.createdAt
    }));

    res.json({ users: usersWithStats });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /users/invite - Invite a new user (admin only)
router.post('/invite', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const { email, role } = inviteUserSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        email_invitedBy: {
          email,
          invitedBy: req.user!.id
        }
      }
    });

    if (existingInvitation && !existingInvitation.used) {
      return res.status(400).json({ error: 'Invitation already sent to this email' });
    }

    // Generate invitation token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        token,
        expiresAt,
        invitedBy: req.user!.id
      }
    });

    // Get inviter's name
    const inviter = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true }
    });

    const inviterName = inviter?.email.split('@')[0] || 'QRify Team';

    // Send invitation email
    await sendInvitationEmail(email, inviterName, role, token);

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /users/invitations - Get pending invitations (admin only)
router.get('/invitations', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: {
        invitedBy: req.user!.id,
        used: false,
        expiresAt: {
          gt: new Date() // Only non-expired invitations
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// POST /users/invitations/:id/resend - Resend invitation (admin only)
router.post('/invitations/:id/resend', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const invitationId = req.params.id;

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.invitedBy !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (invitation.used) {
      return res.status(400).json({ error: 'Invitation already used' });
    }

    // Generate new token and extend expiry
    const newToken = generateToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Update invitation
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt
      }
    });

    // Get inviter's name
    const inviter = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true }
    });

    const inviterName = inviter?.email.split('@')[0] || 'QRify Team';

    // Resend invitation email
    await sendInvitationEmail(
      updatedInvitation.email, 
      inviterName, 
      updatedInvitation.role, 
      newToken
    );

    res.json({ message: 'Invitation resent successfully' });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// DELETE /users/invitations/:id - Cancel invitation (admin only)
router.delete('/invitations/:id', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const invitationId = req.params.id;

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.invitedBy !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.invitation.delete({
      where: { id: invitationId }
    });

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// PUT /users/:id/role - Update user role (admin only)
router.put('/:id/role', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const userId = req.params.id;
    const { role } = updateUserRoleSchema.parse(req.body);

    // Prevent user from changing their own role
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Validate that only editor and viewer roles can be assigned
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Only editor and viewer roles can be assigned.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent changing the original admin's role
    if (user.role === 'admin' && !user.invitedBy) {
      return res.status(400).json({ error: 'Cannot change the original admin\'s role' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// DELETE /users/:id - Remove user (admin only)
router.delete('/:id', auth, requireAdmin, async (req: AuthReq, res) => {
  try {
    const userId = req.params.id;

    // Prevent user from deleting themselves
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

export default router;