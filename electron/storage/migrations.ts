// 与具体数据库位置无关的 migration 和事务工具
import type { DatabaseSync } from 'node:sqlite';

export interface DatabaseMigration {
  name: string;
  migrate: (database: DatabaseSync) => void;
}

/** 按名称执行尚未应用的 migration，每一项都在独立事务中完成。 */
export function runDatabaseMigrations(
  database: DatabaseSync,
  migrations: readonly DatabaseMigration[],
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  const hasMigration = database.prepare('SELECT 1 FROM schema_migrations WHERE name = ?');
  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
  );

  for (const migration of migrations) {
    if (hasMigration.get(migration.name)) continue;
    runInTransaction(database, () => {
      migration.migrate(database);
      recordMigration.run(migration.name, new Date().toISOString());
    });
  }
}

/** 同步 SQLite 事务；异常会回滚并继续向上抛出。 */
export function runInTransaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error: unknown) {
    database.exec('ROLLBACK');
    throw error;
  }
}
