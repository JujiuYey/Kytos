// 故事、分镜及分镜版本的 SQLite 表结构
import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseMigration } from '../../storage/database';

function createStoryTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      character_ids_json TEXT NOT NULL DEFAULT '[]',
      key_shot_id TEXT,
      resolution TEXT NOT NULL CHECK (resolution IN ('1k', '2k', '4k')),
      size TEXT NOT NULL CHECK (size IN ('1:1', '3:4', '4:5', '16:9', '9:16')),
      story_ready INTEGER NOT NULL CHECK (story_ready IN (0, 1)),
      storyboard_ready INTEGER NOT NULL CHECK (storyboard_ready IN (0, 1)),
      storyboard_stale INTEGER NOT NULL CHECK (storyboard_stale IN (0, 1)),
      messages_json TEXT NOT NULL,
      draft_conflict TEXT NOT NULL,
      draft_ending TEXT NOT NULL,
      draft_goal TEXT NOT NULL,
      draft_premise TEXT NOT NULL,
      draft_setting TEXT NOT NULL,
      draft_summary TEXT NOT NULL,
      draft_tone TEXT NOT NULL,
      draft_turning_point TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      references_json TEXT NOT NULL DEFAULT '[]'
    ) STRICT;

    CREATE TABLE story_shots (
      story_id TEXT NOT NULL,
      id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 1),
      selected_version_id TEXT,
      image_stale INTEGER NOT NULL CHECK (image_stale IN (0, 1)),
      action TEXT NOT NULL,
      composition TEXT NOT NULL,
      continuity TEXT NOT NULL,
      emotion TEXT NOT NULL,
      final_prompt TEXT NOT NULL,
      narration TEXT NOT NULL,
      purpose TEXT NOT NULL,
      scene TEXT NOT NULL,
      title TEXT NOT NULL,
      references_json TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (story_id, id),
      UNIQUE (story_id, position),
      FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE story_shot_versions (
      story_id TEXT NOT NULL,
      shot_id TEXT NOT NULL,
      id TEXT NOT NULL,
      version_number INTEGER NOT NULL CHECK (version_number >= 1),
      base_shot_id TEXT,
      base_version_id TEXT,
      base_file_name TEXT,
      continuity_shot_id TEXT,
      continuity_version_id TEXT,
      continuity_file_name TEXT,
      prompt TEXT NOT NULL,
      resolution TEXT NOT NULL CHECK (resolution IN ('1k', '2k', '4k')),
      size TEXT NOT NULL CHECK (size IN ('1:1', '3:4', '4:5', '16:9', '9:16')),
      status TEXT NOT NULL CHECK (
        status IN ('submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled')
      ),
      progress REAL NOT NULL CHECK (progress BETWEEN 0 AND 100),
      error_message TEXT,
      references_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (story_id, shot_id, id),
      FOREIGN KEY (story_id, shot_id) REFERENCES story_shots (story_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE story_shot_version_images (
      story_id TEXT NOT NULL,
      shot_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      name TEXT,
      PRIMARY KEY (story_id, shot_id, version_id, file_name),
      UNIQUE (story_id, shot_id, version_id, position),
      FOREIGN KEY (story_id, shot_id, version_id)
        REFERENCES story_shot_versions (story_id, shot_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE TABLE story_shot_version_character_references (
      story_id TEXT NOT NULL,
      shot_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      PRIMARY KEY (story_id, shot_id, version_id, position),
      FOREIGN KEY (story_id, shot_id, version_id)
        REFERENCES story_shot_versions (story_id, shot_id, id) ON DELETE CASCADE
    ) STRICT;

    CREATE INDEX stories_updated ON stories (updated_at DESC);
  `);
}

export const STORY_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    migrate: createStoryTables,
    name: '006_story_tables',
  },
  {
    migrate: database => {
      for (const statement of [
        "ALTER TABLE stories ADD COLUMN references_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE story_shots ADD COLUMN references_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE story_shot_versions ADD COLUMN references_json TEXT NOT NULL DEFAULT '[]'",
      ]) {
        try {
          database.exec(statement);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
            throw error;
          }
        }
      }
    },
    name: '010_story_reference_sets',
  },
  {
    migrate: database => {
      try {
        database.exec(
          "ALTER TABLE stories ADD COLUMN character_ids_json TEXT NOT NULL DEFAULT '[]'",
        );
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('duplicate column name')) {
          throw error;
        }
      }
    },
    name: '011_story_characters',
  },
];
