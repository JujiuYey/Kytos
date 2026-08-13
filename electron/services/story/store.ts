// 故事工作区的 SQLite 持久化
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type {
  StoryProject,
  StoryShot,
  StoryShotVersion,
  StoryVersionReference,
} from '../../../shared/story';
import {
  getWorkspaceDatabase,
  runDatabaseMigrations,
  runInTransaction,
} from '../../storage/database';
import { getAssetUrl, parseCharacterIds, parseMessages, parseReferences } from './parsers';
import { STORY_MIGRATIONS } from './schema';
import type { StoredStoryWorkspace } from './types';

const STORE_VERSION = 3;
const initializedDatabases = new WeakSet<DatabaseSync>();
type DatabaseRow = Record<string, SQLOutputValue>;

export async function loadStore(): Promise<StoredStoryWorkspace> {
  const database = await getStoryDatabase();
  const rows = database
    .prepare('SELECT * FROM stories ORDER BY updated_at DESC')
    .all() as DatabaseRow[];
  return { stories: rows.map(row => readStory(database, row)), version: STORE_VERSION };
}

export async function saveStore(store: StoredStoryWorkspace): Promise<void> {
  const database = await getStoryDatabase();
  runInTransaction(database, () => {
    database.exec('DELETE FROM stories;');
    for (const story of store.stories) saveStory(database, story);
  });
}

export function replaceStory(
  store: StoredStoryWorkspace,
  story: StoryProject,
): StoredStoryWorkspace {
  return {
    ...store,
    stories: [story, ...store.stories.filter(item => item.id !== story.id)].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}

async function getStoryDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, STORY_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}

function readStory(database: DatabaseSync, row: DatabaseRow): StoryProject {
  const id = readText(row.id);
  const shotRows = database
    .prepare('SELECT * FROM story_shots WHERE story_id = ? ORDER BY position')
    .all(id) as DatabaseRow[];
  return {
    characterIds: parseCharacterIds(parseJson(row.character_ids_json)),
    createdAt: readText(row.created_at),
    draft: {
      conflict: readText(row.draft_conflict),
      ending: readText(row.draft_ending),
      goal: readText(row.draft_goal),
      premise: readText(row.draft_premise),
      setting: readText(row.draft_setting),
      summary: readText(row.draft_summary),
      tone: readText(row.draft_tone),
      turningPoint: readText(row.draft_turning_point),
    },
    id,
    keyShotId: nullableText(row.key_shot_id),
    messages: parseMessages(parseJson(row.messages_json)),
    resolution: readText(row.resolution) as StoryProject['resolution'],
    shots: shotRows.map(shot => readShot(database, id, shot)),
    size: readText(row.size) as StoryProject['size'],
    storyboardReady: readBoolean(row.storyboard_ready),
    storyboardStale: readBoolean(row.storyboard_stale),
    storyReady: readBoolean(row.story_ready),
    title: readText(row.title),
    updatedAt: readText(row.updated_at),
    references: parseReferences(parseJson(row.references_json)),
  };
}

function readShot(database: DatabaseSync, storyId: string, row: DatabaseRow): StoryShot {
  const id = readText(row.id);
  const versionRows = database
    .prepare(
      `SELECT * FROM story_shot_versions
       WHERE story_id = ? AND shot_id = ?
       ORDER BY version_number DESC`,
    )
    .all(storyId, id) as DatabaseRow[];
  return {
    action: readText(row.action),
    composition: readText(row.composition),
    continuity: readText(row.continuity),
    emotion: readText(row.emotion),
    finalPrompt: readText(row.final_prompt),
    id,
    imageStale: readBoolean(row.image_stale),
    narration: readText(row.narration),
    order: readNumber(row.position),
    purpose: readText(row.purpose),
    scene: readText(row.scene),
    selectedVersionId: nullableText(row.selected_version_id),
    title: readText(row.title),
    references: parseReferences(parseJson(row.references_json)),
    versions: versionRows.map(version => readVersion(database, storyId, id, version)),
  };
}

function readVersion(
  database: DatabaseSync,
  storyId: string,
  shotId: string,
  row: DatabaseRow,
): StoryShotVersion {
  const id = readText(row.id);
  const imageRows = database
    .prepare(
      `SELECT file_name, mime_type, name
       FROM story_shot_version_images
       WHERE story_id = ? AND shot_id = ? AND version_id = ?
       ORDER BY position`,
    )
    .all(storyId, shotId, id) as DatabaseRow[];
  const referenceRows = database
    .prepare(
      `SELECT task_id, file_name
       FROM story_shot_version_character_references
       WHERE story_id = ? AND shot_id = ? AND version_id = ?
       ORDER BY position`,
    )
    .all(storyId, shotId, id) as DatabaseRow[];
  return {
    baseVersion: readVersionReference(row, 'base'),
    characterReferences: referenceRows.map(reference => ({
      fileName: readText(reference.file_name),
      taskId: readText(reference.task_id),
    })),
    continuityVersion: readVersionReference(row, 'continuity'),
    createdAt: readText(row.created_at),
    errorMessage: nullableText(row.error_message),
    id,
    images: imageRows.map(image => ({
      fileName: readText(image.file_name),
      mimeType: readText(image.mime_type),
      ...(typeof image.name === 'string' ? { name: image.name } : {}),
      url: getAssetUrl(readText(image.file_name)),
    })),
    progress: readNumber(row.progress),
    prompt: readText(row.prompt),
    resolution: readText(row.resolution) as StoryShotVersion['resolution'],
    references: parseReferences(parseJson(row.references_json)),
    size: readText(row.size) as StoryShotVersion['size'],
    status: readText(row.status) as StoryShotVersion['status'],
    updatedAt: readText(row.updated_at),
    versionNumber: readNumber(row.version_number),
  };
}

function readVersionReference(
  row: DatabaseRow,
  prefix: 'base' | 'continuity',
): StoryVersionReference | null {
  const shotId = nullableText(row[`${prefix}_shot_id`]);
  const versionId = nullableText(row[`${prefix}_version_id`]);
  const fileName = nullableText(row[`${prefix}_file_name`]);
  return shotId && versionId && fileName ? { fileName, shotId, versionId } : null;
}

function saveStory(database: DatabaseSync, story: StoryProject): void {
  database
    .prepare(
      `INSERT INTO stories (
         id, title, character_ids_json, key_shot_id, resolution, size, story_ready, storyboard_ready,
         storyboard_stale, messages_json, draft_conflict, draft_ending, draft_goal,
         draft_premise, draft_setting, draft_summary, draft_tone, draft_turning_point,
         created_at, updated_at, references_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      story.id,
      story.title,
      JSON.stringify(story.characterIds),
      story.keyShotId,
      story.resolution,
      story.size,
      Number(story.storyReady),
      Number(story.storyboardReady),
      Number(story.storyboardStale),
      JSON.stringify(story.messages),
      story.draft.conflict,
      story.draft.ending,
      story.draft.goal,
      story.draft.premise,
      story.draft.setting,
      story.draft.summary,
      story.draft.tone,
      story.draft.turningPoint,
      story.createdAt,
      story.updatedAt,
      JSON.stringify(story.references),
    );
  for (const shot of story.shots) saveShot(database, story.id, shot);
}

function saveShot(database: DatabaseSync, storyId: string, shot: StoryShot): void {
  database
    .prepare(
      `INSERT INTO story_shots (
         story_id, id, position, selected_version_id, image_stale, action, composition,
         continuity, emotion, final_prompt, narration, purpose, scene, title, references_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      storyId,
      shot.id,
      shot.order,
      shot.selectedVersionId,
      Number(shot.imageStale),
      shot.action,
      shot.composition,
      shot.continuity,
      shot.emotion,
      shot.finalPrompt,
      shot.narration,
      shot.purpose,
      shot.scene,
      shot.title,
      JSON.stringify(shot.references),
    );
  for (const version of shot.versions) saveVersion(database, storyId, shot.id, version);
}

function saveVersion(
  database: DatabaseSync,
  storyId: string,
  shotId: string,
  version: StoryShotVersion,
): void {
  database
    .prepare(
      `INSERT INTO story_shot_versions (
         story_id, shot_id, id, version_number,
         base_shot_id, base_version_id, base_file_name,
         continuity_shot_id, continuity_version_id, continuity_file_name,
         prompt, resolution, size, status, progress, error_message, created_at, updated_at, references_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      storyId,
      shotId,
      version.id,
      version.versionNumber,
      version.baseVersion?.shotId ?? null,
      version.baseVersion?.versionId ?? null,
      version.baseVersion?.fileName ?? null,
      version.continuityVersion?.shotId ?? null,
      version.continuityVersion?.versionId ?? null,
      version.continuityVersion?.fileName ?? null,
      version.prompt,
      version.resolution,
      version.size,
      version.status,
      version.progress,
      version.errorMessage,
      version.createdAt,
      version.updatedAt,
      JSON.stringify(version.references),
    );
  const insertImage = database.prepare(
    `INSERT INTO story_shot_version_images (
       story_id, shot_id, version_id, position, file_name, mime_type, name
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  version.images.forEach((image, position) => {
    insertImage.run(
      storyId,
      shotId,
      version.id,
      position,
      image.fileName,
      image.mimeType,
      image.name ?? null,
    );
  });
  const insertReference = database.prepare(
    `INSERT INTO story_shot_version_character_references (
       story_id, shot_id, version_id, position, task_id, file_name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  version.characterReferences.forEach((reference, position) => {
    insertReference.run(
      storyId,
      shotId,
      version.id,
      position,
      reference.taskId,
      reference.fileName,
    );
  });
}

function parseJson(value: SQLOutputValue | undefined): unknown {
  if (typeof value !== 'string') return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function readText(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: SQLOutputValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: SQLOutputValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}

function readBoolean(value: SQLOutputValue | undefined): boolean {
  return value === 1;
}
