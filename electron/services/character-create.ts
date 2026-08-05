import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterVisualGeneration,
  GenerateCharacterVisualRequest,
  GetCharacterVisualGenerationRequest,
  SaveCharacterVisualAssetRequest,
  SaveCharacterVisualRequest,
  SaveCharacterVisualResult,
} from '../../shared/character-create';
import type {
  CharacterVisualImage,
  CharacterVisualTaskStatus,
} from '../../shared/character-visual';
import type { SaveFileRequest } from '../../shared/desktop';
import { getCharacterLibrary, prepareCharacterVisualSave } from './character-library';
import { saveOfficialCharacterVisual } from './character-visual';
import { getCredentialValue } from './credentials';
import { readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';
import { isPlainObject } from 'es-toolkit';

const API_BASE_URL = 'https://api.apimart.ai';
const STORE_FILE_NAME = 'character-create-generations.json';
const ASSET_DIRECTORY = 'character-candidates';
const MAX_PROMPT_LENGTH = 20_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_RESULT_IMAGE_SIZE = 50 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const IMAGE_URL_LIMIT = 16;
const IMAGE_SIZE_PATTERN = /^\d{1,2}:\d{1,2}$/;

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

function isTaskStatus(value: unknown): value is CharacterVisualTaskStatus {
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

function parseImage(value: unknown): CharacterVisualImage | null {
  if (
    !isPlainObject(value) ||
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
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }
  const images = Array.isArray(value.images)
    ? value.images.map(parseImage).filter((image): image is CharacterVisualImage => Boolean(image))
    : [];
  const image = parseImage(value.image) ?? images[0] ?? null;
  if (images.length === 0 && image) images.push(image);
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    image,
    images,
    progress: typeof value.progress === 'number' ? value.progress : 0,
    status: value.status,
    taskId: value.taskId,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

async function loadStore(): Promise<StoredGenerationStore> {
  const value = await readJsonFile(getStorePath(await getWorkspaceDirectory()));
  if (!isPlainObject(value) || !Array.isArray(value.generations)) {
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
      isPlainObject(payload) &&
      isPlainObject(payload.error) &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `图片生成服务请求失败（HTTP ${response.status}）`;
    throw new Error(message);
  }
  return payload;
}

function getSubmittedTaskId(payload: unknown): string {
  if (!isPlainObject(payload) || !Array.isArray(payload.data))
    throw new Error('图片生成服务未返回任务编号');
  const item = payload.data[0];
  if (!isPlainObject(item) || typeof item.task_id !== 'string' || !ID_PATTERN.test(item.task_id)) {
    throw new Error('图片生成服务返回了无效任务编号');
  }
  return item.task_id;
}

function parseTaskData(payload: unknown): ApiTaskData {
  if (!isPlainObject(payload) || !isPlainObject(payload.data))
    throw new Error('图片生成服务返回了无效任务状态');
  const data = payload.data;
  const result =
    isPlainObject(data.result) && Array.isArray(data.result.images)
      ? data.result.images.filter(isPlainObject).map(image => ({
          url: Array.isArray(image.url)
            ? image.url.filter((url): url is string => typeof url === 'string')
            : [],
        }))
      : undefined;
  return {
    error: isPlainObject(data.error)
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

function validateImageUrls(imageUrls: string[] | undefined): void {
  if (!imageUrls) return;
  if (imageUrls.length === 0 || imageUrls.length > IMAGE_URL_LIMIT) {
    throw new Error(`图生图参考数量需在 1 到 ${IMAGE_URL_LIMIT} 张之间`);
  }
  for (const imageUrl of imageUrls) {
    if (
      typeof imageUrl !== 'string' ||
      !(imageUrl.startsWith('https://') || imageUrl.startsWith('data:image/'))
    ) {
      throw new Error('图生图参考必须是 HTTPS 图片地址或图片 data URI');
    }
  }
}

function getImageUrls(request: GenerateCharacterVisualRequest): string[] {
  if (request.imageUrls?.length) return request.imageUrls;
  if (!request.referenceImage) return [];
  return [
    `data:${request.referenceImage.mimeType};base64,${Buffer.from(request.referenceImage.fileData).toString('base64')}`,
  ];
}

async function downloadImage(
  taskId: string,
  imageUrl: string,
  index: number,
): Promise<CharacterVisualImage> {
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
  const fileName = `${taskId}-${index + 1}${extension}`;
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
  validateImageUrls(request.imageUrls);
  const imageUrls = getImageUrls(request);
  const n = request.n ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('候选数量需在 1 到 10 之间');
  const size = request.size ?? '1:1';
  if (!IMAGE_SIZE_PATTERN.test(size)) throw new Error('图片比例无效');
  const resolution = request.resolution ?? '1k';
  if (!['1k', '2k', '4k'].includes(resolution)) throw new Error('图片分辨率无效');
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
  await saveStore({
    ...store,
    generations: [updated, ...store.generations.filter(generation => generation.id !== updated.id)],
  });
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
    path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY, image.fileName),
  );
  const characterId = await prepareCharacterVisualSave(request.characterId);
  await saveOfficialCharacterVisual(characterId, {
    fileData: new Uint8Array(fileData),
    fileName: image.fileName,
    mimeType: image.mimeType,
  } satisfies SaveFileRequest);

  const result = { characterId, library: await getCharacterLibrary() };
  await saveStore({
    ...store,
    generations: store.generations.filter(item => item.id !== generation.id),
  }).catch(() => undefined);
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
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
