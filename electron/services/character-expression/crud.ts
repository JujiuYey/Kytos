// 角色表情公共 CRUD：workspace 查询 / 上传 / 重命名 / 删除
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type {
  CharacterExpressionRecord,
  CharacterExpressionWorkspaceState,
  DeleteCharacterExpressionRequest,
  GetCharacterExpressionWorkspaceRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from '../../../shared/character-expression';
import { ID_PATTERN, MAX_NAME_LENGTH } from '../../constants';
import { isNodeError } from '../../storage/json-store';
import { deleteExpressionAssetFile, saveUploadedExpressionFile } from './assets';
import {
  loadExpressionStore,
  patchRecordName,
  removeImageFromRecord,
  replaceRecord,
  saveExpressionStore,
} from './store';
import type { StoredExpressionWorkspace } from './types';

export async function getCharacterExpressionWorkspace(
  request: GetCharacterExpressionWorkspaceRequest,
): Promise<CharacterExpressionWorkspaceState> {
  if (!request || typeof request.characterId !== 'string') {
    throw new Error('角色编号无效');
  }
  const store = await loadExpressionStore(request.characterId);
  return { records: store.records };
}

export async function uploadCharacterExpression(
  request: UploadCharacterExpressionRequest,
): Promise<CharacterExpressionRecord> {
  const now = new Date().toISOString();
  const { fileName, result } = await saveUploadedExpressionFile(request);
  const record: CharacterExpressionRecord = {
    count: 1,
    createdAt: now,
    description: '',
    errorMessage: null,
    id: fileName.split('.')[0],
    images: [{ fileName, mimeType: request.mimeType, url: result.url }],
    name: request.name.trim(),
    originalName: request.fileName,
    progress: 100,
    prompt: '',
    referenceAssets: [],
    resolution: '1k',
    size: '1:1',
    source: 'uploaded',
    status: 'completed',
    updatedAt: now,
  };
  try {
    const existing = await loadExpressionStore(request.characterId);
    await saveExpressionStore(request.characterId, replaceRecord(existing, record));
  } catch (error: unknown) {
    await deleteExpressionAssetFile(fileName).catch(() => undefined);
    throw error;
  }
  return record;
}

export async function renameCharacterExpression(
  request: RenameCharacterExpressionRequest,
): Promise<CharacterExpressionWorkspaceState> {
  if (
    !isPlainObject(request) ||
    typeof request.characterId !== 'string' ||
    typeof request.taskId !== 'string' ||
    !ID_PATTERN.test(request.taskId) ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error('表情名称无效');
  }

  const store = await loadExpressionStore(request.characterId);
  const record = store.records.find(item => item.id === request.taskId);
  if (!record) {
    throw new Error('未找到要重命名的表情');
  }
  if (record.status !== 'completed') {
    throw new Error('表情完成后才能重命名');
  }

  const normalizedName = request.name.trim();
  const nextStore = patchRecordName(store, record.id, normalizedName, new Date().toISOString());
  await saveExpressionStore(request.characterId, nextStore);
  return { records: nextStore.records };
}

export async function deleteCharacterExpression(
  request: DeleteCharacterExpressionRequest,
): Promise<CharacterExpressionWorkspaceState> {
  if (
    !isPlainObject(request) ||
    typeof request.characterId !== 'string' ||
    typeof request.taskId !== 'string' ||
    !ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('表情删除请求无效');
  }
  const store = await loadExpressionStore(request.characterId);
  const record = store.records.find(item => item.id === request.taskId);
  const image = record?.images.find(item => item.fileName === request.fileName);
  if (!record || !image) {
    throw new Error('未找到这张表情图片');
  }

  const nextStore: StoredExpressionWorkspace = removeImageFromRecord(
    store,
    record.id,
    request.fileName,
    new Date().toISOString(),
  );
  await saveExpressionStore(request.characterId, nextStore);
  try {
    await deleteExpressionAssetFile(request.fileName);
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await saveExpressionStore(request.characterId, store);
      throw new Error(
        error instanceof Error ? `表情图片删除失败：${error.message}` : '表情图片删除失败',
      );
    }
  }
  return { records: nextStore.records };
}
