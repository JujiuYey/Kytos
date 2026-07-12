/**
 * 项目成员表
 */
export const project_member = `
      CREATE TABLE IF NOT EXISTS project_member (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`;
