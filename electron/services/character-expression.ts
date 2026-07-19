import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterExpressionRecord,
  CharacterExpressionSize,
  CharacterExpressionWorkspaceState,
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from '../../shared/character-expression';
import { CHARACTER_EXPRESSION_SIZES } from '../../shared/character-expression';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from '../../shared/character-portrait';
import { CHARACTER_PORTRAIT_RESOLUTIONS } from '../../shared/character-portrait';
import type { SavedFileResult } from '../../shared/desktop';
import { getActiveCharacterDirectory } from './character-library';
import { getCharacterPortraitWorkspace } from './character-portrait';
import { getCredentialValue } from './credentials';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const API_BASE_URL = 'https://api.apimart.ai';
const EXPRESSION_STORE_FILE_NAME = 'character-expressions.json';
const EXPRESSION_ASSET_DIRECTORY = 'character-expressions';
const PORTRAIT_ASSET_DIRECTORY = 'character-portraits';
const SHEET_ASSET_DIRECTORY = 'character-sheets';
const MAX_NAME_LENGTH = 80;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_RESULT_IMAGE_SIZE = 50 * 1024 * 1024;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

interface StoredExpressionWorkspace {
  records: CharacterExpressionRecord[];
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

function isExpressionSize(value: unknown): value is CharacterExpressionSize {
  return CHARACTER_EXPRESSION_SIZES.includes(value as CharacterExpressionSize);
}

function isResolution(value: unknown): value is CharacterPortraitResolution {
  return CHARACTER_PORTRAIT_RESOLUTIONS.includes(value as CharacterPortraitResolution);
}

function isTaskStatus(value: unknown): value is CharacterPortraitTaskStatus {
  return ['submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(value),
  );
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

function getExpressionAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${EXPRESSION_ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
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
    url: getExpressionAssetUrl(value.fileName),
  };
}

function parseExpressionRecord(value: unknown): CharacterExpressionRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !TASK_ID_PATTERN.test(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > MAX_NAME_LENGTH ||
    typeof value.description !== 'string' ||
    value.description.length > MAX_PROMPT_LENGTH ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_PROMPT_LENGTH ||
    !isExpressionSize(value.size) ||
    !isResolution(value.resolution) ||
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
        .map(parseImage)
        .filter((image): image is CharacterPortraitImage => Boolean(image))
    : [];

  return {
    count: value.count,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    description: value.description,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    name: value.name.trim(),
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referencePortrait: parseSelection(value.referencePortrait),
    referenceSheet: parseSelection(value.referenceSheet),
    resolution: value.resolution,
    size: value.size,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

async function getExpressionStorePath(): Promise<string> {
  return path.join(await getActiveCharacterDirectory(), EXPRESSION_STORE_FILE_NAME);
}

async function loadExpressionStore(): Promise<StoredExpressionWorkspace> {
  const value = await readJsonFile(await getExpressionStorePath());
  if (!isRecord(value)) {
    return { records: [], version: 1 };
  }
  const records = Array.isArray(value.records)
    ? value.records
        .map(parseExpressionRecord)
        .filter((record): record is CharacterExpressionRecord => Boolean(record))
    : [];
  return {
    records: records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    version: 1,
  };
}

async function saveExpressionStore(store: StoredExpressionWorkspace): Promise<void> {
  await writeJsonFile(await getExpressionStorePath(), store);
}

function replaceRecord(
  store: StoredExpressionWorkspace,
  record: CharacterExpressionRecord,
): StoredExpressionWorkspace {
  return {
    ...store,
    records: [record, ...store.records.filter(item => item.id !== record.id)].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

function validateGenerateRequest(request: GenerateCharacterExpressionRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.description !== 'string' ||
    !request.description.trim() ||
    request.description.length > MAX_PROMPT_LENGTH ||
    !Number.isInteger(request.count) ||
    request.count < 1 ||
    request.count > 4 ||
    !isExpressionSize(request.size) ||
    !isResolution(request.resolution)
  ) {
    throw new Error('表情生成参数无效');
  }
}

function buildExpressionPrompt(request: GenerateCharacterExpressionRequest): string {
  return [
    '参考图中的角色是唯一要画的人，使用定妆照确认脸部、服装和整体画风，使用角色表确认完整造型和各角度结构。',
    `目标表情：${request.name.trim()}`,
    `表情描述：${request.description.trim()}`,
    '保持角色身份、脸型、五官、发型、服装、配饰、颜色和绘画风格与参考图一致，只改变面部表情和与情绪相符的轻微姿态。',
    '构图以清楚展示表情为主，使用头肩像或半身像，主体居中，轮廓完整，背景干净简单。',
    '不要添加文字、对话框、边框、Logo、水印、额外人物、重复五官或多格排版。',
  ].join('\n');
}

function validateUploadRequest(request: UploadCharacterExpressionRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName ||
    !(request.fileData instanceof Uint8Array) ||
    typeof request.mimeType !== 'string' ||
    !request.mimeType.startsWith('image/')
  ) {
    throw new Error('上传的表情图片无效');
  }
  if (request.fileData.byteLength === 0 || request.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('表情图片大小必须在 20 MB 以内');
  }
}

function getUploadedImageExtension(request: UploadCharacterExpressionRequest): string {
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

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message;
  }
  return fallback;
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
  const extensions: Record<string, string> = {
    'image/avif': '.avif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const normalizedMimeType = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (normalizedMimeType && extensions[normalizedMimeType]) {
    return extensions[normalizedMimeType];
  }
  const urlExtension = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return ['.avif', '.jpeg', '.jpg', '.png', '.webp'].includes(urlExtension) ? urlExtension : '.png';
}

async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
): Promise<CharacterPortraitImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('表情生成任务已完成，但没有返回图片');
  }
  const workspacePath = await getWorkspaceDirectory();
  const assetDirectory = path.join(workspacePath, 'assets', EXPRESSION_ASSET_DIRECTORY);
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
      if (contentLength > MAX_RESULT_IMAGE_SIZE) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
      if (!mimeType.startsWith('image/')) {
        throw new Error('图片生成服务返回了无效的图片内容');
      }
      const fileData = new Uint8Array(await response.arrayBuffer());
      if (fileData.byteLength > MAX_RESULT_IMAGE_SIZE) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      const fileName = `${taskId}-${index + 1}${getImageExtension(mimeType, imageUrl)}`;
      await writeFile(path.join(assetDirectory, fileName), fileData);
      return { fileName, mimeType, url: getExpressionAssetUrl(fileName) };
    }),
  );
}

async function getReferenceData(
  selection: CharacterPortraitSelection,
  directoryName: string,
  image: CharacterPortraitImage,
): Promise<string> {
  if (selection.fileName !== image.fileName) {
    throw new Error('角色参考图选择已失效，请重新确认角色视觉资产');
  }
  const workspacePath = await getWorkspaceDirectory();
  const imageData = await readFile(
    path.join(workspacePath, 'assets', directoryName, image.fileName),
  );
  if (imageData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('角色参考图超过 20 MB，无法用于表情生成');
  }
  return `data:${image.mimeType};base64,${imageData.toString('base64')}`;
}

export async function getCharacterExpressionWorkspace(): Promise<CharacterExpressionWorkspaceState> {
  const store = await loadExpressionStore();
  return { records: store.records };
}

export async function generateCharacterExpression(
  request: GenerateCharacterExpressionRequest,
): Promise<CharacterExpressionRecord> {
  validateGenerateRequest(request);
  const portraitWorkspace = await getCharacterPortraitWorkspace();
  const portraitSelection = portraitWorkspace.selectedImage;
  const sheetSelection = portraitWorkspace.selectedSheet;
  const portraitRecord = portraitSelection
    ? portraitWorkspace.records.find(record => record.id === portraitSelection.taskId)
    : null;
  const sheetRecord = sheetSelection
    ? portraitWorkspace.sheetRecords.find(record => record.id === sheetSelection.taskId)
    : null;
  const portraitImage = portraitRecord?.images.find(
    image => image.fileName === portraitSelection?.fileName,
  );
  const sheetImage = sheetRecord?.images.find(image => image.fileName === sheetSelection?.fileName);
  if (!portraitSelection || !portraitImage) {
    throw new Error('请先选定或上传正式定妆照');
  }
  if (!sheetSelection || !sheetImage) {
    throw new Error('请先选定或上传正式角色表');
  }

  const imageUrls = await Promise.all([
    getReferenceData(portraitSelection, PORTRAIT_ASSET_DIRECTORY, portraitImage),
    getReferenceData(sheetSelection, SHEET_ASSET_DIRECTORY, sheetImage),
  ]);
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify({
      image_urls: imageUrls,
      model: 'gpt-image-2',
      n: request.count,
      prompt: buildExpressionPrompt(request),
      resolution: request.resolution,
      size: request.size,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const prompt = buildExpressionPrompt(request);
  const record: CharacterExpressionRecord = {
    count: request.count,
    createdAt: now,
    description: request.description.trim(),
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    name: request.name.trim(),
    originalName: null,
    progress: 0,
    prompt,
    referencePortrait: { ...portraitSelection },
    referenceSheet: { ...sheetSelection },
    resolution: request.resolution,
    size: request.size,
    source: 'generated',
    status: 'submitted',
    updatedAt: now,
  };
  await saveExpressionStore(replaceRecord(await loadExpressionStore(), record));
  return record;
}

export async function getCharacterExpressionTask(
  taskId: string,
): Promise<CharacterExpressionRecord> {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('表情生成任务编号无效');
  }
  const store = await loadExpressionStore();
  const existingRecord = store.records.find(record => record.id === taskId);
  if (!existingRecord) {
    throw new Error('未找到表情生成任务');
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
      ? await downloadTaskImages(taskId, taskData)
      : existingRecord.images;
  const updatedRecord: CharacterExpressionRecord = {
    ...existingRecord,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '表情生成任务未完成'
        : null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existingRecord.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await saveExpressionStore(replaceRecord(store, updatedRecord));
  return updatedRecord;
}

export async function uploadCharacterExpression(
  request: UploadCharacterExpressionRequest,
): Promise<SavedFileResult> {
  validateUploadRequest(request);
  const workspacePath = await getWorkspaceDirectory();
  const assetDirectory = path.join(workspacePath, 'assets', EXPRESSION_ASSET_DIRECTORY);
  const uploadId = `upload_${randomUUID()}`;
  const fileName = `${uploadId}${getUploadedImageExtension(request)}`;
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(path.join(assetDirectory, fileName), request.fileData, { flag: 'wx' });

  const now = new Date().toISOString();
  const record: CharacterExpressionRecord = {
    count: 1,
    createdAt: now,
    description: '',
    errorMessage: null,
    id: uploadId,
    images: [{ fileName, mimeType: request.mimeType, url: getExpressionAssetUrl(fileName) }],
    name: request.name.trim(),
    originalName: request.fileName,
    progress: 100,
    prompt: '',
    referencePortrait: null,
    referenceSheet: null,
    resolution: '1k',
    size: '1:1',
    source: 'uploaded',
    status: 'completed',
    updatedAt: now,
  };
  try {
    await saveExpressionStore(replaceRecord(await loadExpressionStore(), record));
  } catch (error: unknown) {
    await unlink(path.join(assetDirectory, fileName)).catch(() => undefined);
    throw error;
  }

  return {
    fileName,
    mimeType: request.mimeType,
    originalName: request.fileName,
    size: request.fileData.byteLength,
    url: getExpressionAssetUrl(fileName),
  };
}

export async function renameCharacterExpression(
  request: RenameCharacterExpressionRequest,
): Promise<CharacterExpressionWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error('表情名称无效');
  }

  const store = await loadExpressionStore();
  const record = store.records.find(item => item.id === request.taskId);
  if (!record) {
    throw new Error('未找到要重命名的表情');
  }
  if (record.status !== 'completed') {
    throw new Error('表情完成后才能重命名');
  }

  const normalizedName = request.name.trim();
  const nextStore: StoredExpressionWorkspace = {
    ...store,
    records: store.records.map(item =>
      item.id === record.id
        ? { ...item, name: normalizedName, updatedAt: new Date().toISOString() }
        : item,
    ),
  };
  await saveExpressionStore(nextStore);
  return { records: nextStore.records };
}

export async function deleteCharacterExpression(
  request: DeleteCharacterExpressionRequest,
): Promise<CharacterExpressionWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName
  ) {
    throw new Error('表情删除请求无效');
  }
  const store = await loadExpressionStore();
  const record = store.records.find(item => item.id === request.taskId);
  const image = record?.images.find(item => item.fileName === request.fileName);
  if (!record || !image) {
    throw new Error('未找到这张表情图片');
  }

  const remainingImages = record.images.filter(item => item.fileName !== request.fileName);
  const nextStore: StoredExpressionWorkspace = {
    ...store,
    records: remainingImages.length
      ? store.records.map(item =>
          item.id === record.id
            ? { ...item, images: remainingImages, updatedAt: new Date().toISOString() }
            : item,
        )
      : store.records.filter(item => item.id !== record.id),
  };
  await saveExpressionStore(nextStore);
  try {
    const workspacePath = await getWorkspaceDirectory();
    await unlink(path.join(workspacePath, 'assets', EXPRESSION_ASSET_DIRECTORY, request.fileName));
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await saveExpressionStore(store);
      throw new Error(
        error instanceof Error ? `表情图片删除失败：${error.message}` : '表情图片删除失败',
      );
    }
  }
  return { records: nextStore.records };
}
