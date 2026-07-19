import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArtStyle } from '../../shared/art-style';
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
import { ILLUSTRATION_SIZES, createEmptyIllustrationBrief } from '../../shared/illustration';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from '../../shared/character-portrait';
import { CHARACTER_PORTRAIT_RESOLUTIONS } from '../../shared/character-portrait';
import {
  getActiveArtStyle,
  importArtStyleReference,
  readActiveArtStyleReference,
} from './art-style';
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
  selectedStyleReference: IllustrationStyleReference | null;
  topics: IllustrationTopic[];
  uploads: UploadedIllustration[];
  version: 2;
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
  return {
    brief: parseBrief(value.brief),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    id: value.id,
    messages: parseMessages(value.messages),
    ready: value.ready === true,
    title: value.title.trim(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    useCharacter: value.useCharacter !== false,
    versions: Array.isArray(value.versions)
      ? value.versions
          .map(parseVersion)
          .filter((version): version is IllustrationVersion => Boolean(version))
          .sort((left, right) => right.versionNumber - left.versionNumber)
      : [],
  };
}

async function getStorePath(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), STORE_FILE_NAME);
}

async function loadStore(): Promise<StoredIllustrationWorkspace> {
  const value = await readJsonFile(await getStorePath());
  if (!isRecord(value)) {
    return { selectedStyleReference: null, topics: [], uploads: [], version: 2 };
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
  const selectedStyleReference = parseStyleReference(value.selectedStyleReference);
  return {
    selectedStyleReference:
      selectedStyleReference && resolveStyleReferenceImage(topics, uploads, selectedStyleReference)
        ? selectedStyleReference
        : null,
    topics,
    uploads,
    version: 2,
  };
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
  let activeArtStyle = await getActiveArtStyle();
  if (store.selectedStyleReference) {
    const legacyImage = resolveStyleReferenceImage(
      store.topics,
      store.uploads,
      store.selectedStyleReference,
    );
    if (legacyImage) {
      const migrated = await importArtStyleReference({
        image: legacyImage,
        name: '原正式画风',
        sourcePath: path.join(
          await getWorkspaceDirectory(),
          'assets',
          ASSET_DIRECTORY,
          legacyImage.fileName,
        ),
      });
      activeArtStyle =
        migrated.styles.find(style => style.id === migrated.activeStyleId) ?? activeArtStyle;
    }
    await saveStore({ ...store, selectedStyleReference: null });
  }
  return {
    activeArtStyle,
    selectedStyleReference: null,
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
  const activeArtStyle =
    imported.styles.find(style => style.id === imported.activeStyleId) ?? imported.styles[0]!;
  await saveStore({ ...store, selectedStyleReference: null });
  return {
    activeArtStyle,
    selectedStyleReference: null,
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
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  const updatedTopic: IllustrationTopic = {
    ...topic,
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

function buildPrompt(prompt: string, useCharacter: boolean, artStyle: ArtStyle): string {
  const lines: string[] = [];
  if (useCharacter) {
    lines.push(
      '参考图中的角色是本次插画中的同一个角色。综合所有正式角色视觉确认脸部、服装、完整造型和结构。',
      '必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致，不要重新设计或美化角色。',
    );
  }
  lines.push(prompt.trim());
  if (artStyle.referenceImage) {
    lines.push('当前画风参考图只用于确认视觉语言，不要复制其中的具体人物动作、道具、环境或构图。');
  }
  lines.push(`当前画风：${artStyle.name}`, artStyle.prompt);
  lines.push(
    '旧插画参考图只用于延续其构图、环境或情境；如果它与正式角色资产或当前画风冲突，以正式资产和当前画风为准。',
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
    !isSize(request.size) ||
    !isResolution(request.resolution) ||
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
  let referencePortrait: CharacterPortraitSelection | null = null;
  let referenceSheet: CharacterPortraitSelection | null = null;
  const artStyle = await getActiveArtStyle();
  if (topic.useCharacter) {
    const portraitWorkspace = await getCharacterPortraitWorkspace();
    const references = getOfficialCharacterVisualReferences(portraitWorkspace);
    if (!references.length) {
      throw new Error('请先将至少一张角色视觉图片设为正式资产');
    }
    referencePortrait = references[0]?.selection ?? null;
    referenceSheet = references[1]?.selection ?? null;
    referenceImages.push(
      ...(await Promise.all(
        references.map(reference => readReferenceImage(reference.directoryName, reference.image)),
      )),
    );
  }

  const styleReferenceData = await readActiveArtStyleReference(artStyle);
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

  const prompt = buildPrompt(request.prompt, topic.useCharacter, artStyle);
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
  if (
    store.selectedStyleReference?.source === 'generated' &&
    store.selectedStyleReference.topicId === topic.id &&
    store.selectedStyleReference.versionId === version.id
  ) {
    throw new Error('正式画风参考不能删除，请先将其他插画设为正式画风');
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
  if (
    store.selectedStyleReference?.source === 'uploaded' &&
    store.selectedStyleReference.uploadId === upload.id
  ) {
    throw new Error('正式画风参考不能删除，请先将其他插画设为正式画风');
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
    activeArtStyle: await getActiveArtStyle(),
    selectedStyleReference: nextStore.selectedStyleReference,
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
    store.selectedStyleReference?.source === 'generated' &&
    store.selectedStyleReference.topicId === topic.id
  ) {
    throw new Error('该主题包含正式画风参考，请先将其他插画设为正式画风');
  }
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
    activeArtStyle: await getActiveArtStyle(),
    selectedStyleReference: nextStore.selectedStyleReference,
    topics: nextStore.topics,
    uploads: nextStore.uploads,
  };
}
