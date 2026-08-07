// 插画主题、版本、图片、引用与上传记录的 SQLite 表结构
import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseMigration } from '../../storage/database';

function createIllustrationTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE illustration_topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      ready INTEGER NOT NULL CHECK (ready IN (0, 1)),
      use_character INTEGER NOT NULL CHECK (use_character IN (0, 1)),
      messages_json TEXT NOT NULL,
      brief_action TEXT NOT NULL,
      brief_composition TEXT NOT NULL,
      brief_details TEXT NOT NULL,
      brief_environment TEXT NOT NULL,
      brief_final_prompt TEXT NOT NULL,
      brief_mood TEXT NOT NULL,
      brief_style TEXT NOT NULL,
      brief_subject TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE illustration_versions (
      topic_id TEXT NOT NULL,
      id TEXT NOT NULL,
      version_number INTEGER NOT NULL CHECK (version_number >= 1),
      base_version_id TEXT,
      base_file_name TEXT,
      prompt TEXT NOT NULL,
      resolution TEXT NOT NULL CHECK (resolution IN ('1k', '2k', '4k')),
      size TEXT NOT NULL CHECK (size IN ('1:1', '3:4', '4:5', '16:9', '9:16')),
      status TEXT NOT NULL CHECK (
        status IN ('submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled')
      ),
      progress REAL NOT NULL CHECK (progress BETWEEN 0 AND 100),
      error_message TEXT,
      use_character INTEGER NOT NULL CHECK (use_character IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (topic_id, id),
      FOREIGN KEY (topic_id) REFERENCES illustration_topics (id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE illustration_version_images (
      topic_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      name TEXT,
      PRIMARY KEY (topic_id, version_id, file_name),
      UNIQUE (topic_id, version_id, position),
      FOREIGN KEY (topic_id, version_id)
        REFERENCES illustration_versions (topic_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE illustration_version_character_references (
      topic_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      kind TEXT NOT NULL CHECK (kind IN ('visual', 'expression')),
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      PRIMARY KEY (topic_id, version_id, position),
      FOREIGN KEY (topic_id, version_id)
        REFERENCES illustration_versions (topic_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE illustration_uploads (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL CHECK (size > 0),
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX illustration_topics_updated ON illustration_topics (updated_at DESC);
  `);
}

export const ILLUSTRATION_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    migrate: createIllustrationTables,
    name: '005_illustration_tables',
  },
];
