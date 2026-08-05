// 角色视觉工作区的持久化与 legacy ↔ public 模型转换
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import { getActiveCharacterDirectory, getCharacterDirectory } from '../character-library';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import {
  LEGACY_ACTION_ASSET_DIRECTORY,
  LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY,
  LEGACY_VISUAL_STORE_FILE_NAME,
} from './constants';
import { ID_PATTERN } from '../../constants';
import {
  getCharacterAssetUrl,
  legacySelectionKey,
  parseLegacyActionRecord,
  parseLegacyReferenceBoardRecord,
  parseLegacyVisualAssetSelection,
  parseSelection,
  selectionKey,
} from './parsers';
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

async function getLegacyVisualStorePath(characterId?: string): Promise<string> {
  const characterDirectory = characterId
    ? await getCharacterDirectory(characterId)
    : await getActiveCharacterDirectory();
  return path.join(characterDirectory, LEGACY_VISUAL_STORE_FILE_NAME);
}

export async function loadVisualStore(characterId?: string): Promise<StoredVisualWorkspace> {
  const storePath = await getLegacyVisualStorePath(characterId);
  const value = await readJsonFile(storePath);
  if (!isPlainObject(value)) {
    return {
      officialAssets: [],
      records: [],
      selectedImage: null,
      selectedSheet: null,
      sheetRecords: [],
      version: STORE_VERSION,
    };
  }

  const records = Array.isArray(value.records)
    ? (value.records as unknown[])
        .map(parseLegacyActionRecord)
        .filter((record): record is LegacyActionRecord => Boolean(record))
    : [];
  const sheetRecords = Array.isArray(value.sheetRecords)
    ? (value.sheetRecords as unknown[])
        .map(parseLegacyReferenceBoardRecord)
        .filter((record): record is LegacyReferenceBoardRecord => Boolean(record))
    : [];

  const store: StoredVisualWorkspace = {
    officialAssets: getOfficialAssets(value),
    records: records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    selectedImage: parseSelection(value.selectedImage),
    selectedSheet: parseSelection(value.selectedSheet),
    sheetRecords: sheetRecords.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    version: STORE_VERSION,
  };
  store.officialAssets = store.officialAssets.filter(asset => {
    const recordList = asset.kind === 'portrait' ? store.records : store.sheetRecords;
    return recordList
      .find(record => record.id === asset.taskId)
      ?.images.some(image => image.fileName === asset.fileName);
  });
  syncLegacySelections(store);
  if (value.version !== STORE_VERSION) {
    await writeJsonFile(storePath, store);
  }
  return store;
}

export async function saveVisualStore(
  store: StoredVisualWorkspace,
  characterId?: string,
): Promise<void> {
  await writeJsonFile(await getLegacyVisualStorePath(characterId), store);
}

function getOfficialAssets(value: Record<string, unknown>): LegacyVisualAssetSelection[] {
  if (Array.isArray(value.officialAssets)) {
    const assets = (value.officialAssets as unknown[])
      .map(parseLegacyVisualAssetSelection)
      .filter((asset): asset is LegacyVisualAssetSelection => Boolean(asset));
    return [...new Map(assets.map(asset => [legacySelectionKey(asset), asset])).values()];
  }

  const selectedImage = parseSelection(value.selectedImage);
  const selectedSheet = parseSelection(value.selectedSheet);
  return [
    selectedImage ? { ...selectedImage, kind: 'portrait' as const } : null,
    selectedSheet ? { ...selectedSheet, kind: 'sheet' as const } : null,
  ].filter((asset): asset is LegacyVisualAssetSelection => Boolean(asset));
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

// 重新导出，避免外部服务为了引用 url helper 多导一份
export { getCharacterAssetUrl };
