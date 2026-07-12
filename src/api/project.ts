import { getDatabase } from '@/services/database/database';
import { v4 as uuidv4 } from 'uuid';

export interface Project {
  // ID
  id: string;
  // 项目名称
  name: string;
  // 项目负责人
  leader?: string;
  // 报告撰稿人
  report_writer?: string;
  // 报告审核人
  report_reviewer?: string;
  // 报告签发人
  report_signer?: string;
  // 项目状态
  status?: string;
  // 委托单位名称
  entrust_unit_name: string;
  // 委托单位地址
  entrust_unit_address: string;
  // 委托单位联系电话
  entrust_unit_phone: string;
  // 委托日期
  entrust_date: string;
  // 创建时间
  created_at?: string;
  // 更新时间
  updated_at?: string;
}

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  public async find(id: string): Promise<Project | null> {
    const db = await getDatabase();
    const result = await db?.select<Project[]>(
      `SELECT 
        id,
        name,
        leader,
        report_writer,
        report_reviewer,
        report_signer,
        status,
        entrust_unit_name,
        entrust_unit_address,
        entrust_unit_phone,
        entrust_date,
        created_at,
        updated_at
       FROM project 
       WHERE id = ?`,
      [id],
    );
    return result?.[0] || null;
  }

  public async page(options: {
    page?: number;
    pageSize?: number;
    status?: string;
  } = {}): Promise<{ data: Project[]; total: number }> {
    const { page = 1, pageSize = 10, status } = options;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const db = await getDatabase();

    const [data, [total]] = await Promise.all([
      db?.select<Project[]>(
        `SELECT 
          id,
          name,
          leader,
          report_writer,
          report_reviewer,
          report_signer,
          status,
          entrust_unit_name,
          entrust_unit_address,
          entrust_unit_phone,
          entrust_date,
          created_at,
          updated_at
         FROM project 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      ) || [],
      db?.select<Array<{ count: number }>>(
        `SELECT COUNT(*) as count FROM project ${whereClause}`,
        params,
      ) || [{ count: 0 }],
    ]);

    return {
      data: data || [],
      total: total?.count || 0,
    };
  }

  public async list(status?: string): Promise<Project[]> {
    const db = await getDatabase();
    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const result = await db?.select<Project[]>(
      `SELECT 
        id,
        name,
        leader,
        report_writer,
        report_reviewer,
        report_signer,
        status,
        entrust_unit_name,
        entrust_unit_address,
        entrust_unit_phone,
        entrust_date,
        created_at,
        updated_at
       FROM project 
       ${whereClause} 
       ORDER BY created_at DESC`,
      params,
    );

    return result || [];
  }

  public async options(): Promise<Recordable[]> {
    const db = await getDatabase();
    const result = await db?.select<Recordable[]>(
      `SELECT 
        id,
        name
       FROM project 
       ORDER BY created_at DESC`,
    );
    return result || [];
  }

  public async create(
    project: Omit<Project, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<{ id: string }> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db?.execute(
      `INSERT INTO project 
        (id, name, leader, report_writer, report_reviewer, report_signer, 
         entrust_unit_name, entrust_unit_address, entrust_unit_phone, 
         entrust_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        project.name,
        project.leader,
        project.report_writer,
        project.report_reviewer,
        project.report_signer,
        project.entrust_unit_name,
        project.entrust_unit_address,
        project.entrust_unit_phone,
        project.entrust_date,
        project.status || 'active',
        now,
        now,
      ],
    );

    return { id };
  }

  public async update(
    id: string,
    updates: Partial<Omit<Project, 'id' | 'created_at'>>,
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const fields = [];
    const params: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await db?.execute(
      `UPDATE project SET ${fields.join(', ')} WHERE id = ?`,
      params,
    );
  }

  public async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db?.execute('DELETE FROM project WHERE id = ?', [id]);
  }

  public async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db?.execute(
      `DELETE FROM project WHERE id IN (${placeholders})`,
      ids,
    );
  }

  public async setStatus(id: string, status: string): Promise<void> {
    await this.update(id, { status });
  }
}

// Export a singleton instance for convenience
export const projectService = ProjectService.getInstance();
