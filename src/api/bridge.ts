import { getDatabase } from '@/services/database/database';
import { v4 as uuidv4 } from 'uuid';

export interface Bridge {
  // ID
  id: string;

  // 所述项目id
  project_id: string;

  // A 桥梁所处行政区划代码
  admin_code: string;

  // B 行政识别数据
  route_code: string;
  route_name: string;
  route_level: string;
  bridge_number: string;
  bridge_name: string;
  bridge_stake?: string;
  function_type?: string;
  crossed_road_name?: string;
  crossed_road_stake?: string;
  design_load?: string;
  bridge_slope?: number;
  curve_radius?: number;
  completion_date?: string;
  design_unit?: string;
  construction_unit?: string;
  supervision_unit?: string;
  owner_unit?: string;
  maintenance_unit?: string;

  // 系统字段
  created_at?: string;
  updated_at?: string;
}

export class BridgeService {
  private static instance: BridgeService;

  private constructor() {}

  public static getInstance(): BridgeService {
    if (!BridgeService.instance) {
      BridgeService.instance = new BridgeService();
    }
    return BridgeService.instance;
  }

  public async find(id: string): Promise<Bridge | null> {
    const db = await getDatabase();
    const result = await db?.select<Bridge[]>(
      `SELECT * FROM bridge WHERE id = ?`,
      [id],
    );
    return result?.[0] || null;
  }

  public async findByBridgeNumber(bridgeNumber: string): Promise<Bridge | null> {
    const db = await getDatabase();
    const result = await db?.select<Bridge[]>(
      `SELECT * FROM bridge WHERE bridge_number = ?`,
      [bridgeNumber],
    );
    return result?.[0] || null;
  }

  public async page(options: {
    page?: number;
    pageSize?: number;
    bridgeName?: string;
    routeName?: string;
  } = {}): Promise<{ data: Bridge[]; total: number }> {
    const { page = 1, pageSize = 10, bridgeName, routeName } = options;
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (bridgeName) {
      whereClauses.push('bridge_name LIKE ?');
      params.push(`%${bridgeName}%`);
    }

    if (routeName) {
      whereClauses.push('route_name LIKE ?');
      params.push(`%${routeName}%`);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const db = await getDatabase();

    const [data, [total]] = await Promise.all([
      db?.select<Bridge[]>(
        `SELECT * FROM bridge 
         ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      ) || [],
      db?.select<Array<{ count: number }>>(
        `SELECT COUNT(*) as count FROM bridge ${whereClause}`,
        params,
      ) || [{ count: 0 }],
    ]);

    return {
      data: data || [],
      total: total?.count || 0,
    };
  }

  public async list(): Promise<Bridge[]> {
    const db = await getDatabase();
    const result = await db?.select<Bridge[]>(
      `SELECT * FROM bridge ORDER BY created_at DESC`,
    );
    return result || [];
  }

  public async options(projectId?: string): Promise<Bridge[]> {
    const db = await getDatabase();
    const sql = projectId === undefined
      ? `SELECT id, bridge_name FROM bridge ORDER BY created_at DESC`
      : `SELECT id, bridge_name FROM bridge WHERE project_id = ? ORDER BY created_at DESC`;

    const result = await db?.select<Bridge[]>(sql, projectId === undefined ? [] : [projectId]);
    return result || [];
  }

  public async create(bridge: Omit<Bridge, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string }> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db?.execute(
      `INSERT INTO bridge 
        (id, project_id, admin_code, route_code, route_name, route_level, 
         bridge_number, bridge_name, bridge_stake, function_type, 
         crossed_road_name, crossed_road_stake, design_load, 
         bridge_slope, curve_radius, completion_date, design_unit, 
         construction_unit, supervision_unit, owner_unit, maintenance_unit,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        bridge.project_id,
        bridge.admin_code,
        bridge.route_code,
        bridge.route_name,
        bridge.route_level,
        bridge.bridge_number,
        bridge.bridge_name,
        bridge.bridge_stake,
        bridge.function_type,
        bridge.crossed_road_name,
        bridge.crossed_road_stake,
        bridge.design_load,
        bridge.bridge_slope,
        bridge.curve_radius,
        bridge.completion_date,
        bridge.design_unit,
        bridge.construction_unit,
        bridge.supervision_unit,
        bridge.owner_unit,
        bridge.maintenance_unit,
        now,
        now,
      ],
    );

    return { id };
  }

  public async update(
    id: string,
    updates: Partial<Omit<Bridge, 'id' | 'created_at'>>,
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: any[] = [];

    // Add all fields that need to be updated
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    // Always update the updated_at timestamp
    fields.push('updated_at = ?');
    params.push(now);

    if (fields.length === 0) {
      return;
    }

    params.push(id);

    await db?.execute(
      `UPDATE bridge SET ${fields.join(', ')} WHERE id = ?`,
      params,
    );
  }

  public async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db?.execute(
      'DELETE FROM bridge WHERE id = ?',
      [id],
    );
  }
}

// Export a singleton instance for convenience
export const bridgeService = BridgeService.getInstance();
