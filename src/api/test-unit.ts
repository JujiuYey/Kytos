import { getDatabase } from '@/services/database/database';
import { v4 as uuidv4 } from 'uuid';

export interface TestUnit {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  fax: string;
  postcode: string;
  createdAt?: string;
  updatedAt?: string;
}

export class TestUnitService {
  private static instance: TestUnitService;

  private constructor() {}

  public static getInstance(): TestUnitService {
    if (!TestUnitService.instance) {
      TestUnitService.instance = new TestUnitService();
    }
    return TestUnitService.instance;
  }

  public async find(id: string): Promise<TestUnit | null> {
    const db = await getDatabase();
    const result = await db?.select<TestUnit[]>(
      `SELECT 
        id,
        name,
        address,
        contact_phone as contactPhone,
        fax,
        postcode,
        created_at as createdAt,
        updated_at as updatedAt
       FROM test_units 
       WHERE id = ?`,
      [id],
    );
    return result?.[0] || null;
  }

  public async create(unit: Omit<TestUnit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db?.execute(
      `INSERT INTO test_units 
        (id, name, address, contact_phone, fax, postcode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, unit.name, unit.address, unit.contactPhone, unit.fax, unit.postcode, now, now],
    );

    return id;
  }

  public async update(
    id: string,
    unit: Partial<Omit<TestUnit, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];

    if (unit.name !== undefined) {
      fields.push('name = ?');
      values.push(unit.name);
    }
    if (unit.address !== undefined) {
      fields.push('address = ?');
      values.push(unit.address);
    }
    if (unit.contactPhone !== undefined) {
      fields.push('contact_phone = ?');
      values.push(unit.contactPhone);
    }
    if (unit.fax !== undefined) {
      fields.push('fax = ?');
      values.push(unit.fax);
    }
    if (unit.postcode !== undefined) {
      fields.push('postcode = ?');
      values.push(unit.postcode);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const query = `
      UPDATE test_units 
      SET ${fields.join(', ')}
      WHERE id = ?
    `;

    await db?.execute(query, values);
  }

  public async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db?.execute('DELETE FROM test_units WHERE id = ?', [id]);
  }

  public async list(): Promise<TestUnit[]> {
    const db = await getDatabase();
    const result = await db?.select<TestUnit[]>(
      `SELECT 
        id,
        name,
        address,
        contact_phone as contactPhone,
        fax,
        postcode,
        created_at as createdAt,
        updated_at as updatedAt
       FROM test_units 
       ORDER BY created_at DESC`,
    );
    return result || [];
  }

  public async page(options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ data: TestUnit[]; total: number }> {
    const { page = 1, pageSize = 10 } = options;
    const offset = (page - 1) * pageSize;

    const db = await getDatabase();

    const [data, [total]] = await Promise.all([
      db?.select<TestUnit[]>(
        `SELECT 
          id,
          name,
          address,
          contact_phone as contactPhone,
          fax,
          postcode,
          created_at as createdAt,
          updated_at as updatedAt
         FROM test_units 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [pageSize, offset],
      ) || [],
      db?.select<Array<{ count: number }>>(
        'SELECT COUNT(*) as count FROM test_units',
      ) || [{ count: 0 }],
    ]);

    return {
      data: data || [],
      total: total?.count || 0,
    };
  }
}

// Export a singleton instance for convenience
export const testUnitService = TestUnitService.getInstance();
