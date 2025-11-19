import { prisma } from '../prisma.js';

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  invitedBy: string | null;
}

/**
 * Get all team members for a user
 * A team consists of:
 * - The admin user (first user with no invitedBy)
 * - All users invited by the admin
 * - All users invited by editors/viewers (if any)
 */
export async function getTeamMembers(userId: string): Promise<TeamMember[]> {
  // Use raw query to avoid TypeScript issues with invitedBy field
  const user = await prisma.$queryRaw<TeamMember[]>`
    SELECT id, email, role, "invitedBy"
    FROM "User"
    WHERE id = ${userId}
  `;

  if (!user || user.length === 0) {
    throw new Error('User not found');
  }

  const currentUser = user[0];
  let teamMembers: TeamMember[] = [];

  if (currentUser.role === 'admin' && !currentUser.invitedBy) {
    // This user is the main admin, get all users they invited
    const allUsers = await prisma.$queryRaw<TeamMember[]>`
      SELECT id, email, role, "invitedBy"
      FROM "User"
      WHERE "invitedBy" = ${currentUser.id} OR id = ${currentUser.id}
    `;
    teamMembers = allUsers;
  } else {
    // This user was invited by someone, find the admin and get all team members
    let adminId: string | null = null;

    if (currentUser.invitedBy) {
      // Find the admin by traversing up the invitation chain
      const adminResult = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE invitation_chain AS (
          -- Base case: current user
          SELECT id, email, role, "invitedBy"
          FROM "User"
          WHERE id = ${currentUser.invitedBy}
          
          UNION ALL
          
          -- Recursive case: follow the invitation chain
          SELECT u.id, u.email, u.role, u."invitedBy"
          FROM "User" u
          INNER JOIN invitation_chain ic ON u.id = ic."invitedBy"
          WHERE u."invitedBy" IS NOT NULL
        )
        SELECT id
        FROM invitation_chain
        WHERE role = 'admin' AND "invitedBy" IS NULL
        LIMIT 1
      `;

      if (adminResult.length > 0) {
        adminId = adminResult[0].id;
      }
    }

    if (adminId) {
      // Get all team members under this admin
      const allUsers = await prisma.$queryRaw<TeamMember[]>`
        SELECT id, email, role, "invitedBy"
        FROM "User"
        WHERE "invitedBy" = ${adminId} OR id = ${adminId}
      `;
      teamMembers = allUsers;
    } else {
      // Fallback: just return the current user
      teamMembers = [currentUser];
    }
  }

  return teamMembers;
}

/**
 * Get all team member IDs for a user
 */
export async function getTeamMemberIds(userId: string): Promise<string[]> {
  const teamMembers = await getTeamMembers(userId);
  return teamMembers.map(member => member.id);
}

/**
 * Check if two users are in the same team
 */
export async function areTeamMembers(userId1: string, userId2: string): Promise<boolean> {
  try {
    const team1Ids = await getTeamMemberIds(userId1);
    return team1Ids.includes(userId2);
  } catch (error) {
    return false;
  }
}