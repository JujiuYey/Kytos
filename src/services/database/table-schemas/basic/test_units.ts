/**
 * 检测单位表
 */
export const test_units = `
      CREATE TABLE IF NOT EXISTS test_units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        contact_phone TEXT,
        fax TEXT,
        postcode TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`;
