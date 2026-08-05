import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateText } from 'ai';
import { getChatModelDefinition, isChatModel } from '../../shared/character';
import type { ChatModel } from '../../shared/character';
import type {
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualSize,
  CharacterVisualSource,
  CharacterVisualTaskStatus,
  CharacterVisualWorkspaceState,
  GenerateCharacterActionPromptRequest,
  GenerateCharacterActionRequest,
  GenerateCharacterReferenceBoardRequest,
  RenameCharacterVisualAssetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
} from '../../shared/character-visual';
import {
  CHARACTER_REFERENCE_BOARD_SIZE,
  CHARACTER_VISUAL_RESOLUTIONS,
  CHARACTER_VISUAL_SIZES,
  MAX_CHARACTER_ACTION_LENGTH,
  MAX_CHARACTER_REFERENCE_IMAGES,
} from '../../shared/character-visual';
import type { SaveFileRequest, SavedFileResult } from '../../shared/desktop';
import { createChatLanguageModel, getChatProviderOptions } from './chat-provider';
import { getActiveCharacterDirectory, getCharacterDirectory } from './character-library';
import { getCredentialValue } from './credentials';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';
import { isPlainObject } from 'es-toolkit';

const API_BASE_URL = 'https://api.apimart.ai';
const LEGACY_VISUAL_STORE_FILE_NAME = 'character-portraits.json';
const LEGACY_ACTION_ASSET_DIRECTORY = 'character-portraits';
const LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY = 'character-sheets';
const MAX_PROMPT_LENGTH = 20_000;
const MAX_STORED_PROMPT_LENGTH = 50_000;
const MAX_NAME_LENGTH = 80;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

type LegacyVisualAssetKind = 'portrait' | 'sheet';

interface LegacyVisualAssetSelection extends CharacterVisualAssetSelection {
  kind: LegacyVisualAssetKind;
}

interface LegacyActionRecord extends Omit<CharacterVisualAssetRecord, 'referenceAssets'> {
  referenceAsset?: LegacyVisualAssetSelection | null;
}

interface LegacyReferenceBoardRecord extends Omit<CharacterVisualAssetRecord, 'referenceAssets'> {
  count: 1;
  referenceAssets: LegacyVisualAssetSelection[];
  referenceImage: CharacterVisualAssetSelection | null;
  size: typeof CHARACTER_REFERENCE_BOARD_SIZE;
}

interface StoredVisualWorkspace {
  officialAssets: LegacyVisualAssetSelection[];
  records: LegacyActionRecord[];
  selectedImage: CharacterVisualAssetSelection | null;
  selectedSheet: CharacterVisualAssetSelection | null;
  sheetRecords: LegacyReferenceBoardRecord[];
  version: 3;
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

export interface OfficialCharacterVisualReference {
  directoryName: string;
  image: CharacterVisualImage;
  selection: CharacterVisualAssetSelection;
}

export type CharacterVisualReference = OfficialCharacterVisualReference;

function isVisualSize(value: unknown): value is CharacterVisualSize {
  return CHARACTER_VISUAL_SIZES.includes(value as CharacterVisualSize);
}

function isVisualResolution(value: unknown): value is CharacterVisualResolution {
  return CHARACTER_VISUAL_RESOLUTIONS.includes(value as CharacterVisualResolution);
}

function isTaskStatus(value: unknown): value is CharacterVisualTaskStatus {
  return ['submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(value),
  );
}

function getCharacterAssetUrl(directoryName: string, fileName: string): string {
  return `app://bundle/workspace-assets/${directoryName}/${encodeURIComponent(fileName)}`;
}

function parseImage(
  value: unknown,
  directoryName: string,
  fallbackName?: string,
): CharacterVisualImage | null {
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
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : fallbackName,
    url: getCharacterAssetUrl(directoryName, value.fileName),
  };
}

function parseLegacyActionRecord(value: unknown): LegacyActionRecord | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !TASK_ID_PATTERN.test(value.id) ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    !isVisualSize(value.size) ||
    !isVisualResolution(value.resolution) ||
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
        .map(image => parseImage(image, LEGACY_ACTION_ASSET_DIRECTORY, '角色视觉'))
        .filter((image): image is CharacterVisualImage => Boolean(image))
    : [];

  return {
    count: value.count,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : '角色视觉',
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referenceAsset: parseLegacyVisualAssetSelection(value.referenceAsset),
    resolution: value.resolution,
    size: value.size,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

function parseLegacyReferenceBoardRecord(value: unknown): LegacyReferenceBoardRecord | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !TASK_ID_PATTERN.test(value.id) ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    value.size !== CHARACTER_REFERENCE_BOARD_SIZE ||
    !isVisualResolution(value.resolution) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }

  const images = Array.isArray(value.images)
    ? value.images
        .map(image => parseImage(image, LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY, '角色参考板'))
        .filter((image): image is CharacterVisualImage => Boolean(image))
    : [];
  const parsedReferenceAssets = Array.isArray(value.referenceAssets)
    ? value.referenceAssets
        .map(parseLegacyVisualAssetSelection)
        .filter((asset): asset is LegacyVisualAssetSelection => Boolean(asset))
    : [];
  const referenceAssets = [
    ...new Map(parsedReferenceAssets.map(asset => [legacySelectionKey(asset), asset])).values(),
  ].slice(0, MAX_CHARACTER_REFERENCE_IMAGES);
  const legacyReferenceImage = parseSelection(value.referenceImage);

  return {
    count: 1,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : '角色参考板',
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referenceAssets,
    referenceImage:
      legacyReferenceImage ??
      (referenceAssets[0]
        ? { fileName: referenceAssets[0].fileName, taskId: referenceAssets[0].taskId }
        : null),
    resolution: value.resolution,
    size: CHARACTER_REFERENCE_BOARD_SIZE,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

function parseSelection(value: unknown): CharacterVisualAssetSelection | null {
  if (
    !isPlainObject(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(value.taskId)
  ) {
    return null;
  }
  return { fileName: value.fileName, taskId: value.taskId };
}

function parseLegacyVisualAssetSelection(value: unknown): LegacyVisualAssetSelection | null {
  const selection = parseSelection(value);
  if (
    !selection ||
    !isPlainObject(value) ||
    (value.kind !== 'portrait' && value.kind !== 'sheet')
  ) {
    return null;
  }
  return { ...selection, kind: value.kind };
}

function legacySelectionKey(selection: LegacyVisualAssetSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

function selectionKey(selection: CharacterVisualAssetSelection): string {
  return `${selection.taskId}:${selection.fileName}`;
}

function getOfficialAssets(value: Record<string, unknown>): LegacyVisualAssetSelection[] {
  if (Array.isArray(value.officialAssets)) {
    const assets = value.officialAssets
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

function syncLegacySelections(store: StoredVisualWorkspace): void {
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

function toWorkspaceState(store: StoredVisualWorkspace): CharacterVisualWorkspaceState {
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

function toVisualAssetSelection(
  selection: LegacyVisualAssetSelection,
): CharacterVisualAssetSelection {
  return { fileName: selection.fileName, taskId: selection.taskId };
}

function toVisualAssetRecord(
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

function getAssetDirectory(image: CharacterVisualImage): string {
  return image.url.includes(`/${LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY}/`)
    ? LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY
    : LEGACY_ACTION_ASSET_DIRECTORY;
}

export function getOfficialCharacterVisualReferences(
  workspace: CharacterVisualWorkspaceState,
): OfficialCharacterVisualReference[] {
  const officialKeys = new Set(workspace.officialAssets.map(selectionKey));
  return getCharacterVisualReferences(workspace).filter(reference =>
    officialKeys.has(selectionKey(reference.selection)),
  );
}

export function getCharacterVisualReferences(
  workspace: CharacterVisualWorkspaceState,
): CharacterVisualReference[] {
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

// Historical names are isolated here so existing workspaces remain readable.
async function getLegacyVisualStorePath(characterId?: string): Promise<string> {
  const characterDirectory = characterId
    ? await getCharacterDirectory(characterId)
    : await getActiveCharacterDirectory();
  return path.join(characterDirectory, LEGACY_VISUAL_STORE_FILE_NAME);
}

async function loadVisualStore(characterId?: string): Promise<StoredVisualWorkspace> {
  const storePath = await getLegacyVisualStorePath(characterId);
  const value = await readJsonFile(storePath);
  if (!isPlainObject(value)) {
    return {
      officialAssets: [],
      records: [],
      selectedImage: null,
      selectedSheet: null,
      sheetRecords: [],
      version: 3,
    };
  }

  const records = Array.isArray(value.records)
    ? value.records
        .map(parseLegacyActionRecord)
        .filter((record): record is LegacyActionRecord => Boolean(record))
    : [];
  const sheetRecords = Array.isArray(value.sheetRecords)
    ? value.sheetRecords
        .map(parseLegacyReferenceBoardRecord)
        .filter((record): record is LegacyReferenceBoardRecord => Boolean(record))
    : [];

  const store: StoredVisualWorkspace = {
    officialAssets: getOfficialAssets(value),
    records: records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    selectedImage: parseSelection(value.selectedImage),
    selectedSheet: parseSelection(value.selectedSheet),
    sheetRecords: sheetRecords.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    version: 3,
  };
  store.officialAssets = store.officialAssets.filter(asset => {
    const recordList = asset.kind === 'portrait' ? store.records : store.sheetRecords;
    return recordList
      .find(record => record.id === asset.taskId)
      ?.images.some(image => image.fileName === asset.fileName);
  });
  syncLegacySelections(store);
  if (value.version !== 3) {
    await writeJsonFile(storePath, store);
  }
  return store;
}

async function saveVisualStore(store: StoredVisualWorkspace, characterId?: string): Promise<void> {
  await writeJsonFile(await getLegacyVisualStorePath(characterId), store);
}

function validateGenerateRequest(
  request: GenerateCharacterActionRequest,
): CharacterVisualAssetSelection {
  if (!isPlainObject(request)) {
    throw new Error('生成参数无效');
  }
  if (
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.action !== 'string' ||
    !request.action.trim() ||
    request.action.length > MAX_CHARACTER_ACTION_LENGTH
  ) {
    throw new Error('角色动作名称或描述无效');
  }
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > 4) {
    throw new Error('候选张数必须在 1 到 4 之间');
  }
  if (!isVisualSize(request.size) || !isVisualResolution(request.resolution)) {
    throw new Error('图片规格无效');
  }
  return validateVisualAssetSelection(request.referenceAsset);
}

function buildCharacterActionPrompt(action: string): string {
  return [
    '以参考图中的角色为唯一身份与视觉依据，生成同一个角色的全身动作视觉资产。',
    `本次唯一允许改变的是角色姿势与肢体动作：${action.trim()}`,
    '必须严格保持参考图中的脸部特征、面部表情、发型、身材比例、服装、鞋子、配色、配饰、绘制风格、线条、材质和细节密度完全一致。',
    '保持单一角色、全身完整入镜和干净背景。根据动作调整身体朝向与四肢位置，但不要重新设计角色。',
    '禁止改变外貌、表情、服装或画风；禁止新增道具、场景、其他人物、文字、Logo、水印或拼贴排版。',
  ].join('\n');
}

function resolveChatModel(value: unknown): ChatModel {
  if (!isChatModel(value)) {
    throw new Error('聊天模型无效');
  }
  return value;
}

export async function generateCharacterActionPrompt(
  request: GenerateCharacterActionPromptRequest,
): Promise<string> {
  if (
    !isPlainObject(request) ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error('请先填写有效的动作名称');
  }
  const model = resolveChatModel(request.model);
  const apiKey = await getCredentialValue(getChatModelDefinition(model).provider);
  const providerOptions = getChatProviderOptions(model);
  const { text } = await generateText({
    maxOutputTokens: 600,
    model: createChatLanguageModel(apiKey, model),
    prompt: `动作名称：${request.name.trim()}`,
    ...(providerOptions ? { providerOptions } : {}),
    system: `你负责为角色动作图生图编写中文提示词。根据用户给出的动作名称，输出一段可直接编辑和用于生图的姿势描述。

要求：
1. 只描述身体朝向、重心、躯干角度、头部角度、手臂、手势、腿部和脚步的位置关系，让姿势清晰且符合人体结构。
2. 不描述或改变角色的外貌、面部表情、视线、发型、身材、服装、配色、配饰和绘画风格，这些全部由参考图决定。
3. 不添加道具、场景、其他人物、文字、尺寸、分辨率或模型名称。
4. 不写解释、标题、Markdown 或引号，控制在 80 至 180 个中文字符，只输出提示词正文。`,
  });
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('聊天模型未返回动作提示词');
  }
  return prompt.slice(0, MAX_CHARACTER_ACTION_LENGTH);
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    isPlainObject(payload) &&
    isPlainObject(payload.error) &&
    typeof payload.error.message === 'string'
  ) {
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
  if (!isPlainObject(payload) || !Array.isArray(payload.data)) {
    throw new Error('图片生成服务未返回任务编号');
  }
  const firstItem = payload.data[0];
  if (!isPlainObject(firstItem) || typeof firstItem.task_id !== 'string') {
    throw new Error('图片生成服务未返回任务编号');
  }
  if (!TASK_ID_PATTERN.test(firstItem.task_id)) {
    throw new Error('图片生成服务返回了无效的任务编号');
  }
  return firstItem.task_id;
}

function parseTaskData(payload: unknown): ApiTaskData {
  if (!isPlainObject(payload) || !isPlainObject(payload.data)) {
    throw new Error('图片生成服务返回了无效的任务状态');
  }

  const data = payload.data;
  const error = isPlainObject(data.error)
    ? { message: typeof data.error.message === 'string' ? data.error.message : undefined }
    : undefined;
  const resultImages =
    isPlainObject(data.result) && Array.isArray(data.result.images)
      ? data.result.images.filter(isPlainObject).map(image => ({
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

function validateImageUploadRequest(request: SaveFileRequest & { name?: string }): void {
  if (
    !isPlainObject(request) ||
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
  if (
    request.name !== undefined &&
    (typeof request.name !== 'string' ||
      !request.name.trim() ||
      request.name.length > MAX_NAME_LENGTH)
  ) {
    throw new Error('角色视觉名称无效');
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
  request: SaveFileRequest & { name?: string },
  assetDirectoryName: string,
): Promise<{ image: CharacterVisualImage; result: SavedFileResult; uploadId: string }> {
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
    image: {
      fileName,
      mimeType: request.mimeType,
      name: request.name?.trim(),
      url,
    },
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
  name: string,
): Promise<CharacterVisualImage[]> {
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
        name: imageUrls.length > 1 ? `${name} ${index + 1}` : name,
        url: getCharacterAssetUrl(assetDirectoryName, fileName),
      };
    }),
  );
}

function replaceRecord(
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

function replaceSheetRecord(
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

export async function getCharacterVisualWorkspace(
  characterId?: string,
): Promise<CharacterVisualWorkspaceState> {
  return toWorkspaceState(await loadVisualStore(characterId));
}

function validateVisualAssetSelection(
  request: CharacterVisualAssetSelection,
): CharacterVisualAssetSelection {
  if (
    !isPlainObject(request) ||
    typeof request.taskId !== 'string' ||
    !TASK_ID_PATTERN.test(request.taskId) ||
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

function findVisualAsset(
  store: StoredVisualWorkspace,
  selection: CharacterVisualAssetSelection,
): {
  directoryName: string;
  image: CharacterVisualImage;
  record: LegacyActionRecord | LegacyReferenceBoardRecord;
  selection: LegacyVisualAssetSelection;
} {
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
    const workspacePath = await getWorkspaceDirectory();
    await unlink(
      path.join(workspacePath, 'assets', LEGACY_ACTION_ASSET_DIRECTORY, image.fileName),
    ).catch(() => undefined);
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
  const selection: LegacyVisualAssetSelection = {
    fileName: image.fileName,
    kind: 'portrait',
    taskId: uploadId,
  };
  const store = replaceRecord(await loadVisualStore(characterId), record);
  store.officialAssets = [selection];
  syncLegacySelections(store);
  try {
    await saveVisualStore(store, characterId);
  } catch (error: unknown) {
    const workspacePath = await getWorkspaceDirectory();
    await unlink(
      path.join(workspacePath, 'assets', LEGACY_ACTION_ASSET_DIRECTORY, image.fileName),
    ).catch(() => undefined);
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
  const nextStore: StoredVisualWorkspace = {
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
    const workspacePath = await getWorkspaceDirectory();
    await unlink(path.join(workspacePath, 'assets', directoryName, selection.fileName));
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

export async function generateCharacterAction(
  request: GenerateCharacterActionRequest,
): Promise<CharacterVisualAssetRecord> {
  const referenceAsset = validateGenerateRequest(request);
  const store = await loadVisualStore();
  const reference = findVisualAsset(store, referenceAsset);
  if (
    !store.officialAssets.some(
      asset => legacySelectionKey(asset) === legacySelectionKey(reference.selection),
    )
  ) {
    throw new Error('动作参考图必须是当前角色的正式视觉');
  }
  const { directoryName, image } = reference;
  const workspacePath = await getWorkspaceDirectory();
  const referenceData = await readFile(
    path.join(workspacePath, 'assets', directoryName, image.fileName),
  );
  if (referenceData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error(`正式角色视觉图片“${image.name || image.fileName}”超过 20 MB`);
  }
  const apiKey = await getCredentialValue('apimart');
  const body: Record<string, unknown> = {
    image_urls: [`data:${image.mimeType};base64,${referenceData.toString('base64')}`],
    model: 'gpt-image-2',
    n: request.count,
    prompt: buildCharacterActionPrompt(request.action),
    resolution: request.resolution,
    size: request.size,
  };
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const record: LegacyActionRecord = {
    count: request.count,
    name: request.name.trim(),
    prompt: request.action.trim(),
    referenceAsset: reference.selection,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    originalName: null,
    progress: 0,
    source: 'generated',
    status: 'submitted',
    resolution: request.resolution,
    size: request.size,
    updatedAt: now,
  };
  await saveVisualStore(replaceRecord(store, record));
  return toVisualAssetRecord(record, 'action');
}

export async function getCharacterVisualAssetTask(
  taskId: string,
): Promise<CharacterVisualAssetRecord> {
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('图片生成任务编号无效');
  }
  const store = await loadVisualStore();
  const actionRecord = store.records.find(record => record.id === taskId);
  const referenceBoardRecord = store.sheetRecords.find(record => record.id === taskId);
  const existingRecord = actionRecord ?? referenceBoardRecord;
  if (!existingRecord) {
    throw new Error('未找到图片生成任务');
  }
  if (existingRecord.status === 'completed' && existingRecord.images.length > 0) {
    return toVisualAssetRecord(existingRecord, actionRecord ? 'action' : 'reference-board');
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
      ? await downloadTaskImages(
          taskId,
          taskData,
          actionRecord ? LEGACY_ACTION_ASSET_DIRECTORY : LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY,
          existingRecord.name,
        )
      : existingRecord.images;
  const updatedRecord = {
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
  await saveVisualStore(
    actionRecord
      ? replaceRecord(store, updatedRecord as LegacyActionRecord)
      : replaceSheetRecord(store, updatedRecord as LegacyReferenceBoardRecord),
  );
  return toVisualAssetRecord(updatedRecord, actionRecord ? 'action' : 'reference-board');
}

export async function generateCharacterReferenceBoard(
  request: GenerateCharacterReferenceBoardRequest,
): Promise<CharacterVisualAssetRecord> {
  if (
    !isPlainObject(request) ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH ||
    !Array.isArray(request.referenceAssets) ||
    request.referenceAssets.length < 1 ||
    request.referenceAssets.length > MAX_CHARACTER_REFERENCE_IMAGES ||
    !isVisualResolution(request.resolution)
  ) {
    throw new Error('参考图生成参数无效');
  }

  const store = await loadVisualStore();
  const parsedReferenceAssets = request.referenceAssets.map(validateVisualAssetSelection);
  const publicReferenceAssets = [
    ...new Map(parsedReferenceAssets.map(asset => [selectionKey(asset), asset])).values(),
  ];
  const references = publicReferenceAssets.map(referenceAsset =>
    findVisualAsset(store, referenceAsset),
  );
  if (
    references.some(
      reference =>
        !store.officialAssets.some(
          asset => legacySelectionKey(asset) === legacySelectionKey(reference.selection),
        ),
    )
  ) {
    throw new Error('画布连接的参考图包含非正式资产');
  }

  const workspacePath = await getWorkspaceDirectory();
  const referenceImageUrls = await Promise.all(
    references.map(async ({ directoryName, image }) => {
      const referenceData = await readFile(
        path.join(workspacePath, 'assets', directoryName, image.fileName),
      );
      if (referenceData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
        throw new Error(`正式角色视觉图片“${image.name || image.fileName}”超过 20 MB`);
      }
      return `data:${image.mimeType};base64,${referenceData.toString('base64')}`;
    }),
  );
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify({
      image_urls: referenceImageUrls,
      model: 'gpt-image-2',
      n: 1,
      prompt: request.prompt.trim(),
      resolution: request.resolution,
      size: CHARACTER_REFERENCE_BOARD_SIZE,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const record: LegacyReferenceBoardRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    name: request.name.trim(),
    originalName: null,
    progress: 0,
    prompt: request.prompt.trim(),
    referenceAssets: references.map(reference => reference.selection),
    referenceImage: publicReferenceAssets[0]
      ? {
          fileName: publicReferenceAssets[0].fileName,
          taskId: publicReferenceAssets[0].taskId,
        }
      : null,
    resolution: request.resolution,
    size: CHARACTER_REFERENCE_BOARD_SIZE,
    source: 'generated',
    status: 'submitted',
    updatedAt: now,
  };
  await saveVisualStore(replaceSheetRecord(store, record));
  return toVisualAssetRecord(record, 'reference-board');
}
