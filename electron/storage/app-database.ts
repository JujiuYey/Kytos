// 不随工作区切换的应用级 SQLite 数据库
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { app } from 'electron';
import { DEFAULT_CHAT_MODEL, DEFAULT_DEEPSEEK_MODEL } from '../../shared/chat-model';
import { DEFAULT_IMAGE_MODEL } from '../../shared/image-model';
import { runDatabaseMigrations, type DatabaseMigration } from './migrations';

const DATABASE_FILE_NAME = 'kytos-app.sqlite3';
let applicationDatabase: DatabaseSync | null = null;

export const APPLICATION_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    name: '001_application_settings_and_credentials',
    migrate(database) {
      database.exec(`
        CREATE TABLE application_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          workspace_path TEXT,
          theme TEXT NOT NULL CHECK (theme IN ('dark', 'light', 'system')),
          deepseek_model TEXT NOT NULL,
          fast_model TEXT NOT NULL,
          general_model TEXT NOT NULL,
          image_model TEXT NOT NULL
        ) STRICT;

        CREATE TABLE credentials (
          service TEXT PRIMARY KEY CHECK (service IN ('apimart', 'deepseek', 'minimax')),
          encrypted_value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
      `);
      database
        .prepare(
          `INSERT INTO application_settings (
             id, workspace_path, theme, deepseek_model, fast_model, general_model, image_model
           ) VALUES (1, NULL, 'system', ?, 'deepseek-v4-flash', ?, ?)`,
        )
        .run(DEFAULT_DEEPSEEK_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL);
    },
  },
];

/** 返回应用级数据库连接，并确保基础表结构已经存在。 */
export function getApplicationDatabase(): DatabaseSync {
  if (applicationDatabase) return applicationDatabase;
  const filePath = path.join(app.getPath('userData'), DATABASE_FILE_NAME);
  const databaseExisted = existsSync(filePath);
  const database = new DatabaseSync(filePath, {
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });
  if (!databaseExisted) chmodSync(filePath, 0o600);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  runDatabaseMigrations(database, APPLICATION_MIGRATIONS);
  applicationDatabase = database;
  return database;
}
