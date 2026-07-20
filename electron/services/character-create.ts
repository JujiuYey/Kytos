import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterVisualGeneration,
  GenerateCharacterVisualRequest,
  GetCharacterVisualGenerationRequest,
  SaveCharacterVisualRequest,
  SaveCharacterVisualResult,
} from '../../shared/character-create';
import type {
  CharacterPortraitImage,
  CharacterPortraitTaskStatus,
} from '../../shared/character-portrait';
import type { SaveFileRequest } from '../../shared/desktop';
import {
  getCharacterLibrary,
  prepareCharacterVisualSave,
  rollbackCharacterVisualSave,
} from './character-library';
import { saveOfficialCharacterVisual } from './character-portrait';
import { getCredentialValue } from './credentials';
import { readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const API_BASE_URL = 'https://api.apimart.ai';
const STORE_FILE_NAME = 'character-create-generations.json';
const ASSET_DIRECTORY = 'character-candidates';
const MAX_PROMPT_LENGTH = 20_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_RESULT_IMAGE_SIZE = 50 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

interface StoredGeneration extends CharacterVisualGeneration {
  taskId: string;
}

interface StoredGenerationStore {
  generations: StoredGeneration[];
  version: 1;
}

interface ApiTaskData {
  error?: { message?: string };
  progress?: number;
  result?: { images?: Array<{ url: string[] }> };
  status?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isTaskStatus(value: unknown): value is CharacterPortraitTaskStatus {
  return ['submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(value),
  );
}

function getStorePath(workspacePath: string): string {
  return path.join(workspacePath, STORE_FILE_NAME);
}

function getAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
}

function parseImage(value: unknown): CharacterPortraitImage | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName
  ) {
    return null;
  }
  return {
    fileName: value.fileName,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : 'image/png',
    name: typeof value.name === 'string' ? value.name : '角色候选视觉',
    url: getAssetUrl(value.fileName),
  };
}

function parseGeneration(value: unknown): StoredGeneration | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    image: parseImage(value.image),
    progress: typeof value.progress === 'number' ? value.progress : 0,
    status: value.status,
    taskId: value.taskId,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

async function loadStore(): Promise<StoredGenerationStore> {
  const value = await readJsonFile(getStorePath(await getWorkspaceDirectory()));
  if (!isRecord(value) || !Array.isArray(value.generations)) {
    return { generations: [], version: 1 };
  }
  return {
    generations: value.generations
      .map(parseGeneration)
      .filter((generation): generation is StoredGeneration => Boolean(generation)),
    version: 1,
  };
}

async function saveStore(store: StoredGenerationStore): Promise<void> {
  await writeJsonFile(getStorePath(await getWorkspaceDirectory()), store);
}

async function requestApi(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? `无法连接图片生成服务：${error.message}` : '无法连接图片生成服务',
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `图片生成服务请求失败（HTTP ${response.status}）`;
    throw new Error(message);
  }
  return payload;
}

function getSubmittedTaskId(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.data))
    throw new Error('图片生成服务未返回任务编号');
  const item = payload.data[0];
  if (!isRecord(item) || typeof item.task_id !== 'string' || !ID_PATTERN.test(item.task_id)) {
    throw new Error('图片生成服务返回了无效任务编号');
  }
  return item.task_id;
}

function parseTaskData(payload: unknown): ApiTaskData {
  if (!isRecord(payload) || !isRecord(payload.data))
    throw new Error('图片生成服务返回了无效任务状态');
  const data = payload.data;
  const result =
    isRecord(data.result) && Array.isArray(data.result.images)
      ? data.result.images.filter(isRecord).map(image => ({
          url: Array.isArray(image.url)
            ? image.url.filter((url): url is string => typeof url === 'string')
            : [],
        }))
      : undefined;
  return {
    error: isRecord(data.error)
      ? { message: typeof data.error.message === 'string' ? data.error.message : undefined }
      : undefined,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    result: result ? { images: result } : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
  };
}

function validateReferenceImage(image: GenerateCharacterVisualRequest['referenceImage']): void {
  if (!image) return;
  if (
    !image.fileName ||
    path.basename(image.fileName) !== image.fileName ||
    !(image.fileData instanceof Uint8Array) ||
    image.fileData.byteLength === 0 ||
    image.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE ||
    !image.mimeType.startsWith('image/')
  ) {
    throw new Error('参考照片无效或超过 20 MB');
  }
}

async function downloadImage(taskId: string, imageUrl: string): Promise<CharacterPortraitImage> {
  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('图片生成服务返回了不安全的图片地址');
  const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`生成图片保存失败（HTTP ${response.status}）`);
  const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
  const fileData = new Uint8Array(await response.arrayBuffer());
  if (!mimeType.startsWith('image/') || fileData.byteLength > MAX_RESULT_IMAGE_SIZE) {
    throw new Error('生成图片内容无效或超过 50 MB');
  }
  const extension =
    mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
  const fileName = `${taskId}${extension}`;
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(path.join(assetDirectory, fileName), fileData);
  return { fileName, mimeType, name: '角色候选视觉', url: getAssetUrl(fileName) };
}

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
  const imageUrls = request.referenceImage
    ? [
        `data:${request.referenceImage.mimeType};base64,${Buffer.from(request.referenceImage.fileData).toString('base64')}`,
      ]
    : [];
  const body: Record<string, unknown> = {
    model: 'gpt-image-2',
    n: 1,
    prompt: request.prompt.trim(),
    resolution: '1k',
    size: '1:1',
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
  if (existing.status === 'completed' && existing.image) return existing;
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
  const imageUrl = taskData.result?.images?.[0]?.url?.[0];
  const image =
    taskData.status === 'completed' && imageUrl
      ? await downloadImage(existing.taskId, imageUrl)
      : existing.image;
  const updated: StoredGeneration = {
    ...existing,
    errorMessage: ['failed', 'cancelled'].includes(taskData.status)
      ? taskData.error?.message || '图片生成任务未完成'
      : null,
    image,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existing.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await saveStore({
    ...store,
    generations: [updated, ...store.generations.filter(generation => generation.id !== updated.id)],
  });
  return updated;
}

export async function saveCharacterVisual(
  request: SaveCharacterVisualRequest,
): Promise<SaveCharacterVisualResult> {
  if (!request || typeof request !== 'object' || !ID_PATTERN.test(request.generationId)) {
    throw new Error('角色视觉保存参数无效');
  }
  const store = await loadStore();
  const generation = store.generations.find(item => item.id === request.generationId);
  if (!generation || generation.status !== 'completed' || !generation.image) {
    throw new Error('角色视觉还没有生成完成');
  }
  const fileData = await readFile(
    path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY, generation.image.fileName),
  );
  const prepared = await prepareCharacterVisualSave(request.characterId);
  try {
    await saveOfficialCharacterVisual(prepared.characterId, {
      fileData: new Uint8Array(fileData),
      fileName: generation.image.fileName,
      mimeType: generation.image.mimeType,
    } satisfies SaveFileRequest);
  } catch (error: unknown) {
    if (prepared.created) await rollbackCharacterVisualSave(prepared.characterId);
    throw error;
  }

  const result = { characterId: prepared.characterId, library: await getCharacterLibrary() };
  await saveStore({
    ...store,
    generations: store.generations.filter(item => item.id !== generation.id),
  }).catch(() => undefined);
  await unlink(
    path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY, generation.image.fileName),
  ).catch(() => undefined);
  return result;
}
