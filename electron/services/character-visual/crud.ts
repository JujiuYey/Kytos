// 角色视觉资产的 CRUD：上传 / 设为正式 / 重命名 / 删除 / 工作区查询
import type { SaveFileRequest, SavedFileResult } from '../../../shared/desktop';
import type {
  CharacterVisualAssetSelection,
  CharacterVisualSource,
  CharacterVisualWorkspaceState,
  RenameCharacterVisualAssetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
} from '../../../shared/character-visual';
import { LEGACY_ACTION_ASSET_DIRECTORY, MAX_NAME_LENGTH } from './constants';
import { legacySelectionKey, selectionKey } from './parsers';
import {
  findVisualAsset,
  getAssetDirectory,
  loadVisualStore,
  replaceRecord,
  saveVisualStore,
  syncLegacySelections,
  toWorkspaceState,
  validateVisualAssetSelection,
} from './store';
import { deleteAssetFile, saveUploadedImage } from './assets';
import { isNodeError } from '../../utils/node-error';
import type {
  LegacyActionRecord,
  LegacyReferenceBoardRecord,
  OfficialCharacterVisualReference,
} from './types';

export function getCharacterVisualReferences(
  workspace: CharacterVisualWorkspaceState,
): OfficialCharacterVisualReference[] {
  return workspace.records.flatMap(record =>
    record.status === 'completed'
      ? record.images.map(image => ({
          directoryName: getAssetDirectory(image),
          image,
          selection: { fileName: image.fileName, taskId: record.id },
        }))
      : [],
  );
}

export function getOfficialCharacterVisualReferences(
  workspace: CharacterVisualWorkspaceState,
): OfficialCharacterVisualReference[] {
  const officialKeys = new Set(workspace.officialAssets.map(selectionKey));
  return getCharacterVisualReferences(workspace).filter(reference =>
    officialKeys.has(selectionKey(reference.selection)),
  );
}

export async function getCharacterVisualWorkspace(
  characterId?: string,
): Promise<CharacterVisualWorkspaceState> {
  return toWorkspaceState(await loadVisualStore(characterId));
}

export async function uploadCharacterVisualAsset(
  request: UploadCharacterVisualAssetRequest,
): Promise<SavedFileResult> {
  const { image, result, uploadId } = await saveUploadedImage(
    request,
    LEGACY_ACTION_ASSET_DIRECTORY,
  );
  const now = new Date().toISOString();
  const record: LegacyActionRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: uploadId,
    images: [{ ...image, name: request.name.trim() }],
    name: request.name.trim(),
    originalName: request.fileName,
    progress: 100,
    prompt: '',
    resolution: '1k',
    size: '2:3',
    source: 'uploaded',
    status: 'completed',
    updatedAt: now,
  };
  const store = replaceRecord(await loadVisualStore(request.characterId), record);
  try {
    await saveVisualStore(store, request.characterId);
  } catch (error: unknown) {
    await deleteAssetFileSafe(LEGACY_ACTION_ASSET_DIRECTORY, image.fileName);
    throw error;
  }
  return result;
}

export async function saveOfficialCharacterVisual(
  characterId: string,
  request: SaveFileRequest,
  source: CharacterVisualSource = 'generated',
): Promise<void> {
  const { image, uploadId } = await saveUploadedImage(
    { ...request, name: '正式角色视觉' },
    LEGACY_ACTION_ASSET_DIRECTORY,
  );
  const now = new Date().toISOString();
  const record: LegacyActionRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: uploadId,
    images: [{ ...image, name: '正式角色视觉' }],
    name: '正式角色视觉',
    originalName: request.fileName,
    progress: 100,
    prompt: '',
    resolution: '1k',
    size: '1:1',
    source,
    status: 'completed',
    updatedAt: now,
  };
  const selection = { fileName: image.fileName, kind: 'portrait' as const, taskId: uploadId };
  const store = replaceRecord(await loadVisualStore(characterId), record);
  store.officialAssets = [selection];
  syncLegacySelections(store);
  try {
    await saveVisualStore(store, characterId);
  } catch (error: unknown) {
    await deleteAssetFileSafe(LEGACY_ACTION_ASSET_DIRECTORY, image.fileName);
    throw error;
  }
}

export async function renameCharacterVisualAsset(
  request: RenameCharacterVisualAssetRequest,
): Promise<CharacterVisualWorkspaceState> {
  const selection = validateVisualAssetSelection(request);
  if (
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error('角色视觉名称无效');
  }
  const store = await loadVisualStore();
  const match = findVisualAsset(store, selection);
  const normalizedName = request.name.trim();
  const updateRecord = <T extends LegacyActionRecord | LegacyReferenceBoardRecord>(
    record: T,
  ): T => ({
    ...record,
    images: record.images.map(image =>
      image.fileName === selection.fileName ? { ...image, name: normalizedName } : image,
    ),
    name: record.images.length === 1 ? normalizedName : record.name,
    updatedAt: new Date().toISOString(),
  });
  if (match.selection.kind === 'portrait') {
    store.records = store.records.map(record =>
      record.id === selection.taskId ? updateRecord(record) : record,
    );
  } else {
    store.sheetRecords = store.sheetRecords.map(record =>
      record.id === selection.taskId ? updateRecord(record) : record,
    );
  }
  await saveVisualStore(store);
  return toWorkspaceState(store);
}

export async function setCharacterVisualAssetOfficial(
  request: SetCharacterVisualAssetOfficialRequest,
): Promise<CharacterVisualWorkspaceState> {
  const selection = validateVisualAssetSelection(request);
  if (typeof request.official !== 'boolean') {
    throw new Error('正式资产状态无效');
  }
  const store = await loadVisualStore();
  const match = findVisualAsset(store, selection);
  const key = legacySelectionKey(match.selection);
  store.officialAssets = request.official
    ? [
        ...store.officialAssets,
        ...(!store.officialAssets.some(asset => legacySelectionKey(asset) === key)
          ? [match.selection]
          : []),
      ]
    : store.officialAssets.filter(asset => legacySelectionKey(asset) !== key);
  syncLegacySelections(store);
  await saveVisualStore(store);
  return toWorkspaceState(store);
}

export async function deleteCharacterVisualAsset(
  request: CharacterVisualAssetSelection,
): Promise<CharacterVisualWorkspaceState> {
  const selection = validateVisualAssetSelection(request);
  const store = await loadVisualStore();
  const { directoryName, record, selection: legacySelection } = findVisualAsset(store, selection);
  if (
    store.officialAssets.some(
      asset => legacySelectionKey(asset) === legacySelectionKey(legacySelection),
    )
  ) {
    throw new Error('正式资产不能删除，请先移出正式资产');
  }

  const remainingImages = record.images.filter(item => item.fileName !== selection.fileName);
  const nextStore: import('./types').StoredVisualWorkspace = {
    ...store,
    ...(legacySelection.kind === 'portrait'
      ? {
          records: remainingImages.length
            ? store.records.map(item =>
                item.id === record.id
                  ? { ...item, images: remainingImages, updatedAt: new Date().toISOString() }
                  : item,
              )
            : store.records.filter(item => item.id !== record.id),
        }
      : {
          sheetRecords: remainingImages.length
            ? store.sheetRecords.map(item =>
                item.id === record.id
                  ? { ...item, images: remainingImages, updatedAt: new Date().toISOString() }
                  : item,
              )
            : store.sheetRecords.filter(item => item.id !== record.id),
        }),
  };

  await saveVisualStore(nextStore);
  try {
    await deleteAssetFile(directoryName, selection.fileName);
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await saveVisualStore(store);
      throw new Error(
        error instanceof Error ? `角色视觉文件删除失败：${error.message}` : '角色视觉文件删除失败',
      );
    }
  }

  return toWorkspaceState(nextStore);
}

async function deleteAssetFileSafe(directoryName: string, fileName: string): Promise<void> {
  await deleteAssetFile(directoryName, fileName).catch(() => undefined);
}
