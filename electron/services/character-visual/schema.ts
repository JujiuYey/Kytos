// 角色视觉记录、图片、引用与正式资产的 SQLite 表结构
import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseMigration } from '../../storage/database';

function createCharacterVisualTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE character_visual_records (
      character_id TEXT NOT NULL,
      id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('portrait', 'sheet')),
      name TEXT NOT NULL,
      count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 4),
      prompt TEXT NOT NULL,
      resolution TEXT NOT NULL CHECK (resolution IN ('1k', '2k', '4k')),
      size TEXT NOT NULL CHECK (size IN ('2:3', '3:4', '4:5', '1:1', '16:9')),
      source TEXT NOT NULL CHECK (source IN ('generated', 'uploaded')),
      status TEXT NOT NULL CHECK (
        status IN ('submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled')
      ),
      progress REAL NOT NULL CHECK (progress BETWEEN 0 AND 100),
      original_name TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (character_id, id)
    ) STRICT;

    CREATE TABLE character_visual_images (
      character_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      name TEXT,
      PRIMARY KEY (character_id, record_id, file_name),
      UNIQUE (character_id, record_id, position),
      FOREIGN KEY (character_id, record_id)
        REFERENCES character_visual_records (character_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE character_visual_references (
      character_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      kind TEXT NOT NULL CHECK (kind IN ('portrait', 'sheet')),
      reference_record_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      PRIMARY KEY (character_id, record_id, position),
      FOREIGN KEY (character_id, record_id)
        REFERENCES character_visual_records (character_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE character_official_visuals (
      character_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      kind TEXT NOT NULL CHECK (kind IN ('portrait', 'sheet')),
      record_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      PRIMARY KEY (character_id, record_id, file_name),
      UNIQUE (character_id, position),
      FOREIGN KEY (character_id, record_id)
        REFERENCES character_visual_records (character_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX character_visual_records_character_created
      ON character_visual_records (character_id, created_at DESC);
  `);
}

export const CHARACTER_VISUAL_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    migrate: createCharacterVisualTables,
    name: '004_character_visual_tables',
  },
];
