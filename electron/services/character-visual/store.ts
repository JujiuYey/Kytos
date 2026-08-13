// 角色视觉工作区的 SQLite 持久化与 legacy/public 模型转换
import path from 'node:path';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { isPlainObject } from 'es-toolkit';
import { loadStore as loadCharacterStore } from '../character-library/store';
import {
  getWorkspaceDatabase,
  runDatabaseMigrations,
  runInTransaction,
} from '../../storage/database';
import { LEGACY_ACTION_ASSET_DIRECTORY, LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY } from './constants';
import { ID_PATTERN } from '../../constants';
import { getCharacterAssetUrl, selectionKey } from './parsers';
import { CHARACTER_VISUAL_MIGRATIONS } from './schema';
import type {
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualWorkspaceState,
} from '../../../shared/character-visual';
import type {
  LegacyActionRecord,
  LegacyReferenceBoardRecord,
  LegacyVisualAssetSelection,
  StoredVisualWorkspace,
  VisualAssetMatch,
} from './types';

const STORE_VERSION = 3;
const initializedDatabases = new WeakSet<DatabaseSync>();
type DatabaseRow = Record<string, SQLOutputValue>;

export async function loadVisualStore(characterId?: string): Promise<StoredVisualWorkspace> {
  const resolvedCharacterId = await getCharacterId(characterId);
  const database = await getVisualDatabase();
  const rows = database
    .prepare(
      `SELECT * FROM character_visual_records
       WHERE character_id = ?
       ORDER BY created_at DESC`,
    )
    .all(resolvedCharacterId) as DatabaseRow[];
  const records: LegacyActionRecord[] = [];
  const sheetRecords: LegacyReferenceBoardRecord[] = [];
  for (const row of rows) {
    const record = readVisualRecord(database, resolvedCharacterId, row);
    if (readText(row.kind) === 'sheet') sheetRecords.push(record as LegacyReferenceBoardRecord);
    else records.push(record as LegacyActionRecord);
  }
  const store: StoredVisualWorkspace = {
    anchorBindings: readAnchorBindings(database, resolvedCharacterId),
    officialAssets: readOfficialAssets(database, resolvedCharacterId),
    records,
    selectedImage: null,
    selectedSheet: null,
    sheetRecords,
    version: STORE_VERSION,
  };
  syncLegacySelections(store);
  return store;
}

export async function saveVisualStore(
  store: StoredVisualWorkspace,
  characterId?: string,
): Promise<void> {
  const resolvedCharacterId = await getCharacterId(characterId);
  const database = await getVisualDatabase();
  runInTransaction(database, () => {
    database
      .prepare('DELETE FROM character_official_visuals WHERE character_id = ?')
      .run(resolvedCharacterId);
    const recordIds = new Set<string>();
    for (const record of store.records) {
      recordIds.add(record.id);
      saveVisualRecord(database, resolvedCharacterId, 'portrait', record);
    }
    for (const record of store.sheetRecords) {
      recordIds.add(record.id);
      saveVisualRecord(database, resolvedCharacterId, 'sheet', record);
    }
    const existingRows = database
      .prepare('SELECT id FROM character_visual_records WHERE character_id = ?')
      .all(resolvedCharacterId) as DatabaseRow[];
    for (const row of existingRows) {
      const id = readText(row.id);
      if (!recordIds.has(id)) {
        database
          .prepare('DELETE FROM character_visual_records WHERE character_id = ? AND id = ?')
          .run(resolvedCharacterId, id);
      }
    }
    const insertOfficial = database.prepare(
      `INSERT INTO character_official_visuals (
         character_id, position, kind, record_id, file_name, anchor_role
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    store.officialAssets.forEach((asset, position) => {
      const binding = store.anchorBindings.find(
        item => item.taskId === asset.taskId && item.fileName === asset.fileName,
      );
      insertOfficial.run(
        resolvedCharacterId,
        position,
        asset.kind,
        asset.taskId,
        asset.fileName,
        binding?.role ?? 'unassigned',
      );
    });
  });
}

function syncLegacySelectionsInternal(store: StoredVisualWorkspace): void {
  const primary =
    store.officialAssets.find(asset => asset.kind === 'portrait') ?? store.officialAssets[0];
  const secondary =
    store.officialAssets.find(asset => asset.kind === 'sheet') ??
    store.officialAssets.find(asset => asset !== primary);
  store.selectedImage = primary ? { fileName: primary.fileName, taskId: primary.taskId } : null;
  store.selectedSheet = secondary
    ? { fileName: secondary.fileName, taskId: secondary.taskId }
    : null;
}

export function syncLegacySelections(store: StoredVisualWorkspace): void {
  syncLegacySelectionsInternal(store);
}

export function replaceRecord(
  store: StoredVisualWorkspace,
  record: LegacyActionRecord,
): StoredVisualWorkspace {
  return {
    ...store,
    records: [record, ...store.records.filter(item => item.id !== record.id)].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

export function replaceSheetRecord(
  store: StoredVisualWorkspace,
  record: LegacyReferenceBoardRecord,
): StoredVisualWorkspace {
  return {
    ...store,
    sheetRecords: [record, ...store.sheetRecords.filter(item => item.id !== record.id)].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

export function toWorkspaceState(store: StoredVisualWorkspace): CharacterVisualWorkspaceState {
  const records = [
    ...store.records.map(record => toVisualAssetRecord(record, 'action')),
    ...store.sheetRecords.map(record => toVisualAssetRecord(record, 'reference-board')),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    anchorBindings: store.anchorBindings,
    officialAssets: [
      ...new Map(
        store.officialAssets.map(asset => {
          const selection = toVisualAssetSelection(asset);
          return [selectionKey(selection), selection];
        }),
      ).values(),
    ],
    records,
  };
}

export function toVisualAssetSelection(
  selection: LegacyVisualAssetSelection,
): CharacterVisualAssetSelection {
  return { fileName: selection.fileName, taskId: selection.taskId };
}

export function toVisualAssetRecord(
  record: LegacyActionRecord | LegacyReferenceBoardRecord,
  generationMode: CharacterVisualAssetRecord['generationMode'] = null,
): CharacterVisualAssetRecord {
  const referenceAssets =
    'referenceAssets' in record
      ? record.referenceAssets.map(toVisualAssetSelection)
      : record.referenceAsset
        ? [toVisualAssetSelection(record.referenceAsset)]
        : [];
  const {
    referenceAsset: _referenceAsset,
    referenceImage: _referenceImage,
    ...baseRecord
  } = record as LegacyActionRecord & LegacyReferenceBoardRecord;
  return {
    ...baseRecord,
    generationMode: record.source === 'generated' ? generationMode : null,
    referenceAssets,
  };
}

export function getAssetDirectory(image: CharacterVisualAssetRecord['images'][number]): string {
  return image.url.includes(`/${LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY}/`)
    ? LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY
    : LEGACY_ACTION_ASSET_DIRECTORY;
}

export function findVisualAsset(
  store: StoredVisualWorkspace,
  selection: CharacterVisualAssetSelection,
): VisualAssetMatch {
  for (const candidate of [
    {
      directoryName: LEGACY_ACTION_ASSET_DIRECTORY,
      kind: 'portrait' as const,
      records: store.records,
    },
    {
      directoryName: LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY,
      kind: 'sheet' as const,
      records: store.sheetRecords,
    },
  ]) {
    const record = candidate.records.find(item => item.id === selection.taskId);
    const image = record?.images.find(item => item.fileName === selection.fileName);
    if (record && image) {
      return {
        directoryName: candidate.directoryName,
        image,
        record,
        selection: { ...selection, kind: candidate.kind },
      };
    }
  }
  throw new Error('未找到这张角色视觉图片');
}

export function validateVisualAssetSelection(
  request: CharacterVisualAssetSelection,
): CharacterVisualAssetSelection {
  if (
    !isPlainObject(request) ||
    typeof request.taskId !== 'string' ||
    !ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('角色视觉资产无效');
  }
  return {
    fileName: request.fileName,
    taskId: request.taskId,
  };
}

async function getCharacterId(characterId?: string): Promise<string> {
  if (characterId) return characterId;
  return (await loadCharacterStore()).activeCharacterId;
}

async function getVisualDatabase(): Promise<DatabaseSync> {
  const database = await getWorkspaceDatabase();
  if (!initializedDatabases.has(database)) {
    runDatabaseMigrations(database, CHARACTER_VISUAL_MIGRATIONS);
    initializedDatabases.add(database);
  }
  return database;
}

function readVisualRecord(
  database: DatabaseSync,
  characterId: string,
  row: DatabaseRow,
): LegacyActionRecord | LegacyReferenceBoardRecord {
  const id = readText(row.id);
  const kind = readText(row.kind) as LegacyVisualAssetSelection['kind'];
  const directoryName =
    kind === 'sheet' ? LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY : LEGACY_ACTION_ASSET_DIRECTORY;
  const images = (
    database
      .prepare(
        `SELECT file_name, mime_type, name
         FROM character_visual_images
         WHERE character_id = ? AND record_id = ?
         ORDER BY position`,
      )
      .all(characterId, id) as DatabaseRow[]
  ).map(image => ({
    fileName: readText(image.file_name),
    mimeType: readText(image.mime_type),
    ...(typeof image.name === 'string' ? { name: image.name } : {}),
    url: getCharacterAssetUrl(directoryName, readText(image.file_name)),
  }));
  const references = (
    database
      .prepare(
        `SELECT kind, reference_record_id, file_name
         FROM character_visual_references
         WHERE character_id = ? AND record_id = ?
         ORDER BY position`,
      )
      .all(characterId, id) as DatabaseRow[]
  ).map(reference => ({
    fileName: readText(reference.file_name),
    kind: readText(reference.kind) as LegacyVisualAssetSelection['kind'],
    taskId: readText(reference.reference_record_id),
  }));
  const base = {
    count: readNumber(row.count),
    createdAt: readText(row.created_at),
    errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
    id,
    images,
    name: readText(row.name),
    originalName: typeof row.original_name === 'string' ? row.original_name : null,
    progress: readNumber(row.progress),
    prompt: readText(row.prompt),
    resolution: readText(row.resolution) as LegacyActionRecord['resolution'],
    size: readText(row.size) as LegacyActionRecord['size'],
    source: readText(row.source) as LegacyActionRecord['source'],
    status: readText(row.status) as LegacyActionRecord['status'],
    updatedAt: readText(row.updated_at),
  };
  if (kind === 'sheet') {
    return {
      ...base,
      ...(readText(row.anchor_role)
        ? { anchorRole: readText(row.anchor_role) as LegacyReferenceBoardRecord['anchorRole'] }
        : {}),
      count: 1,
      referenceAssets: references,
      referenceImage: references[0]
        ? { fileName: references[0].fileName, taskId: references[0].taskId }
        : null,
      size: base.size,
    };
  }
  return { ...base, referenceAsset: references[0] ?? null };
}

function readOfficialAssets(
  database: DatabaseSync,
  characterId: string,
): LegacyVisualAssetSelection[] {
  const rows = database
    .prepare(
      `SELECT kind, record_id, file_name
       FROM character_official_visuals
       WHERE character_id = ?
       ORDER BY position`,
    )
    .all(characterId) as DatabaseRow[];
  return rows.map(row => ({
    fileName: readText(row.file_name),
    kind: readText(row.kind) as LegacyVisualAssetSelection['kind'],
    taskId: readText(row.record_id),
  }));
}

function readAnchorBindings(
  database: DatabaseSync,
  characterId: string,
): import('../../../shared/character-visual').CharacterAnchorBinding[] {
  const rows = database
    .prepare(
      `SELECT record_id, file_name, anchor_role
       FROM character_official_visuals
       WHERE character_id = ?
       ORDER BY position`,
    )
    .all(characterId) as DatabaseRow[];
  return rows.map(row => ({
    fileName: readText(row.file_name),
    role: readText(
      row.anchor_role,
    ) as import('../../../shared/character-visual').CharacterAnchorRole,
    taskId: readText(row.record_id),
  }));
}

function saveVisualRecord(
  database: DatabaseSync,
  characterId: string,
  kind: LegacyVisualAssetSelection['kind'],
  record: LegacyActionRecord | LegacyReferenceBoardRecord,
): void {
  database
    .prepare(
      `INSERT INTO character_visual_records (
         character_id, id, kind, name, count, prompt, resolution, size, source, status,
         progress, original_name, error_message, created_at, updated_at, anchor_role
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (character_id, id) DO UPDATE SET
         kind = excluded.kind,
         name = excluded.name,
         count = excluded.count,
         prompt = excluded.prompt,
         resolution = excluded.resolution,
         size = excluded.size,
         source = excluded.source,
         status = excluded.status,
         progress = excluded.progress,
         original_name = excluded.original_name,
         error_message = excluded.error_message,
         anchor_role = excluded.anchor_role,
         updated_at = excluded.updated_at`,
    )
    .run(
      characterId,
      record.id,
      kind,
      record.name,
      record.count,
      record.prompt,
      record.resolution,
      record.size,
      record.source,
      record.status,
      record.progress,
      record.originalName,
      record.errorMessage,
      record.createdAt,
      record.updatedAt,
      'anchorRole' in record ? (record.anchorRole ?? null) : null,
    );
  database
    .prepare('DELETE FROM character_visual_images WHERE character_id = ? AND record_id = ?')
    .run(characterId, record.id);
  database
    .prepare('DELETE FROM character_visual_references WHERE character_id = ? AND record_id = ?')
    .run(characterId, record.id);
  const insertImage = database.prepare(
    `INSERT INTO character_visual_images (
       character_id, record_id, position, file_name, mime_type, name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  record.images.forEach((image, position) => {
    insertImage.run(
      characterId,
      record.id,
      position,
      image.fileName,
      image.mimeType,
      image.name ?? null,
    );
  });
  const references =
    'referenceAssets' in record
      ? record.referenceAssets
      : record.referenceAsset
        ? [record.referenceAsset]
        : [];
  const insertReference = database.prepare(
    `INSERT INTO character_visual_references (
       character_id, record_id, position, kind, reference_record_id, file_name
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  references.forEach((reference, position) => {
    insertReference.run(
      characterId,
      record.id,
      position,
      reference.kind,
      reference.taskId,
      reference.fileName,
    );
  });
}

function readText(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: SQLOutputValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}

// 重新导出，避免外部服务为了引用 url helper 多导一份
export { getCharacterAssetUrl };
