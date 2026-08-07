// 角色表情公共 CRUD：workspace 查询 / 上传 / 重命名 / 删除
import { z } from 'zod';
import type {
  CharacterExpressionRecord,
  CharacterExpressionWorkspaceState,
  DeleteCharacterExpressionRequest,
  GetCharacterExpressionWorkspaceRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from '../../../shared/character-expression';
import { MAX_NAME_LENGTH } from '../../constants';
import { isNodeError } from '../../storage/json-store';
import { idSchema, nameSchema, parseRequest, safeFileNameSchema } from '../../utils';
import { deleteExpressionAssetFile, saveUploadedExpressionFile } from './assets';
import {
  findExpressionRecord,
  getExpressionWorkspace,
  removeExpressionImage,
  renameExpressionRecord,
  saveExpressionRecord,
} from './repository';

const getWorkspaceRequestSchema = z.object({ characterId: z.string() });
const renameRequestSchema = z.object({
  characterId: z.string(),
  name: nameSchema(MAX_NAME_LENGTH),
  taskId: idSchema,
});
const deleteRequestSchema = z.object({
  characterId: z.string(),
  fileName: safeFileNameSchema,
  taskId: idSchema,
});

export async function getCharacterExpressionWorkspace(
  request: GetCharacterExpressionWorkspaceRequest,
): Promise<CharacterExpressionWorkspaceState> {
  const { characterId } = parseRequest(request, getWorkspaceRequestSchema);
  return getExpressionWorkspace(characterId);
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
    await saveExpressionRecord(request.characterId, record);
  } catch (error: unknown) {
    await deleteExpressionAssetFile(fileName).catch(() => undefined);
    throw error;
  }
  return record;
}

export async function renameCharacterExpression(
  request: RenameCharacterExpressionRequest,
): Promise<CharacterExpressionWorkspaceState> {
  const { characterId, name, taskId } = parseRequest(request, renameRequestSchema);

  const record = await findExpressionRecord(characterId, taskId);
  if (!record) {
    throw new Error('未找到要重命名的表情');
  }
  if (record.status !== 'completed') {
    throw new Error('表情完成后才能重命名');
  }

  const renamed = await renameExpressionRecord(
    characterId,
    record.id,
    name,
    new Date().toISOString(),
  );
  if (!renamed) throw new Error('未找到要重命名的表情');
  return getExpressionWorkspace(characterId);
}

export async function deleteCharacterExpression(
  request: DeleteCharacterExpressionRequest,
): Promise<CharacterExpressionWorkspaceState> {
  const { characterId, fileName, taskId } = parseRequest(request, deleteRequestSchema);
  const originalRecord = await removeExpressionImage(
    characterId,
    taskId,
    fileName,
    new Date().toISOString(),
  );
  if (!originalRecord) {
    throw new Error('未找到这张表情图片');
  }

  try {
    await deleteExpressionAssetFile(fileName);
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await saveExpressionRecord(characterId, originalRecord);
      throw new Error(
        error instanceof Error ? `表情图片删除失败：${error.message}` : '表情图片删除失败',
      );
    }
  }
  return getExpressionWorkspace(characterId);
}
