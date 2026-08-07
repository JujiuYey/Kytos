// 角色表情 SQLite 表结构
import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseMigration } from '../../storage/database';

function createCharacterExpressionTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE character_expression_records (
      character_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 4),
      prompt TEXT NOT NULL,
      resolution TEXT NOT NULL CHECK (resolution IN ('1k', '2k', '4k')),
      size TEXT NOT NULL CHECK (size IN ('1:1', '3:4', '4:5')),
      source TEXT NOT NULL CHECK (source IN ('generated', 'uploaded')),
      original_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (character_id, id)
    ) STRICT;

    CREATE TABLE character_expression_images (
      character_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      name TEXT,
      PRIMARY KEY (character_id, record_id, file_name),
      UNIQUE (character_id, record_id, position),
      FOREIGN KEY (character_id, record_id)
        REFERENCES character_expression_records (character_id, id)
        ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE character_expression_record_references (
      character_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      kind TEXT NOT NULL CHECK (kind IN ('visual', 'expression')),
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      PRIMARY KEY (character_id, record_id, position),
      UNIQUE (character_id, record_id, kind, task_id, file_name),
      FOREIGN KEY (character_id, record_id)
        REFERENCES character_expression_records (character_id, id)
        ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE character_expression_tasks (
      character_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 4),
      prompt TEXT NOT NULL,
      resolution TEXT NOT NULL CHECK (resolution IN ('1k', '2k', '4k')),
      size TEXT NOT NULL CHECK (size IN ('1:1', '3:4', '4:5')),
      status TEXT NOT NULL CHECK (status IN ('submitted', 'pending', 'processing', 'failed', 'cancelled')),
      progress REAL NOT NULL CHECK (progress BETWEEN 0 AND 100),
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (character_id, id)
    ) STRICT;

    CREATE TABLE character_expression_task_references (
      character_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      kind TEXT NOT NULL CHECK (kind IN ('visual', 'expression')),
      reference_task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      PRIMARY KEY (character_id, task_id, position),
      UNIQUE (character_id, task_id, kind, reference_task_id, file_name),
      FOREIGN KEY (character_id, task_id)
        REFERENCES character_expression_tasks (character_id, id)
        ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE character_expression_legacy_imports (
      character_id TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX character_expression_records_character_updated
      ON character_expression_records (character_id, updated_at DESC);
    CREATE INDEX character_expression_tasks_character_created
      ON character_expression_tasks (character_id, created_at DESC);
  `);
}

export const CHARACTER_EXPRESSION_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    migrate: createCharacterExpressionTables,
    name: '001_character_expression_tables',
  },
];
