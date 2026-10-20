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
  {
    name: '002_provider_account_snapshots',
    migrate(database) {
      database.exec(`
        CREATE TABLE provider_account_snapshots (
          service TEXT PRIMARY KEY CHECK (service IN ('apimart', 'deepseek', 'minimax')),
          payload TEXT NOT NULL,
          fetched_at TEXT NOT NULL
        ) STRICT;
      `);
    },
  },
  {
    name: '003_provider_account_snapshots_by_kind',
    migrate(database) {
      // 余额与模型拆成两类各自缓存，旧的单行结构重建一次
      database.exec(`
        DROP TABLE IF EXISTS provider_account_snapshots;

        CREATE TABLE provider_account_snapshots (
          service TEXT NOT NULL CHECK (service IN ('apimart', 'deepseek', 'minimax')),
          kind TEXT NOT NULL CHECK (kind IN ('balance', 'models')),
          payload TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          PRIMARY KEY (service, kind)
        ) STRICT;
      `);
    },
  },
  {
    name: '004_provider_account_snapshots_usage_kind',
    migrate(database) {
      // kind 白名单加入 usage；SQLite 无法修改 CHECK，重建并保留既有缓存
      database.exec(`
        CREATE TABLE provider_account_snapshots_new (
          service TEXT NOT NULL CHECK (service IN ('apimart', 'deepseek', 'minimax')),
          kind TEXT NOT NULL CHECK (kind IN ('balance', 'models', 'usage')),
          payload TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          PRIMARY KEY (service, kind)
        ) STRICT;

        INSERT INTO provider_account_snapshots_new (service, kind, payload, fetched_at)
          SELECT service, kind, payload, fetched_at FROM provider_account_snapshots;

        DROP TABLE provider_account_snapshots;
        ALTER TABLE provider_account_snapshots_new RENAME TO provider_account_snapshots;
      `);
    },
  },
  {
    name: '005_minimax_removed',
    migrate(database) {
      // MiniMax 厂商已下线，遗留的凭据与账户缓存一并清除；
      // 应用设置里的 MiniMax 模型值由读取路径按 isChatModel 校验自动回落默认值
      database.prepare('DELETE FROM credentials WHERE service = ?').run('minimax');
      database.prepare('DELETE FROM provider_account_snapshots WHERE service = ?').run('minimax');
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
