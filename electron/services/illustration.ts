import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArtStyle } from '../../shared/art-style';
import type { CharacterExpressionReferenceSelection } from '../../shared/character-expression';
import type { IllustrationAgentMessage } from '../../shared/illustration';
import type {
  CreateIllustrationTopicRequest,
  DeleteIllustrationUploadRequest,
  DeleteIllustrationTopicRequest,
  DeleteIllustrationVersionRequest,
  GenerateIllustrationRequest,
  IllustrationBrief,
  IllustrationBriefUpdateResult,
  IllustrationSize,
  IllustrationStyleReference,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
  IllustrationWorkspaceState,
  SaveIllustrationConversationRequest,
  SelectIllustrationStyleReferenceRequest,
  UpdateIllustrationTopicRequest,
  UploadedIllustration,
  UploadIllustrationRequest,
} from '../../shared/illustration';
import {
  ILLUSTRATION_SIZES,
  MAX_ILLUSTRATION_REFERENCE_IMAGES,
  createEmptyIllustrationBrief,
} from '../../shared/illustration';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from '../../shared/character-portrait';
import { CHARACTER_PORTRAIT_RESOLUTIONS } from '../../shared/character-portrait';
import { getArtStyleWorkspace, importArtStyleReference, readArtStyleReference } from './art-style';
import { getCharacterExpressionWorkspace } from './character-expression';
import { getCharacterLibrary } from './character-library';
import {
  getCharacterPortraitWorkspace,
  getOfficialCharacterVisualReferences,
} from './character-portrait';
import { getCredentialValue } from './credentials';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const API_BASE_URL = 'https://api.apimart.ai';
const STORE_FILE_NAME = 'illustrations.json';
const ASSET_DIRECTORY = 'illustrations';
const EXPRESSION_ASSET_DIRECTORY = 'character-expressions';
const MAX_TITLE_LENGTH = 100;
const MAX_TEXT_LENGTH = 20_000;
const MAX_STORED_PROMPT_LENGTH = 50_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_RESULT_IMAGE_SIZE = 50 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const BRIEF_FIELDS: (keyof IllustrationBrief)[] = [
  'action',
  'composition',
  'details',
  'environment',
  'finalPrompt',
  'mood',
  'style',
  'subject',
];

interface StoredIllustrationWorkspace {
  topics: IllustrationTopic[];
  uploads: UploadedIllustration[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSize(value: unknown): value is IllustrationSize {
  return ILLUSTRATION_SIZES.includes(value as IllustrationSize);
}

function isResolution(value: unknown): value is CharacterPortraitResolution {
  return CHARACTER_PORTRAIT_RESOLUTIONS.includes(value as CharacterPortraitResolution);
}

function isTaskStatus(value: unknown): value is CharacterPortraitTaskStatus {
  return ['submitted', 'pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
    String(value),
  );
}

function parseBrief(value: unknown): IllustrationBrief {
  const brief = createEmptyIllustrationBrief();
  if (!isRecord(value)) {
    return brief;
  }
  for (const field of BRIEF_FIELDS) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string') {
      brief[field] = fieldValue.slice(0, MAX_TEXT_LENGTH);
    }
  }
  return brief;
}

function parseMessages(value: unknown): IllustrationAgentMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      message =>
        isRecord(message) &&
        typeof message.id === 'string' &&
        ['assistant', 'system', 'user'].includes(String(message.role)) &&
        Array.isArray(message.parts),
    )
    .slice(-200) as IllustrationAgentMessage[];
}

function parseSelection(value: unknown): CharacterPortraitSelection | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId)
  ) {
    return null;
  }
  return { fileName: value.fileName, taskId: value.taskId };
}

function parseCharacterReferenceSelection(
  value: unknown,
): CharacterExpressionReferenceSelection | null {
  const selection = parseSelection(value);
  if (
    !selection ||
    !isRecord(value) ||
    !['expression', 'portrait', 'sheet'].includes(String(value.kind))
  ) {
    return null;
  }
  return {
    ...selection,
    kind: value.kind as CharacterExpressionReferenceSelection['kind'],
  };
}

function characterReferenceKey(selection: CharacterExpressionReferenceSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

function parseVersionReference(value: unknown): IllustrationVersionReference | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.versionId !== 'string' ||
    !ID_PATTERN.test(value.versionId)
  ) {
    return null;
  }
  return { fileName: value.fileName, versionId: value.versionId };
}

function parseStyleReference(value: unknown): IllustrationStyleReference | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName
  ) {
    return null;
  }
  if (
    value.source === 'generated' &&
    typeof value.topicId === 'string' &&
    ID_PATTERN.test(value.topicId) &&
    typeof value.versionId === 'string' &&
    ID_PATTERN.test(value.versionId)
  ) {
    return {
      fileName: value.fileName,
      source: 'generated',
      topicId: value.topicId,
      versionId: value.versionId,
    };
  }
  if (
    value.source === 'uploaded' &&
    typeof value.uploadId === 'string' &&
    ID_PATTERN.test(value.uploadId)
  ) {
    return { fileName: value.fileName, source: 'uploaded', uploadId: value.uploadId };
  }
  return null;
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
    url: getAssetUrl(value.fileName),
  };
}

function parseUpload(value: unknown): UploadedIllustration | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.originalName !== 'string' ||
    !value.originalName.trim() ||
    typeof value.mimeType !== 'string' ||
    !value.mimeType.startsWith('image/') ||
    typeof value.size !== 'number' ||
    !Number.isFinite(value.size) ||
    value.size <= 0
  ) {
    return null;
  }
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    fileName: value.fileName,
    id: value.id,
    mimeType: value.mimeType,
    originalName: value.originalName.trim(),
    size: value.size,
    url: getAssetUrl(value.fileName),
  };
}

function parseVersion(value: unknown): IllustrationVersion | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.versionNumber !== 'number' ||
    !Number.isInteger(value.versionNumber) ||
    value.versionNumber < 1 ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    !isSize(value.size) ||
    !isResolution(value.resolution) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }
  return {
    artStyleId: typeof value.artStyleId === 'string' ? value.artStyleId : null,
    artStyleName: typeof value.artStyleName === 'string' ? value.artStyleName : null,
    baseVersion: parseVersionReference(value.baseVersion),
    characterReferences: Array.isArray(value.characterReferences)
      ? value.characterReferences
          .map(parseCharacterReferenceSelection)
          .filter((selection): selection is CharacterExpressionReferenceSelection =>
            Boolean(selection),
          )
          .slice(0, MAX_ILLUSTRATION_REFERENCE_IMAGES)
      : [],
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images: Array.isArray(value.images)
      ? value.images
          .map(parseImage)
          .filter((image): image is CharacterPortraitImage => Boolean(image))
      : [],
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referencePortrait: parseSelection(value.referencePortrait),
    referenceSheet: parseSelection(value.referenceSheet),
    referenceStyle: parseStyleReference(value.referenceStyle),
    resolution: value.resolution,
    size: value.size,
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    useCharacter: value.useCharacter !== false,
    versionNumber: value.versionNumber,
  };
}

function parseTopic(value: unknown): IllustrationTopic | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > MAX_TITLE_LENGTH
  ) {
    return null;
  }
  const versions = Array.isArray(value.versions)
    ? value.versions
        .map(parseVersion)
        .filter((version): version is IllustrationVersion => Boolean(version))
        .sort((left, right) => right.versionNumber - left.versionNumber)
    : [];
  return {
    artStyleId:
      typeof value.artStyleId === 'string' ? value.artStyleId : (versions[0]?.artStyleId ?? null),
    brief: parseBrief(value.brief),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    id: value.id,
    messages: parseMessages(value.messages),
    ready: value.ready === true,
    title: value.title.trim(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    useCharacter: value.useCharacter !== false,
    versions,
  };
}

async function getStorePath(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), STORE_FILE_NAME);
}

async function loadStore(): Promise<StoredIllustrationWorkspace> {
  const storePath = await getStorePath();
  const value = await readJsonFile(storePath);
  if (!isRecord(value)) {
    return { topics: [], uploads: [], version: 3 };
  }
  const topics = Array.isArray(value.topics)
    ? value.topics
        .map(parseTopic)
        .filter((topic): topic is IllustrationTopic => Boolean(topic))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    : [];
  const uploads = Array.isArray(value.uploads)
    ? value.uploads
        .map(parseUpload)
        .filter((upload): upload is UploadedIllustration => Boolean(upload))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  const store: StoredIllustrationWorkspace = { topics, uploads, version: 3 };
  if (value.version !== 3 || 'selectedStyleReference' in value) {
    const legacyStyleReference = parseStyleReference(value.selectedStyleReference);
    const legacyImage = legacyStyleReference
      ? resolveStyleReferenceImage(topics, uploads, legacyStyleReference)
      : null;
    if (legacyImage) {
      await importArtStyleReference({
        image: legacyImage,
        name: '原正式画风',
        sourcePath: path.join(
          await getWorkspaceDirectory(),
          'assets',
          ASSET_DIRECTORY,
          legacyImage.fileName,
        ),
      });
    }
    await writeJsonFile(storePath, store);
  }
  return store;
}

async function saveStore(store: StoredIllustrationWorkspace): Promise<void> {
  await writeJsonFile(await getStorePath(), store);
}

function replaceTopic(
  store: StoredIllustrationWorkspace,
  topic: IllustrationTopic,
): StoredIllustrationWorkspace {
  return {
    ...store,
    topics: [topic, ...store.topics.filter(item => item.id !== topic.id)].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}

function resolveStyleReferenceImage(
  topics: IllustrationTopic[],
  uploads: UploadedIllustration[],
  reference: IllustrationStyleReference,
): CharacterPortraitImage | null {
  if (reference.source === 'uploaded') {
    const upload = uploads.find(
      item => item.id === reference.uploadId && item.fileName === reference.fileName,
    );
    return upload
      ? { fileName: upload.fileName, mimeType: upload.mimeType, url: upload.url }
      : null;
  }
  const version = topics
    .find(topic => topic.id === reference.topicId)
    ?.versions.find(item => item.id === reference.versionId && item.status === 'completed');
  return version?.images.find(image => image.fileName === reference.fileName) ?? null;
}

function requireTopic(store: StoredIllustrationWorkspace, topicId: string): IllustrationTopic {
  if (!ID_PATTERN.test(topicId)) {
    throw new Error('插画主题编号无效');
  }
  const topic = store.topics.find(item => item.id === topicId);
  if (!topic) {
    throw new Error('未找到插画主题');
  }
  return topic;
}

export async function getIllustrationWorkspace(): Promise<IllustrationWorkspaceState> {
  const store = await loadStore();
  const artStyleWorkspace = await getArtStyleWorkspace();
  return {
    artStyles: artStyleWorkspace.styles,
    topics: store.topics,
    uploads: store.uploads,
  };
}

export async function selectIllustrationStyleReference(
  request: SelectIllustrationStyleReferenceRequest,
): Promise<IllustrationWorkspaceState> {
  const reference = parseStyleReference(request);
  if (!reference) {
    throw new Error('画风参考选择无效');
  }
  const store = await loadStore();
  const image = resolveStyleReferenceImage(store.topics, store.uploads, reference);
  if (!image) {
    throw new Error('未找到这张画风参考图');
  }
  const imported = await importArtStyleReference({
    image,
    name:
      typeof request.name === 'string' && request.name.trim()
        ? request.name.trim().slice(0, MAX_TITLE_LENGTH)
        : image.name || '插画画风',
    sourcePath: path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY, image.fileName),
  });
  return {
    artStyles: imported.styles,
    topics: store.topics,
    uploads: store.uploads,
  };
}

export async function getIllustrationTopic(topicId: string): Promise<IllustrationTopic> {
  return requireTopic(await loadStore(), topicId);
}

export async function createIllustrationTopic(
  request: CreateIllustrationTopicRequest,
): Promise<IllustrationTopic> {
  if (!request || typeof request !== 'object' || typeof request.useCharacter !== 'boolean') {
    throw new Error('新建插画主题参数无效');
  }
  const now = new Date().toISOString();
  const topic: IllustrationTopic = {
    artStyleId: null,
    brief: createEmptyIllustrationBrief(),
    createdAt: now,
    id: `illustration_${randomUUID()}`,
    messages: [],
    ready: false,
    title: '未命名插画',
    updatedAt: now,
    useCharacter: request.useCharacter,
    versions: [],
  };
  await saveStore(replaceTopic(await loadStore(), topic));
  return topic;
}

export async function updateIllustrationTopic(
  request: UpdateIllustrationTopicRequest,
): Promise<IllustrationTopic> {
  if (!request || typeof request !== 'object' || typeof request.topicId !== 'string') {
    throw new Error('插画主题更新参数无效');
  }
  if (
    request.title !== undefined &&
    (typeof request.title !== 'string' ||
      !request.title.trim() ||
      request.title.length > MAX_TITLE_LENGTH)
  ) {
    throw new Error('插画主题名称无效');
  }
  if (request.useCharacter !== undefined && typeof request.useCharacter !== 'boolean') {
    throw new Error('角色参考设置无效');
  }
  if (
    request.artStyleId !== undefined &&
    request.artStyleId !== null &&
    (typeof request.artStyleId !== 'string' || !ID_PATTERN.test(request.artStyleId))
  ) {
    throw new Error('画风选择无效');
  }
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  if (request.artStyleId) {
    const artStyleWorkspace = await getArtStyleWorkspace();
    if (!artStyleWorkspace.styles.some(style => style.id === request.artStyleId)) {
      throw new Error('未找到选择的画风');
    }
  }
  const updatedTopic: IllustrationTopic = {
    ...topic,
    artStyleId: request.artStyleId === undefined ? topic.artStyleId : request.artStyleId,
    title: request.title?.trim() ?? topic.title,
    updatedAt: new Date().toISOString(),
    useCharacter: request.useCharacter ?? topic.useCharacter,
  };
  await saveStore(replaceTopic(store, updatedTopic));
  return updatedTopic;
}

export async function updateIllustrationBrief(
  topicId: string,
  patch: Partial<IllustrationBrief> & { title?: string },
  ready: boolean,
): Promise<IllustrationBriefUpdateResult> {
  const store = await loadStore();
  const topic = requireTopic(store, topicId);
  const brief = { ...topic.brief };
  for (const field of BRIEF_FIELDS) {
    const value = patch[field];
    if (typeof value === 'string') {
      brief[field] = value.trim().slice(0, MAX_TEXT_LENGTH);
    }
  }
  const title =
    typeof patch.title === 'string' && patch.title.trim()
      ? patch.title.trim().slice(0, MAX_TITLE_LENGTH)
      : topic.title;
  const updatedTopic: IllustrationTopic = {
    ...topic,
    brief,
    ready: ready && Boolean(brief.subject && brief.finalPrompt),
    title,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceTopic(store, updatedTopic));
  return { brief, ready: updatedTopic.ready, title };
}

export async function saveIllustrationConversation(
  request: SaveIllustrationConversationRequest,
): Promise<IllustrationTopic> {
  if (!request || typeof request !== 'object' || typeof request.topicId !== 'string') {
    throw new Error('插画对话保存参数无效');
  }
  const messages = parseMessages(request.messages);
  if (
    messages.length !== request.messages.length ||
    messages.length > 200 ||
    JSON.stringify(messages).length > 2_000_000
  ) {
    throw new Error('插画对话消息无效');
  }
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  const updatedTopic = { ...topic, messages, updatedAt: new Date().toISOString() };
  await saveStore(replaceTopic(store, updatedTopic));
  return updatedTopic;
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
  if (
    !isRecord(firstItem) ||
    typeof firstItem.task_id !== 'string' ||
    !ID_PATTERN.test(firstItem.task_id)
  ) {
    throw new Error('图片生成服务未返回有效的任务编号');
  }
  return firstItem.task_id;
}

function parseTaskData(payload: unknown): ApiTaskData {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error('图片生成服务返回了无效的任务状态');
  }
  const data = payload.data;
  const resultImages =
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

function validateUploadRequest(request: UploadIllustrationRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.fileName !== 'string' ||
    !request.fileName.trim() ||
    path.basename(request.fileName) !== request.fileName ||
    !(request.fileData instanceof Uint8Array) ||
    typeof request.mimeType !== 'string' ||
    !request.mimeType.startsWith('image/')
  ) {
    throw new Error('上传的插画图片无效');
  }
  if (request.fileData.byteLength === 0 || request.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('插画图片大小必须在 20 MB 以内');
  }
}

function getUploadedImageExtension(request: UploadIllustrationRequest): string {
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

async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
): Promise<CharacterPortraitImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('插画生成任务已完成，但没有返回图片');
  }
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await mkdir(assetDirectory, { recursive: true });
  return Promise.all(
    imageUrls.map(async (imageUrl, index) => {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('图片生成服务返回了不安全的图片地址');
      }
      const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(60_000) });
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
      return { fileName, mimeType, url: getAssetUrl(fileName) };
    }),
  );
}

async function readReferenceImage(
  directory: string,
  image: CharacterPortraitImage,
): Promise<string> {
  const imageData = await readFile(
    path.join(await getWorkspaceDirectory(), 'assets', directory, image.fileName),
  );
  if (imageData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('参考图片超过 20 MB，无法用于插画生成');
  }
  return `data:${image.mimeType};base64,${imageData.toString('base64')}`;
}

function buildPrompt(
  prompt: string,
  useCharacter: boolean,
  artStyle: ArtStyle,
  revisionPrompt: string,
): string {
  const lines: string[] = [];
  if (useCharacter) {
    lines.push(
      '参考图中的角色是本次插画中的同一个角色。综合所有已选角色参考确认脸部、表情、服装、完整造型和结构。',
      revisionPrompt
        ? '除本次修改要求明确指定的项目外，必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致。'
        : '必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致，不要重新设计或美化角色。',
    );
  }
  lines.push(prompt.trim());
  if (revisionPrompt) {
    lines.push(
      '请以旧插画参考图为修改底稿，严格保留修改要求未提及的主体、构图、环境、色彩和细节，只调整明确指定的内容。',
      `本次修改要求：${revisionPrompt}`,
    );
  }
  if (artStyle.referenceImage) {
    lines.push('所选画风参考图只用于确认视觉语言，不要复制其中的具体人物动作、道具、环境或构图。');
  }
  lines.push(`所选画风：${artStyle.name}`, artStyle.prompt);
  if (!revisionPrompt) {
    lines.push('旧插画参考图只用于延续其构图、环境或情境。');
  }
  lines.push(
    '如果旧插画与正式角色资产或所选画风冲突，以正式角色资产和所选画风为准。',
    '除少量风格化手写批注外，不要添加标题、大段文字、边框、Logo、水印、多格排版、重复人物或重复肢体。',
  );
  return lines.join('\n');
}

function validateGenerateRequest(request: GenerateIllustrationRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.topicId !== 'string' ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_TEXT_LENGTH ||
    (request.revisionPrompt !== null &&
      (typeof request.revisionPrompt !== 'string' ||
        !request.revisionPrompt.trim() ||
        request.revisionPrompt.length > MAX_TEXT_LENGTH)) ||
    (request.revisionPrompt !== null && request.baseVersion === null) ||
    !isSize(request.size) ||
    !isResolution(request.resolution) ||
    !Array.isArray(request.characterReferences) ||
    request.characterReferences.length > MAX_ILLUSTRATION_REFERENCE_IMAGES ||
    request.characterReferences.some(reference => !parseCharacterReferenceSelection(reference)) ||
    (request.baseVersion !== null && !parseVersionReference(request.baseVersion))
  ) {
    throw new Error('插画生成参数无效');
  }
}

export async function generateIllustration(
  request: GenerateIllustrationRequest,
): Promise<IllustrationVersion> {
  validateGenerateRequest(request);
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  if (!topic.ready) {
    throw new Error('请先通过对话完成并确认画面方案');
  }

  const referenceImages: string[] = [];
  let characterReferences: CharacterExpressionReferenceSelection[] = [];
  let referencePortrait: CharacterPortraitSelection | null = null;
  let referenceSheet: CharacterPortraitSelection | null = null;
  const artStyleWorkspace = await getArtStyleWorkspace();
  const artStyle = topic.artStyleId
    ? artStyleWorkspace.styles.find(style => style.id === topic.artStyleId)
    : null;
  if (!artStyle) {
    throw new Error('请先为这张创作卡片选择画风');
  }
  if (topic.useCharacter) {
    const characterLibrary = await getCharacterLibrary();
    const [portraitWorkspace, expressionWorkspace] = await Promise.all([
      getCharacterPortraitWorkspace(),
      getCharacterExpressionWorkspace({ characterId: characterLibrary.activeCharacterId }),
    ]);
    const visualReferences = getOfficialCharacterVisualReferences(portraitWorkspace);
    const expressionReferences = expressionWorkspace.records.flatMap(record =>
      record.status === 'completed'
        ? record.images.map(image => ({
            directoryName: EXPRESSION_ASSET_DIRECTORY,
            image,
            selection: {
              fileName: image.fileName,
              kind: 'expression' as const,
              taskId: record.id,
            },
          }))
        : [],
    );
    const availableReferences = [...visualReferences, ...expressionReferences];
    const availableReferenceMap = new Map(
      availableReferences.map(reference => [characterReferenceKey(reference.selection), reference]),
    );
    characterReferences = [
      ...new Map(
        request.characterReferences.map(reference => {
          const selection = parseCharacterReferenceSelection(reference)!;
          return [characterReferenceKey(selection), selection];
        }),
      ).values(),
    ];
    if (!characterReferences.length) {
      throw new Error('请先选择至少一张角色参考');
    }
    const references = characterReferences.map(reference => {
      const match = availableReferenceMap.get(characterReferenceKey(reference));
      if (!match) {
        throw new Error('选择的角色参考已失效');
      }
      return match;
    });
    referencePortrait =
      references.find(reference => reference.selection.kind === 'portrait')?.selection ?? null;
    referenceSheet =
      references.find(reference => reference.selection.kind === 'sheet')?.selection ?? null;
    referenceImages.push(
      ...(await Promise.all(
        references.map(reference => readReferenceImage(reference.directoryName, reference.image)),
      )),
    );
  }

  const styleReferenceData = await readArtStyleReference(artStyle);
  if (styleReferenceData) {
    referenceImages.push(styleReferenceData);
  }

  let baseVersion: IllustrationVersionReference | null = null;
  if (request.baseVersion) {
    const version = topic.versions.find(item => item.id === request.baseVersion?.versionId);
    const image = version?.images.find(item => item.fileName === request.baseVersion?.fileName);
    if (!version || !image || version.status !== 'completed') {
      throw new Error('选择的旧插画版本已失效');
    }
    baseVersion = { ...request.baseVersion };
    referenceImages.push(await readReferenceImage(ASSET_DIRECTORY, image));
  }

  if (referenceImages.length > MAX_ILLUSTRATION_REFERENCE_IMAGES) {
    throw new Error(`插画参考图最多 ${MAX_ILLUSTRATION_REFERENCE_IMAGES} 张`);
  }

  const prompt = buildPrompt(
    request.prompt,
    topic.useCharacter,
    artStyle,
    request.revisionPrompt?.trim() ?? '',
  );
  const apiKey = await getCredentialValue('apimart');
  const body: Record<string, unknown> = {
    model: 'gpt-image-2',
    n: 1,
    prompt,
    resolution: request.resolution,
    size: request.size,
  };
  if (referenceImages.length) {
    body.image_urls = referenceImages;
  }
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const version: IllustrationVersion = {
    artStyleId: artStyle.id,
    artStyleName: artStyle.name,
    baseVersion,
    characterReferences,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    progress: 0,
    prompt,
    referencePortrait: referencePortrait ? { ...referencePortrait } : null,
    referenceSheet: referenceSheet ? { ...referenceSheet } : null,
    referenceStyle: null,
    resolution: request.resolution,
    size: request.size,
    status: 'submitted',
    updatedAt: now,
    useCharacter: topic.useCharacter,
    versionNumber: Math.max(0, ...topic.versions.map(item => item.versionNumber)) + 1,
  };
  const updatedTopic: IllustrationTopic = {
    ...topic,
    brief: { ...topic.brief, finalPrompt: request.prompt.trim() },
    updatedAt: now,
    versions: [version, ...topic.versions],
  };
  await saveStore(replaceTopic(store, updatedTopic));
  return version;
}

export async function getIllustrationTask(taskId: string): Promise<IllustrationVersion> {
  if (!ID_PATTERN.test(taskId)) {
    throw new Error('插画生成任务编号无效');
  }
  const store = await loadStore();
  const topic = store.topics.find(item => item.versions.some(version => version.id === taskId));
  const version = topic?.versions.find(item => item.id === taskId);
  if (!topic || !version) {
    throw new Error('未找到插画生成任务');
  }
  if (version.status === 'completed' && version.images.length) {
    return version;
  }
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(
    `${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}?language=zh`,
    { headers: { Authorization: `Bearer ${apiKey}` }, method: 'GET' },
  );
  const taskData = parseTaskData(payload);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }
  const images =
    taskData.status === 'completed' ? await downloadTaskImages(taskId, taskData) : version.images;
  const updatedVersion: IllustrationVersion = {
    ...version,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '插画生成任务未完成'
        : null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? version.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  const updatedTopic: IllustrationTopic = {
    ...topic,
    updatedAt: updatedVersion.updatedAt,
    versions: topic.versions.map(item => (item.id === taskId ? updatedVersion : item)),
  };
  await saveStore(replaceTopic(store, updatedTopic));
  return updatedVersion;
}

export async function deleteIllustrationVersion(
  request: DeleteIllustrationVersionRequest,
): Promise<IllustrationTopic> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.topicId !== 'string' ||
    typeof request.versionId !== 'string'
  ) {
    throw new Error('插画版本删除参数无效');
  }
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  const version = topic.versions.find(item => item.id === request.versionId);
  if (!version) {
    throw new Error('未找到要删除的插画版本');
  }
  if (['submitted', 'pending', 'processing'].includes(version.status)) {
    throw new Error('插画生成完成后才能删除');
  }
  const updatedTopic: IllustrationTopic = {
    ...topic,
    updatedAt: new Date().toISOString(),
    versions: topic.versions
      .filter(item => item.id !== version.id)
      .map(item =>
        item.baseVersion?.versionId === version.id ? { ...item, baseVersion: null } : item,
      ),
  };
  await saveStore(replaceTopic(store, updatedTopic));
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await Promise.all(
    version.images.map(image =>
      unlink(path.join(assetDirectory, image.fileName)).catch(() => undefined),
    ),
  );
  return updatedTopic;
}

export async function uploadIllustration(
  request: UploadIllustrationRequest,
): Promise<UploadedIllustration> {
  validateUploadRequest(request);
  const uploadId = `upload_${randomUUID()}`;
  const fileName = `${uploadId}${getUploadedImageExtension(request)}`;
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(path.join(assetDirectory, fileName), request.fileData, { flag: 'wx' });

  const upload: UploadedIllustration = {
    createdAt: new Date().toISOString(),
    fileName,
    id: uploadId,
    mimeType: request.mimeType,
    originalName: request.fileName.trim(),
    size: request.fileData.byteLength,
    url: getAssetUrl(fileName),
  };
  try {
    const store = await loadStore();
    await saveStore({ ...store, uploads: [upload, ...store.uploads] });
  } catch (error: unknown) {
    await unlink(path.join(assetDirectory, fileName)).catch(() => undefined);
    throw error;
  }
  return upload;
}

export async function deleteIllustrationUpload(
  request: DeleteIllustrationUploadRequest,
): Promise<IllustrationWorkspaceState> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.uploadId !== 'string' ||
    !ID_PATTERN.test(request.uploadId)
  ) {
    throw new Error('上传插画删除参数无效');
  }
  const store = await loadStore();
  const upload = store.uploads.find(item => item.id === request.uploadId);
  if (!upload) {
    throw new Error('未找到要删除的上传插画');
  }
  const nextStore: StoredIllustrationWorkspace = {
    ...store,
    uploads: store.uploads.filter(item => item.id !== upload.id),
  };
  await saveStore(nextStore);
  try {
    const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
    await unlink(path.join(assetDirectory, upload.fileName));
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await saveStore(store);
      throw new Error(
        error instanceof Error ? `上传插画删除失败：${error.message}` : '上传插画删除失败',
      );
    }
  }
  return {
    artStyles: (await getArtStyleWorkspace()).styles,
    topics: nextStore.topics,
    uploads: nextStore.uploads,
  };
}

export async function deleteIllustrationTopic(
  request: DeleteIllustrationTopicRequest,
): Promise<IllustrationWorkspaceState> {
  if (!request || typeof request !== 'object' || typeof request.topicId !== 'string') {
    throw new Error('插画主题删除参数无效');
  }
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  if (
    topic.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status))
  ) {
    throw new Error('插画生成完成后才能删除这个主题');
  }
  const nextStore = { ...store, topics: store.topics.filter(item => item.id !== topic.id) };
  await saveStore(nextStore);
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await Promise.all(
    topic.versions.flatMap(version =>
      version.images.map(image =>
        unlink(path.join(assetDirectory, image.fileName)).catch(() => undefined),
      ),
    ),
  );
  return {
    artStyles: (await getArtStyleWorkspace()).styles,
    topics: nextStore.topics,
    uploads: nextStore.uploads,
  };
}
