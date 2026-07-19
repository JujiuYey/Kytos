import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitSize,
  CharacterPortraitTaskStatus,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterPortraitRequest,
  GenerateCharacterSheetRequest,
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
} from '../../shared/character-portrait';
import {
  CHARACTER_PORTRAIT_RESOLUTIONS,
  CHARACTER_PORTRAIT_SIZES,
  CHARACTER_SHEET_SIZE,
} from '../../shared/character-portrait';
import type { SaveFileRequest, SavedFileResult } from '../../shared/desktop';
import { getActiveCharacterDirectory } from './character-library';
import { getCredentialValue } from './credentials';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const API_BASE_URL = 'https://api.apimart.ai';
const PORTRAIT_STORE_FILE_NAME = 'character-portraits.json';
const PORTRAIT_ASSET_DIRECTORY = 'character-portraits';
const SHEET_ASSET_DIRECTORY = 'character-sheets';
const MAX_PROMPT_LENGTH = 20_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

interface StoredPortraitWorkspace {
  records: CharacterPortraitRecord[];
  selectedImage: CharacterPortraitSelection | null;
  selectedSheet: CharacterPortraitSelection | null;
  sheetRecords: CharacterSheetRecord[];
  version: 1;
}

interface ApiTaskImage {
  url: string[];
}

interface ApiTaskData {
  error?: { message?: string };
  progress?: number;
  result?: { images?: ApiTaskImage[] };
  status?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPortraitSize(value: unknown): value is CharacterPortraitSize {
  return CHARACTER_PORTRAIT_SIZES.includes(value as CharacterPortraitSize);
}

function isPortraitResolution(value: unknown): value is CharacterPortraitResolution {
  return CHARACTER_PORTRAIT_RESOLUTIONS.includes(value as CharacterPortraitResolution);
}

function isTaskStatus(value: unknown): value is CharacterPortraitTaskStatus {
  return ['submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(value),
  );
}

function getCharacterAssetUrl(directoryName: string, fileName: string): string {
  return `app://bundle/workspace-assets/${directoryName}/${encodeURIComponent(fileName)}`;
}

function parseImage(value: unknown, directoryName: string): CharacterPortraitImage | null {
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
    url: getCharacterAssetUrl(directoryName, value.fileName),
  };
}

function parsePortraitRecord(value: unknown): CharacterPortraitRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !TASK_ID_PATTERN.test(value.id) ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_PROMPT_LENGTH ||
    !isPortraitSize(value.size) ||
    !isPortraitResolution(value.resolution) ||
    typeof value.count !== 'number' ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 4 ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }

  const images = Array.isArray(value.images)
    ? value.images
        .map(image => parseImage(image, PORTRAIT_ASSET_DIRECTORY))
        .filter((image): image is CharacterPortraitImage => Boolean(image))
    : [];

  return {
    count: value.count,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    resolution: value.resolution,
    size: value.size,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

function parseSheetRecord(value: unknown): CharacterSheetRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !TASK_ID_PATTERN.test(value.id) ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_PROMPT_LENGTH ||
    value.size !== CHARACTER_SHEET_SIZE ||
    !isPortraitResolution(value.resolution) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }

  const images = Array.isArray(value.images)
    ? value.images
        .map(image => parseImage(image, SHEET_ASSET_DIRECTORY))
        .filter((image): image is CharacterPortraitImage => Boolean(image))
    : [];

  return {
    count: 1,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referenceImage: parseSelection(value.referenceImage),
    resolution: value.resolution,
    size: CHARACTER_SHEET_SIZE,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

function parseSelection(value: unknown): CharacterPortraitSelection | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(value.taskId)
  ) {
    return null;
  }
  return { fileName: value.fileName, taskId: value.taskId };
}

async function getPortraitStorePath(): Promise<string> {
  return path.join(await getActiveCharacterDirectory(), PORTRAIT_STORE_FILE_NAME);
}

async function loadPortraitStore(): Promise<StoredPortraitWorkspace> {
  const value = await readJsonFile(await getPortraitStorePath());
  if (!isRecord(value)) {
    return {
      records: [],
      selectedImage: null,
      selectedSheet: null,
      sheetRecords: [],
      version: 1,
    };
  }

  const records = Array.isArray(value.records)
    ? value.records
        .map(parsePortraitRecord)
        .filter((record): record is CharacterPortraitRecord => Boolean(record))
    : [];
  const sheetRecords = Array.isArray(value.sheetRecords)
    ? value.sheetRecords
        .map(parseSheetRecord)
        .filter((record): record is CharacterSheetRecord => Boolean(record))
    : [];

  return {
    records: records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    selectedImage: parseSelection(value.selectedImage),
    selectedSheet: parseSelection(value.selectedSheet),
    sheetRecords: sheetRecords.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    version: 1,
  };
}

async function savePortraitStore(store: StoredPortraitWorkspace): Promise<void> {
  await writeJsonFile(await getPortraitStorePath(), store);
}

function validateGenerateRequest(request: GenerateCharacterPortraitRequest): void {
  if (!request || typeof request !== 'object') {
    throw new Error('生成参数无效');
  }
  if (
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH
  ) {
    throw new Error('定妆照提示词无效');
  }
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > 4) {
    throw new Error('候选张数必须在 1 到 4 之间');
  }
  if (!isPortraitSize(request.size) || !isPortraitResolution(request.resolution)) {
    throw new Error('图片规格无效');
  }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message;
  }
  return fallback;
}

async function requestApi(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? `无法连接图片生成服务：${error.message}` : '无法连接图片生成服务',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`图片生成服务返回了无法解析的响应（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `图片生成服务请求失败（HTTP ${response.status}）`));
  }
  return payload;
}

function getSubmittedTaskId(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('图片生成服务未返回任务编号');
  }
  const firstItem = payload.data[0];
  if (!isRecord(firstItem) || typeof firstItem.task_id !== 'string') {
    throw new Error('图片生成服务未返回任务编号');
  }
  if (!TASK_ID_PATTERN.test(firstItem.task_id)) {
    throw new Error('图片生成服务返回了无效的任务编号');
  }
  return firstItem.task_id;
}

function parseTaskData(payload: unknown): ApiTaskData {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error('图片生成服务返回了无效的任务状态');
  }

  const data = payload.data;
  const error = isRecord(data.error)
    ? { message: typeof data.error.message === 'string' ? data.error.message : undefined }
    : undefined;
  const resultImages =
    isRecord(data.result) && Array.isArray(data.result.images)
      ? data.result.images.filter(isRecord).map(image => ({
          url: Array.isArray(image.url)
            ? image.url.filter((url): url is string => typeof url === 'string')
            : [],
        }))
      : undefined;

  return {
    error,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    result: resultImages ? { images: resultImages } : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
  };
}

function getImageExtension(mimeType: string, imageUrl: string): string {
  const normalizedMimeType = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  const extensions: Record<string, string> = {
    'image/avif': '.avif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  if (normalizedMimeType && extensions[normalizedMimeType]) {
    return extensions[normalizedMimeType];
  }
  const urlExtension = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return ['.avif', '.jpeg', '.jpg', '.png', '.webp'].includes(urlExtension) ? urlExtension : '.png';
}

function validateImageUploadRequest(request: SaveFileRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName ||
    !(request.fileData instanceof Uint8Array) ||
    typeof request.mimeType !== 'string' ||
    !request.mimeType.startsWith('image/')
  ) {
    throw new Error('上传的角色图片无效');
  }
  if (request.fileData.byteLength === 0 || request.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('角色图片大小必须在 20 MB 以内');
  }
}

function getUploadedImageExtension(request: SaveFileRequest): string {
  const mimeExtensions: Record<string, string> = {
    'image/avif': '.avif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const mimeType = request.mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (mimeType && mimeExtensions[mimeType]) {
    return mimeExtensions[mimeType];
  }
  const extension = path.extname(request.fileName).toLowerCase();
  if (['.avif', '.jpeg', '.jpg', '.png', '.webp'].includes(extension)) {
    return extension;
  }
  throw new Error('仅支持 PNG、JPEG、WebP 或 AVIF 图片');
}

async function saveUploadedImage(
  request: SaveFileRequest,
  assetDirectoryName: string,
): Promise<{ image: CharacterPortraitImage; result: SavedFileResult; uploadId: string }> {
  validateImageUploadRequest(request);
  const workspacePath = await getWorkspaceDirectory();
  const assetDirectory = path.join(workspacePath, 'assets', assetDirectoryName);
  const uploadId = `upload_${randomUUID()}`;
  const fileName = `${uploadId}${getUploadedImageExtension(request)}`;
  const destination = path.join(assetDirectory, fileName);
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(destination, request.fileData, { flag: 'wx' });

  const url = getCharacterAssetUrl(assetDirectoryName, fileName);
  return {
    image: { fileName, mimeType: request.mimeType, url },
    result: {
      fileName,
      mimeType: request.mimeType,
      originalName: request.fileName,
      size: request.fileData.byteLength,
      url,
    },
    uploadId,
  };
}

async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
  assetDirectoryName: string,
): Promise<CharacterPortraitImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('图片生成任务已完成，但没有返回图片');
  }

  const workspacePath = await getWorkspaceDirectory();
  const assetDirectory = path.join(workspacePath, 'assets', assetDirectoryName);
  await mkdir(assetDirectory, { recursive: true });

  return Promise.all(
    imageUrls.map(async (imageUrl, index) => {
      const parsedImageUrl = new URL(imageUrl);
      if (parsedImageUrl.protocol !== 'https:') {
        throw new Error('图片生成服务返回了不安全的图片地址');
      }
      const response = await fetch(parsedImageUrl, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        throw new Error(`生成图片保存失败（HTTP ${response.status}）`);
      }
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > 50 * 1024 * 1024) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
      if (!mimeType.startsWith('image/')) {
        throw new Error('图片生成服务返回了无效的图片内容');
      }
      const extension = getImageExtension(mimeType, imageUrl);
      const fileName = `${taskId}-${index + 1}${extension}`;
      const fileData = new Uint8Array(await response.arrayBuffer());
      if (fileData.byteLength > 50 * 1024 * 1024) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      await writeFile(path.join(assetDirectory, fileName), fileData);
      return {
        fileName,
        mimeType,
        url: getCharacterAssetUrl(assetDirectoryName, fileName),
      };
    }),
  );
}

function replaceRecord(
  store: StoredPortraitWorkspace,
  record: CharacterPortraitRecord,
): StoredPortraitWorkspace {
  return {
    ...store,
    records: [record, ...store.records.filter(item => item.id !== record.id)].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

function replaceSheetRecord(
  store: StoredPortraitWorkspace,
  record: CharacterSheetRecord,
): StoredPortraitWorkspace {
  return {
    ...store,
    sheetRecords: [record, ...store.sheetRecords.filter(item => item.id !== record.id)].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

export async function getCharacterPortraitWorkspace(): Promise<CharacterPortraitWorkspaceState> {
  const store = await loadPortraitStore();
  return {
    records: store.records,
    selectedImage: store.selectedImage,
    selectedSheet: store.selectedSheet,
    sheetRecords: store.sheetRecords,
  };
}

export async function uploadCharacterPortrait(request: SaveFileRequest): Promise<SavedFileResult> {
  const { image, result, uploadId } = await saveUploadedImage(request, PORTRAIT_ASSET_DIRECTORY);
  const now = new Date().toISOString();
  const record: CharacterPortraitRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: uploadId,
    images: [image],
    originalName: request.fileName,
    progress: 100,
    prompt: '',
    resolution: '1k',
    size: '2:3',
    source: 'uploaded',
    status: 'completed',
    updatedAt: now,
  };
  const store = replaceRecord(await loadPortraitStore(), record);
  store.selectedImage = { fileName: image.fileName, taskId: uploadId };
  store.selectedSheet = null;
  try {
    await savePortraitStore(store);
  } catch (error: unknown) {
    const workspacePath = await getWorkspaceDirectory();
    await unlink(
      path.join(workspacePath, 'assets', PORTRAIT_ASSET_DIRECTORY, image.fileName),
    ).catch(() => undefined);
    throw error;
  }
  return result;
}

export async function uploadCharacterSheet(request: SaveFileRequest): Promise<SavedFileResult> {
  const { image, result, uploadId } = await saveUploadedImage(request, SHEET_ASSET_DIRECTORY);
  const now = new Date().toISOString();
  const record: CharacterSheetRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: uploadId,
    images: [image],
    originalName: request.fileName,
    progress: 100,
    prompt: '',
    referenceImage: null,
    resolution: '1k',
    size: CHARACTER_SHEET_SIZE,
    source: 'uploaded',
    status: 'completed',
    updatedAt: now,
  };
  const store = replaceSheetRecord(await loadPortraitStore(), record);
  store.selectedSheet = { fileName: image.fileName, taskId: uploadId };
  try {
    await savePortraitStore(store);
  } catch (error: unknown) {
    const workspacePath = await getWorkspaceDirectory();
    await unlink(path.join(workspacePath, 'assets', SHEET_ASSET_DIRECTORY, image.fileName)).catch(
      () => undefined,
    );
    throw error;
  }
  return result;
}

export async function deleteCharacterPortrait(
  request: DeleteCharacterPortraitRequest,
): Promise<CharacterPortraitWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('定妆照删除请求无效');
  }

  const store = await loadPortraitStore();
  const record = store.records.find(item => item.id === request.taskId);
  const image = record?.images.find(item => item.fileName === request.fileName);
  if (!record || !image) {
    throw new Error('未找到这张定妆照');
  }
  if (
    store.selectedImage?.taskId === request.taskId &&
    store.selectedImage.fileName === request.fileName
  ) {
    throw new Error('正式定妆照不能删除，请先将其他图片设为正式资产');
  }

  const remainingImages = record.images.filter(item => item.fileName !== request.fileName);
  const nextStore: StoredPortraitWorkspace = {
    ...store,
    records: remainingImages.length
      ? store.records.map(item =>
          item.id === record.id
            ? { ...item, images: remainingImages, updatedAt: new Date().toISOString() }
            : item,
        )
      : store.records.filter(item => item.id !== record.id),
  };

  await savePortraitStore(nextStore);
  try {
    const workspacePath = await getWorkspaceDirectory();
    await unlink(path.join(workspacePath, 'assets', PORTRAIT_ASSET_DIRECTORY, request.fileName));
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await savePortraitStore(store);
      throw new Error(
        error instanceof Error ? `定妆照文件删除失败：${error.message}` : '定妆照文件删除失败',
      );
    }
  }

  return {
    records: nextStore.records,
    selectedImage: nextStore.selectedImage,
    selectedSheet: nextStore.selectedSheet,
    sheetRecords: nextStore.sheetRecords,
  };
}

export async function generateCharacterPortrait(
  request: GenerateCharacterPortraitRequest,
): Promise<CharacterPortraitRecord> {
  validateGenerateRequest(request);
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt: request.prompt.trim(),
      n: request.count,
      size: request.size,
      resolution: request.resolution,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const record: CharacterPortraitRecord = {
    ...request,
    prompt: request.prompt.trim(),
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    originalName: null,
    progress: 0,
    source: 'generated',
    status: 'submitted',
    updatedAt: now,
  };
  const store = replaceRecord(await loadPortraitStore(), record);
  await savePortraitStore(store);
  return record;
}

export async function getCharacterPortraitTask(taskId: string): Promise<CharacterPortraitRecord> {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('图片生成任务编号无效');
  }
  const store = await loadPortraitStore();
  const existingRecord = store.records.find(record => record.id === taskId);
  if (!existingRecord) {
    throw new Error('未找到图片生成任务');
  }
  if (existingRecord.status === 'completed' && existingRecord.images.length > 0) {
    return existingRecord;
  }

  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(
    `${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}?language=zh`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      method: 'GET',
    },
  );
  const taskData = parseTaskData(payload);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }

  const images =
    taskData.status === 'completed'
      ? await downloadTaskImages(taskId, taskData, PORTRAIT_ASSET_DIRECTORY)
      : existingRecord.images;
  const updatedRecord: CharacterPortraitRecord = {
    ...existingRecord,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '图片生成任务未完成'
        : null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existingRecord.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await savePortraitStore(replaceRecord(store, updatedRecord));
  return updatedRecord;
}

export async function generateCharacterSheet(
  request: GenerateCharacterSheetRequest,
): Promise<CharacterSheetRecord> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH ||
    !isPortraitResolution(request.resolution)
  ) {
    throw new Error('角色表生成参数无效');
  }

  const store = await loadPortraitStore();
  const referenceSelection = store.selectedImage;
  const referenceRecord = referenceSelection
    ? store.records.find(record => record.id === referenceSelection.taskId)
    : null;
  const referenceImage = referenceRecord?.images.find(
    image => image.fileName === referenceSelection?.fileName,
  );
  if (!referenceSelection || !referenceImage) {
    throw new Error('请先选定或上传正式定妆照');
  }

  const workspacePath = await getWorkspaceDirectory();
  const referenceData = await readFile(
    path.join(workspacePath, 'assets', PORTRAIT_ASSET_DIRECTORY, referenceImage.fileName),
  );
  if (referenceData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('参考定妆照超过 20 MB，无法用于角色表生成');
  }

  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify({
      image_urls: [`data:${referenceImage.mimeType};base64,${referenceData.toString('base64')}`],
      model: 'gpt-image-2',
      n: 1,
      prompt: request.prompt.trim(),
      resolution: request.resolution,
      size: CHARACTER_SHEET_SIZE,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const record: CharacterSheetRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    originalName: null,
    progress: 0,
    prompt: request.prompt.trim(),
    referenceImage: { ...referenceSelection },
    resolution: request.resolution,
    size: CHARACTER_SHEET_SIZE,
    source: 'generated',
    status: 'submitted',
    updatedAt: now,
  };
  await savePortraitStore(replaceSheetRecord(store, record));
  return record;
}

export async function getCharacterSheetTask(taskId: string): Promise<CharacterSheetRecord> {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('角色表生成任务编号无效');
  }
  const store = await loadPortraitStore();
  const existingRecord = store.sheetRecords.find(record => record.id === taskId);
  if (!existingRecord) {
    throw new Error('未找到角色表生成任务');
  }
  if (existingRecord.status === 'completed' && existingRecord.images.length > 0) {
    return existingRecord;
  }

  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(
    `${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}?language=zh`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      method: 'GET',
    },
  );
  const taskData = parseTaskData(payload);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }

  const images =
    taskData.status === 'completed'
      ? await downloadTaskImages(taskId, taskData, SHEET_ASSET_DIRECTORY)
      : existingRecord.images;
  const updatedRecord: CharacterSheetRecord = {
    ...existingRecord,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '角色表生成任务未完成'
        : null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existingRecord.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await savePortraitStore(replaceSheetRecord(store, updatedRecord));
  return updatedRecord;
}

export async function selectCharacterSheet(
  request: SelectCharacterSheetRequest,
): Promise<CharacterPortraitWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('角色表选择无效');
  }

  const store = await loadPortraitStore();
  const record = store.sheetRecords.find(item => item.id === request.taskId);
  if (!record?.images.some(image => image.fileName === request.fileName)) {
    throw new Error('未找到这张角色表');
  }
  if (
    record.referenceImage &&
    (record.referenceImage.taskId !== store.selectedImage?.taskId ||
      record.referenceImage.fileName !== store.selectedImage.fileName)
  ) {
    throw new Error('这张角色表基于另一张定妆照生成，请重新生成或上传');
  }

  store.selectedSheet = { fileName: request.fileName, taskId: request.taskId };
  await savePortraitStore(store);
  return {
    records: store.records,
    selectedImage: store.selectedImage,
    selectedSheet: store.selectedSheet,
    sheetRecords: store.sheetRecords,
  };
}

export async function deleteCharacterSheet(
  request: DeleteCharacterSheetRequest,
): Promise<CharacterPortraitWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('角色表删除请求无效');
  }

  const store = await loadPortraitStore();
  const record = store.sheetRecords.find(item => item.id === request.taskId);
  const image = record?.images.find(item => item.fileName === request.fileName);
  if (!record || !image) {
    throw new Error('未找到这张角色表');
  }
  if (
    store.selectedSheet?.taskId === request.taskId &&
    store.selectedSheet.fileName === request.fileName
  ) {
    throw new Error('正式角色表不能删除，请先将其他图片设为正式资产');
  }

  const remainingImages = record.images.filter(item => item.fileName !== request.fileName);
  const nextStore: StoredPortraitWorkspace = {
    ...store,
    sheetRecords: remainingImages.length
      ? store.sheetRecords.map(item =>
          item.id === record.id
            ? { ...item, images: remainingImages, updatedAt: new Date().toISOString() }
            : item,
        )
      : store.sheetRecords.filter(item => item.id !== record.id),
  };

  await savePortraitStore(nextStore);
  try {
    const workspacePath = await getWorkspaceDirectory();
    await unlink(path.join(workspacePath, 'assets', SHEET_ASSET_DIRECTORY, request.fileName));
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await savePortraitStore(store);
      throw new Error(
        error instanceof Error ? `角色表文件删除失败：${error.message}` : '角色表文件删除失败',
      );
    }
  }

  return {
    records: nextStore.records,
    selectedImage: nextStore.selectedImage,
    selectedSheet: nextStore.selectedSheet,
    sheetRecords: nextStore.sheetRecords,
  };
}

export async function selectCharacterPortrait(
  request: SelectCharacterPortraitRequest,
): Promise<CharacterPortraitWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('定妆照选择无效');
  }

  const store = await loadPortraitStore();
  const record = store.records.find(item => item.id === request.taskId);
  if (!record?.images.some(image => image.fileName === request.fileName)) {
    throw new Error('未找到这张定妆照');
  }

  const nextSelection = { fileName: request.fileName, taskId: request.taskId };
  const selectionChanged =
    store.selectedImage?.taskId !== nextSelection.taskId ||
    store.selectedImage.fileName !== nextSelection.fileName;
  store.selectedImage = nextSelection;
  if (selectionChanged) {
    store.selectedSheet = null;
  }
  await savePortraitStore(store);
  return {
    records: store.records,
    selectedImage: store.selectedImage,
    selectedSheet: store.selectedSheet,
    sheetRecords: store.sheetRecords,
  };
}
