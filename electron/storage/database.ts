// 工作区 SQLite 连接与通用 migration 执行器
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getWorkspaceDirectory } from '../services/workspace';

const DATABASE_FILE_NAME = 'kytos.sqlite3';

export interface DatabaseMigration {
  name: string;
  migrate: (database: DatabaseSync) => void;
}

interface WorkspaceDatabase {
  database: DatabaseSync;
  filePath: string;
}

let activeWorkspaceDatabase: WorkspaceDatabase | null = null;

/** 返回当前工作区的数据库连接；切换工作区时关闭旧连接。 */
export async function getWorkspaceDatabase(): Promise<DatabaseSync> {
  const workspacePath = await getWorkspaceDirectory();
  const filePath = path.join(workspacePath, DATABASE_FILE_NAME);
  if (activeWorkspaceDatabase?.filePath === filePath) {
    return activeWorkspaceDatabase.database;
  }

  activeWorkspaceDatabase?.database.close();
  const databaseExisted = existsSync(filePath);
  const database = new DatabaseSync(filePath, {
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });
  if (!databaseExisted) {
    chmodSync(filePath, 0o600);
  }
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  activeWorkspaceDatabase = { database, filePath };
  return database;
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
