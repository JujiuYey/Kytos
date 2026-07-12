/**
 * 项目表
 */
export const project = `
      CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        leader TEXT,
        report_writer TEXT,
        report_reviewer TEXT,
        report_signer TEXT,
        status TEXT,
        entrust_unit_name TEXT,
        entrust_unit_address TEXT,
        entrust_unit_phone TEXT,
        entrust_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`;
