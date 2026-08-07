// 角色创建候选图任务的 SQLite 表结构
import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseMigration } from '../../storage/database';

function createCharacterCreateTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE character_create_generations (
      id TEXT PRIMARY KEY,
      remote_task_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled')
      ),
      progress REAL NOT NULL CHECK (progress BETWEEN 0 AND 100),
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE character_create_generation_images (
      generation_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      name TEXT,
      PRIMARY KEY (generation_id, file_name),
      UNIQUE (generation_id, position),
      FOREIGN KEY (generation_id) REFERENCES character_create_generations (id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX character_create_generations_created
      ON character_create_generations (created_at DESC);
  `);
}

export const CHARACTER_CREATE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    migrate: createCharacterCreateTables,
    name: '003_character_create_tables',
  },
];
