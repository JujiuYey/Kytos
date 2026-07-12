import { getDatabase } from '@/services/database/database';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectMember {
  id: string;
  project_id: string;
  member_name: string;
  created_at?: string;
  updated_at?: string;
}

export class ProjectMemberService {
  private static instance: ProjectMemberService;

  private constructor() {}

  public static getInstance(): ProjectMemberService {
    if (!ProjectMemberService.instance) {
      ProjectMemberService.instance = new ProjectMemberService();
    }
    return ProjectMemberService.instance;
  }

  /**
   * Get all members of a project by projectId
   * @param projectId The ID of the project
   * @returns Array of ProjectMember objects
   */
  public async list(projectId: string): Promise<ProjectMember[]> {
    try {
      const db = await getDatabase();
      const members = await db.select<ProjectMember[]>(
        'SELECT * FROM project_member WHERE project_id = ?',
        [projectId],
      );
      return members || [];
    } catch (error) {
      console.error('Error fetching project members:', error);
      throw new Error('Failed to fetch project members');
    }
  }

  /**
   * Batch update project members by first removing all existing members
   * and then adding the new ones
   * @param projectId The ID of the project
   * @param memberNames Array of member names to add to the project
   * @returns Promise that resolves when the operation is complete
   */
  public async batchUpdateMembers(projectId: string, memberNames: string[]): Promise<void> {
    const db = await getDatabase();

    try {
      // Start a transaction
      await db.execute('BEGIN TRANSACTION');

      // First, delete all existing members for this project
      await db.execute(
        'DELETE FROM project_member WHERE project_id = ?',
        [projectId],
      );

      // Then insert all new members
      if (memberNames && memberNames.length > 0) {
        const now = new Date().toISOString();
        const values = memberNames.map(name => ({
          id: uuidv4(),
          project_id: projectId,
          member_name: name,
          created_at: now,
          updated_at: now,
        }));

        // Insert in chunks to avoid SQL parameter limits
        const chunkSize = 100;
        for (let i = 0; i < values.length; i += chunkSize) {
          const chunk = values.slice(i, i + chunkSize);
          const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(',');
          const flatValues = chunk.flatMap(member => [
            member.id,
            member.project_id,
            member.member_name,
            member.created_at,
            member.updated_at,
          ]);

          await db.execute(
            `INSERT INTO project_member (id, project_id, member_name, created_at, updated_at) 
             VALUES ${placeholders}`,
            flatValues,
          );
        }
      }

      // Commit the transaction
      await db.execute('COMMIT');
    } catch (error) {
      // Rollback in case of error
      await db.execute('ROLLBACK');
      console.error('Error updating project members:', error);
      throw new Error('Failed to update project members');
    }
  }
}

// Export a singleton instance for convenience
export const projectMemberService = ProjectMemberService.getInstance();
