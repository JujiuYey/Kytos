// character-create 公共 CRUD：generate / get / save / saveAsset
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import {
  API_BASE_URL,
  ID_PATTERN,
  MAX_PROMPT_LENGTH,
  WORKSPACE_ASSETS_SUBDIRECTORY,
} from '../../constants';
import { getSubmittedTaskId, isTaskStatus, parseTaskData, requestApi } from '../../utils';
import type {
  CharacterVisualGeneration,
  GenerateCharacterVisualRequest,
  GetCharacterVisualGenerationRequest,
  SaveCharacterVisualAssetRequest,
  SaveCharacterVisualRequest,
  SaveCharacterVisualResult,
} from '../../../shared/character-create';
import type { SaveFileRequest } from '../../../shared/desktop';
import { getCharacterLibrary, prepareCharacterVisualSave } from '../character-library';
import { saveOfficialCharacterVisual } from '../character-visual';
import { getCredentialValue } from '../credentials';
import { getWorkspaceDirectory } from '../workspace';
import { ASSET_DIRECTORY } from './constants';
import { downloadImage, validateReferenceImage } from './assets';
import { getImageUrls, validateGenerationOptions, validateImageUrls } from './request';
import { loadStore, removeGeneration, replaceGeneration, saveStore } from './store';
import type { StoredGeneration } from './types';

export async function generateCharacterVisual(
  request: GenerateCharacterVisualRequest,
): Promise<CharacterVisualGeneration> {
  if (
    !request ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH
  ) {
    throw new Error('角色视觉提示词无效');
  }
  validateReferenceImage(request.referenceImage);
  validateImageUrls(request.imageUrls);
  const imageUrls = getImageUrls(request);
  const { n, size, resolution } = validateGenerationOptions(request);
  const body: Record<string, unknown> = {
    model: 'gpt-image-2',
    n,
    prompt: request.prompt.trim(),
    resolution,
    size,
  };
  if (imageUrls.length) body.image_urls = imageUrls;
  const taskId = getSubmittedTaskId(
    await requestApi(`${API_BASE_URL}/v1/images/generations`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${await getCredentialValue('apimart')}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
  );
  const now = new Date().toISOString();
  const generation: StoredGeneration = {
    createdAt: now,
    errorMessage: null,
    id: `generation_${randomUUID()}`,
    image: null,
    images: [],
    progress: 0,
    status: 'submitted',
    taskId,
    updatedAt: now,
  };
  const store = await loadStore();
  await saveStore({ ...store, generations: [generation, ...store.generations] });
  return generation;
}

export async function getCharacterVisualGeneration(
  request: GetCharacterVisualGenerationRequest,
): Promise<CharacterVisualGeneration> {
  if (!request || !ID_PATTERN.test(request.generationId)) throw new Error('角色视觉任务编号无效');
  const store = await loadStore();
  const existing = store.generations.find(generation => generation.id === request.generationId);
  if (!existing) throw new Error('未找到角色视觉任务');
  if (existing.status === 'completed' && existing.images.length > 0) return existing;
  const taskData = parseTaskData(
    await requestApi(
      `${API_BASE_URL}/v1/tasks/${encodeURIComponent(existing.taskId)}?language=zh`,
      {
        headers: { Authorization: `Bearer ${await getCredentialValue('apimart')}` },
        method: 'GET',
      },
    ),
  );
  if (!isTaskStatus(taskData.status)) throw new Error('图片生成服务返回了未知任务状态');
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (taskData.status === 'completed' && imageUrls.length === 0) {
    throw new Error('图片生成任务已完成，但没有返回图片');
  }
  const images =
    imageUrls.length > 0
      ? await Promise.all(
          imageUrls.map(
            (imageUrl, index) =>
              existing.images[index] ?? downloadImage(existing.taskId, imageUrl, index),
          ),
        )
      : existing.images;
  const updated: StoredGeneration = {
    ...existing,
    errorMessage: ['failed', 'cancelled'].includes(taskData.status)
      ? taskData.error?.message || '图片生成任务未完成'
      : null,
    image: images[0] ?? null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existing.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceGeneration(store, updated));
  return updated;
}

export async function saveCharacterVisual(
  request: SaveCharacterVisualRequest,
): Promise<SaveCharacterVisualResult> {
  if (!isPlainObject(request) || !ID_PATTERN.test(request.generationId)) {
    throw new Error('角色视觉保存参数无效');
  }
  const store = await loadStore();
  const generation = store.generations.find(item => item.id === request.generationId);
  const image = request.imageFileName
    ? generation?.images.find(item => item.fileName === request.imageFileName)
    : generation?.image;
  if (!generation || generation.status !== 'completed' || !image) {
    throw new Error('角色视觉还没有生成完成');
  }
  const fileData = await readFile(
    path.join(
      await getWorkspaceDirectory(),
      WORKSPACE_ASSETS_SUBDIRECTORY,
      ASSET_DIRECTORY,
      image.fileName,
    ),
  );
  const characterId = await prepareCharacterVisualSave(request.characterId);
  await saveOfficialCharacterVisual(characterId, {
    fileData: new Uint8Array(fileData),
    fileName: image.fileName,
    mimeType: image.mimeType,
  } satisfies SaveFileRequest);

  const result = { characterId, library: await getCharacterLibrary() };
  await saveStore(removeGeneration(store, generation.id)).catch(() => undefined);
  const assetDirectory = path.join(
    await getWorkspaceDirectory(),
    WORKSPACE_ASSETS_SUBDIRECTORY,
    ASSET_DIRECTORY,
  );
  await Promise.all(
    generation.images.map(item =>
      unlink(path.join(assetDirectory, item.fileName)).catch(() => undefined),
    ),
  );
  return result;
}

export async function saveCharacterVisualAsset(
  request: SaveCharacterVisualAssetRequest,
): Promise<SaveCharacterVisualResult> {
  if (
    !isPlainObject(request) ||
    !(request.fileData instanceof Uint8Array) ||
    !request.fileName ||
    !request.mimeType.startsWith('image/')
  ) {
    throw new Error('角色视觉资产无效');
  }
  const characterId = await prepareCharacterVisualSave(request.characterId);
  await saveOfficialCharacterVisual(characterId, request, 'uploaded');
  return { characterId, library: await getCharacterLibrary() };
}
