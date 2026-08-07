// 角色创建候选图任务的 SQLite 持久化
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import {
  getWorkspaceDatabase,
  runDatabaseMigrations,
  runInTransaction,
} from '../../storage/database';
import { getAssetUrl } from './parsers';
import { CHARACTER_CREATE_MIGRATIONS } from './schema';
import type { StoredGeneration, StoredGenerationStore } from './types';

const STORE_VERSION = 1;
const initializedDatabases = new WeakSet<DatabaseSync>();
type DatabaseRow = Record<string, SQLOutputValue>;

export async function loadStore(): Promise<StoredGenerationStore> {
  const database = await getGenerationDatabase();
  const rows = database
    .prepare('SELECT * FROM character_create_generations ORDER BY created_at DESC')
    .all() as DatabaseRow[];
  return {
    generations: rows.map(row => readGeneration(database, row)),
    version: STORE_VERSION,
  };
}

export async function saveStore(store: StoredGenerationStore): Promise<void> {
  const database = await getGenerationDatabase();
  runInTransaction(database, () => {
    const ids = new Set(store.generations.map(generation => generation.id));
    for (const generation of store.generations) saveGeneration(database, generation);
    const existing = database
      .prepare('SELECT id FROM character_create_generations')
      .all() as DatabaseRow[];
    for (const row of existing) {
      const id = readText(row.id);
      if (!ids.has(id)) {
        database.prepare('DELETE FROM character_create_generations WHERE id = ?').run(id);
      }
    }
  });
}

export function replaceGeneration(
  store: StoredGenerationStore,
  generation: StoredGeneration,
): StoredGenerationStore {
  return {
    ...store,
    generations: [generation, ...store.generations.filter(item => item.id !== generation.id)],
  };
}

export function removeGeneration(
  store: StoredGenerationStore,
  generationId: string,
): StoredGenerationStore {
  return {
    ...store,
    generations: store.generations.filter(item => item.id !== generationId),
  };
}

async function getGenerationDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, CHARACTER_CREATE_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}

function readGeneration(database: DatabaseSync, row: DatabaseRow): StoredGeneration {
  const images = (
    database
      .prepare(
        `SELECT file_name, mime_type, name
         FROM character_create_generation_images
         WHERE generation_id = ?
         ORDER BY position`,
      )
      .all(readText(row.id)) as DatabaseRow[]
  ).map(image => ({
    fileName: readText(image.file_name),
    mimeType: readText(image.mime_type),
    ...(typeof image.name === 'string' ? { name: image.name } : {}),
    url: getAssetUrl(readText(image.file_name)),
  }));
  return {
    createdAt: readText(row.created_at),
    errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
    id: readText(row.id),
    image: images[0] ?? null,
    images,
    progress: readNumber(row.progress),
    status: readText(row.status) as StoredGeneration['status'],
    taskId: readText(row.remote_task_id),
    updatedAt: readText(row.updated_at),
  };
}

function saveGeneration(database: DatabaseSync, generation: StoredGeneration): void {
  database
    .prepare(
      `INSERT INTO character_create_generations (
         id, remote_task_id, status, progress, error_message, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         remote_task_id = excluded.remote_task_id,
         status = excluded.status,
         progress = excluded.progress,
         error_message = excluded.error_message,
         updated_at = excluded.updated_at`,
    )
    .run(
      generation.id,
      generation.taskId,
      generation.status,
      generation.progress,
      generation.errorMessage,
      generation.createdAt,
      generation.updatedAt,
    );
  database
    .prepare('DELETE FROM character_create_generation_images WHERE generation_id = ?')
    .run(generation.id);
  const insertImage = database.prepare(
    `INSERT INTO character_create_generation_images (
       generation_id, position, file_name, mime_type, name
     ) VALUES (?, ?, ?, ?, ?)`,
  );
  generation.images.forEach((image, position) => {
    insertImage.run(generation.id, position, image.fileName, image.mimeType, image.name ?? null);
  });
}

function readText(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: SQLOutputValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}
