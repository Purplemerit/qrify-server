import { prisma } from '../prisma.js';

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  invitedBy: string | null;
}

/**
 * Validate user ID format for security
 */
function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.length < 8 || !/^[a-zA-Z0-9]+$/.test(userId)) {
    throw new Error('Invalid user ID format');
  }
}

/**
 * Get all team members for a user using safe Prisma ORM methods
 * A team consists of:
 * - The admin user (first user with no invitedBy)
 * - All users invited by the admin
 * - All users invited by editors/viewers (if any)
 */
export async function getTeamMembers(userId: string): Promise<TeamMember[]> {
  validateUserId(userId);

  try {
    // Use safe Prisma ORM query instead of raw SQL
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        invitedBy: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    let teamMembers: TeamMember[] = [];

    // Check if this user is the original admin (no invitedBy field)
    if (user.role === 'admin' && !user.invitedBy) {
      // This user is the main admin, get all users they invited plus themselves
      const allUsers = await prisma.user.findMany({
        where: {
          OR: [
            { invitedBy: user.id },
            { id: user.id }
          ]
        },
        select: {
          id: true,
          email: true,
          role: true,
          invitedBy: true
        }
      });
      teamMembers = allUsers;
    } else {
      // This user was invited by someone, find the admin by traversing the chain
      let adminId: string | null = null;
      let currentUser = user;
      
      // Traverse up the invitation chain safely (max 10 levels to prevent infinite loops)
      let depth = 0;
      while (currentUser.invitedBy && depth < 10) {
        validateUserId(currentUser.invitedBy);
        
        const inviter = await prisma.user.findUnique({
          where: { id: currentUser.invitedBy },
          select: {
            id: true,
            email: true,
            role: true,
            invitedBy: true
          }
        });
        
        if (!inviter) break;
        
        // Check if this is the original admin
        if (inviter.role === 'admin' && !inviter.invitedBy) {
          adminId = inviter.id;
          break;
        }
        
        currentUser = inviter;
        depth++;
      }

      if (adminId) {
        validateUserId(adminId);
        // Get all team members under this admin
        const allUsers = await prisma.user.findMany({
          where: {
            OR: [
              { invitedBy: adminId },
              { id: adminId }
            ]
          },
          select: {
            id: true,
            email: true,
            role: true,
            invitedBy: true
          }
        });
        teamMembers = allUsers;
      } else {
        // Fallback: just return the current user
        teamMembers = [user];
      }
    }

    return teamMembers;
  } catch (error) {
    console.error('Error getting team members:', error);
    throw new Error('Failed to get team members');
  }
}

/**
 * Get all team member IDs for a user using safe Prisma ORM methods
 */
export async function getTeamMemberIds(userId: string): Promise<string[]> {
  const teamMembers = await getTeamMembers(userId);
  return teamMembers.map(member => member.id);
}

/**
 * Check if two users are in the same team using safe Prisma ORM methods
 */
export async function areTeamMembers(userId1: string, userId2: string): Promise<boolean> {
  try {
    validateUserId(userId1);
    validateUserId(userId2);
    
    const team1Ids = await getTeamMemberIds(userId1);
    return team1Ids.includes(userId2);
  } catch (error) {
    return false;
  }
}