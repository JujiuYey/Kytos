// 工作区 SQLite 连接与通用 migration 执行器
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getWorkspaceDirectory } from '../services/workspace';

export { runDatabaseMigrations, runInTransaction, type DatabaseMigration } from './migrations';

const DATABASE_FILE_NAME = 'kytos.sqlite3';

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
