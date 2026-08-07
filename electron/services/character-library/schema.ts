// 角色列表与角色草稿的 SQLite 表结构
import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseMigration } from '../../storage/database';

function createCharacterLibraryTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE character_drafts (
      character_id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      character_seed TEXT NOT NULL DEFAULT '',
      visual_summary TEXT NOT NULL DEFAULT '',
      age_and_build TEXT NOT NULL DEFAULT '',
      face_anchor TEXT NOT NULL DEFAULT '',
      hair_anchor TEXT NOT NULL DEFAULT '',
      default_outfit TEXT NOT NULL DEFAULT '',
      character_palette TEXT NOT NULL DEFAULT '',
      signature_items TEXT NOT NULL DEFAULT '',
      silhouette_markers TEXT NOT NULL DEFAULT '',
      visual_medium TEXT NOT NULL DEFAULT '',
      line_and_shape TEXT NOT NULL DEFAULT '',
      color_rules TEXT NOT NULL DEFAULT '',
      detail_density TEXT NOT NULL DEFAULT '',
      background_rules TEXT NOT NULL DEFAULT '',
      text_rules TEXT NOT NULL DEFAULT '',
      exclusions TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (character_id) REFERENCES characters (id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE character_library_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active_character_id TEXT NOT NULL,
      FOREIGN KEY (active_character_id) REFERENCES characters (id)
    ) STRICT;

    CREATE INDEX characters_updated_at ON characters (updated_at DESC);
  `);
}

export const CHARACTER_LIBRARY_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    migrate: createCharacterLibraryTables,
    name: '002_character_library_tables',
  },
];
