// 插画工作区的 SQLite 持久化与轻量不可变更新
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type {
  IllustrationTopic,
  IllustrationVersion,
  UploadedIllustration,
} from '../../../shared/illustration';
import { ID_PATTERN } from '../../constants';
import {
  getWorkspaceDatabase,
  runDatabaseMigrations,
  runInTransaction,
} from '../../storage/database';
import { getAssetUrl, parseIllustrationReferences, parseMessages } from './parsers';
import { ILLUSTRATION_MIGRATIONS } from './schema';
import type { StoredIllustrationWorkspace } from './types';

const initializedDatabases = new WeakSet<DatabaseSync>();
type DatabaseRow = Record<string, SQLOutputValue>;

export async function loadStore(): Promise<StoredIllustrationWorkspace> {
  const database = await getIllustrationDatabase();
  const topicRows = database
    .prepare('SELECT * FROM illustration_topics ORDER BY updated_at DESC')
    .all() as DatabaseRow[];
  const uploadRows = database
    .prepare('SELECT * FROM illustration_uploads ORDER BY created_at DESC')
    .all() as DatabaseRow[];
  return {
    topics: topicRows.map(row => readTopic(database, row)),
    uploads: uploadRows.map(readUpload),
    version: 4,
  };
}

export async function saveStore(store: StoredIllustrationWorkspace): Promise<void> {
  const database = await getIllustrationDatabase();
  runInTransaction(database, () => {
    database.exec('DELETE FROM illustration_topics; DELETE FROM illustration_uploads;');
    for (const topic of store.topics) saveTopic(database, topic);
    for (const upload of store.uploads) saveUpload(database, upload);
  });
}

export function replaceTopic(
  store: StoredIllustrationWorkspace,
  topic: IllustrationTopic,
): StoredIllustrationWorkspace {
  return {
    ...store,
    topics: [topic, ...store.topics.filter(item => item.id !== topic.id)].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}

export function removeTopic(
  store: StoredIllustrationWorkspace,
  topicId: string,
): StoredIllustrationWorkspace {
  return { ...store, topics: store.topics.filter(item => item.id !== topicId) };
}

export function removeUpload(
  store: StoredIllustrationWorkspace,
  uploadId: string,
): StoredIllustrationWorkspace {
  return { ...store, uploads: store.uploads.filter(item => item.id !== uploadId) };
}

export function requireTopic(
  store: StoredIllustrationWorkspace,
  topicId: string,
): IllustrationTopic {
  if (!ID_PATTERN.test(topicId)) throw new Error('插画主题编号无效');
  const topic = store.topics.find(item => item.id === topicId);
  if (!topic) throw new Error('未找到插画主题');
  return topic;
}

async function getIllustrationDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, ILLUSTRATION_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}

function readTopic(database: DatabaseSync, row: DatabaseRow): IllustrationTopic {
  const id = readText(row.id);
  const versionRows = database
    .prepare(
      `SELECT * FROM illustration_versions
       WHERE topic_id = ?
       ORDER BY version_number DESC`,
    )
    .all(id) as DatabaseRow[];
  return {
    brief: {
      action: readText(row.brief_action),
      composition: readText(row.brief_composition),
      details: readText(row.brief_details),
      environment: readText(row.brief_environment),
      finalPrompt: readText(row.brief_final_prompt),
      mood: readText(row.brief_mood),
      style: readText(row.brief_style),
      subject: readText(row.brief_subject),
    },
    createdAt: readText(row.created_at),
    id,
    messages: parseMessages(parseJson(row.messages_json)),
    ready: readBoolean(row.ready),
    references: parseIllustrationReferences(parseJson(row.references_json)),
    title: readText(row.title),
    updatedAt: readText(row.updated_at),
    versions: versionRows.map(version => readVersion(database, id, version)),
  };
}

function readVersion(
  database: DatabaseSync,
  topicId: string,
  row: DatabaseRow,
): IllustrationVersion {
  const id = readText(row.id);
  const imageRows = database
    .prepare(
      `SELECT file_name, mime_type, name
       FROM illustration_version_images
       WHERE topic_id = ? AND version_id = ?
       ORDER BY position`,
    )
    .all(topicId, id) as DatabaseRow[];
  const baseVersionId = nullableText(row.base_version_id);
  const baseFileName = nullableText(row.base_file_name);
  return {
    baseVersion:
      baseVersionId && baseFileName ? { fileName: baseFileName, versionId: baseVersionId } : null,
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
    resolution: readText(row.resolution) as IllustrationVersion['resolution'],
    references: parseIllustrationReferences(parseJson(row.references_json)),
    size: readText(row.size) as IllustrationVersion['size'],
    status: readText(row.status) as IllustrationVersion['status'],
    updatedAt: readText(row.updated_at),
    versionNumber: readNumber(row.version_number),
  };
}

function readUpload(row: DatabaseRow): UploadedIllustration {
  const fileName = readText(row.file_name);
  return {
    createdAt: readText(row.created_at),
    fileName,
    id: readText(row.id),
    mimeType: readText(row.mime_type),
    originalName: readText(row.original_name),
    size: readNumber(row.size),
    url: getAssetUrl(fileName),
  };
}

function saveTopic(database: DatabaseSync, topic: IllustrationTopic): void {
  database
    .prepare(
      `INSERT INTO illustration_topics (
         id, title, ready, use_character, references_json, messages_json,
         brief_action, brief_composition, brief_details, brief_environment,
         brief_final_prompt, brief_mood, brief_style, brief_subject, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      topic.id,
      topic.title,
      Number(topic.ready),
      Number(topic.references.some(reference => reference.kind.startsWith('character-'))),
      JSON.stringify(topic.references),
      JSON.stringify(topic.messages),
      topic.brief.action,
      topic.brief.composition,
      topic.brief.details,
      topic.brief.environment,
      topic.brief.finalPrompt,
      topic.brief.mood,
      topic.brief.style,
      topic.brief.subject,
      topic.createdAt,
      topic.updatedAt,
    );
  for (const version of topic.versions) saveVersion(database, topic.id, version);
}

function saveVersion(database: DatabaseSync, topicId: string, version: IllustrationVersion): void {
  database
    .prepare(
      `INSERT INTO illustration_versions (
         topic_id, id, version_number, base_version_id, base_file_name, prompt, resolution,
         size, status, progress, error_message, use_character, references_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      topicId,
      version.id,
      version.versionNumber,
      version.baseVersion?.versionId ?? null,
      version.baseVersion?.fileName ?? null,
      version.prompt,
      version.resolution,
      version.size,
      version.status,
      version.progress,
      version.errorMessage,
      Number(version.references.some(reference => reference.kind.startsWith('character-'))),
      JSON.stringify(version.references),
      version.createdAt,
      version.updatedAt,
    );
  const insertImage = database.prepare(
    `INSERT INTO illustration_version_images (
       topic_id, version_id, position, file_name, mime_type, name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  version.images.forEach((image, position) => {
    insertImage.run(
      topicId,
      version.id,
      position,
      image.fileName,
      image.mimeType,
      image.name ?? null,
    );
  });
}

function saveUpload(database: DatabaseSync, upload: UploadedIllustration): void {
  database
    .prepare(
      `INSERT INTO illustration_uploads (
         id, file_name, original_name, mime_type, size, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      upload.id,
      upload.fileName,
      upload.originalName,
      upload.mimeType,
      upload.size,
      upload.createdAt,
    );
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
