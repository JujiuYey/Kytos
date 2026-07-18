import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from '../../shared/character-portrait';
import { CHARACTER_PORTRAIT_RESOLUTIONS } from '../../shared/character-portrait';
import type { IllustrationSize, IllustrationStyleReference } from '../../shared/illustration';
import { ILLUSTRATION_SIZES, ILLUSTRATION_STYLE_GUIDANCE } from '../../shared/illustration';
import type {
  CreateStoryRequest,
  CreateStoryShotRequest,
  DeleteStoryRequest,
  DeleteStoryShotRequest,
  DeleteStoryShotVersionRequest,
  GenerateStoryShotRequest,
  MoveStoryShotRequest,
  SaveStoryConversationRequest,
  SelectStoryShotVersionRequest,
  StoryAgentMessage,
  StoryDraft,
  StoryDraftUpdateResult,
  StoryProject,
  StoryShot,
  StoryShotContent,
  StoryShotUpdateResult,
  StoryShotVersion,
  StoryVersionReference,
  StoryboardUpdateResult,
  StoryWorkspaceState,
  UpdateStoryRequest,
  UpdateStoryShotRequest,
} from '../../shared/story';
import {
  STORY_SHOT_LIMITS,
  createEmptyStoryDraft,
  createEmptyStoryShotContent,
} from '../../shared/story';
import { getCharacterPortraitWorkspace } from './character-portrait';
import { getCredentialValue } from './credentials';
import { getIllustrationWorkspace } from './illustration';
import { readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const API_BASE_URL = 'https://api.apimart.ai';
const STORE_FILE_NAME = 'stories.json';
const ASSET_DIRECTORY = 'story-frames';
const ILLUSTRATION_ASSET_DIRECTORY = 'illustrations';
const PORTRAIT_ASSET_DIRECTORY = 'character-portraits';
const SHEET_ASSET_DIRECTORY = 'character-sheets';
const MAX_TITLE_LENGTH = 100;
const MAX_TEXT_LENGTH = 20_000;
const MAX_STORED_PROMPT_LENGTH = 50_000;
const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_RESULT_IMAGE_SIZE = 50 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const DRAFT_FIELDS: (keyof StoryDraft)[] = [
  'conflict',
  'ending',
  'goal',
  'premise',
  'setting',
  'summary',
  'tone',
  'turningPoint',
];
const SHOT_FIELDS: (keyof StoryShotContent)[] = [
  'action',
  'composition',
  'continuity',
  'emotion',
  'finalPrompt',
  'narration',
  'purpose',
  'scene',
  'title',
];
const VISUAL_SHOT_FIELDS: (keyof StoryShotContent)[] = [
  'action',
  'composition',
  'continuity',
  'emotion',
  'finalPrompt',
  'scene',
];

interface StoredStoryWorkspace {
  stories: StoryProject[];
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

let taskCommitQueue: Promise<void> = Promise.resolve();

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

function parseMessages(value: unknown): StoryAgentMessage[] {
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
    .slice(-200) as StoryAgentMessage[];
}

function parseDraft(value: unknown): StoryDraft {
  const draft = createEmptyStoryDraft();
  if (!isRecord(value)) {
    return draft;
  }
  for (const field of DRAFT_FIELDS) {
    if (typeof value[field] === 'string') {
      draft[field] = value[field].slice(0, MAX_TEXT_LENGTH);
    }
  }
  return draft;
}

function parseShotContent(value: unknown): StoryShotContent {
  const content = createEmptyStoryShotContent();
  if (!isRecord(value)) {
    return content;
  }
  for (const field of SHOT_FIELDS) {
    if (typeof value[field] === 'string') {
      content[field] = value[field].slice(0, MAX_TEXT_LENGTH);
    }
  }
  return content;
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

function parseVersionReference(value: unknown): StoryVersionReference | null {
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.shotId !== 'string' ||
    !ID_PATTERN.test(value.shotId) ||
    typeof value.versionId !== 'string' ||
    !ID_PATTERN.test(value.versionId)
  ) {
    return null;
  }
  return { fileName: value.fileName, shotId: value.shotId, versionId: value.versionId };
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

function parseVersion(value: unknown): StoryShotVersion | null {
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
    baseVersion: parseVersionReference(value.baseVersion),
    continuityVersion: parseVersionReference(value.continuityVersion),
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
    versionNumber: value.versionNumber,
  };
}

function parseShot(value: unknown, fallbackOrder: number): StoryShot | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.order !== 'number' ||
    !Number.isInteger(value.order)
  ) {
    return null;
  }
  const versions = Array.isArray(value.versions)
    ? value.versions
        .map(parseVersion)
        .filter((version): version is StoryShotVersion => Boolean(version))
        .sort((left, right) => right.versionNumber - left.versionNumber)
    : [];
  const selectedVersionId =
    typeof value.selectedVersionId === 'string' &&
    versions.some(
      version => version.id === value.selectedVersionId && version.status === 'completed',
    )
      ? value.selectedVersionId
      : null;
  return {
    ...parseShotContent(value),
    id: value.id,
    imageStale: value.imageStale === true && Boolean(selectedVersionId),
    order: value.order > 0 ? value.order : fallbackOrder,
    selectedVersionId,
    versions,
  };
}

function isStoryboardComplete(shots: StoryShot[]): boolean {
  return (
    shots.length >= STORY_SHOT_LIMITS.min &&
    shots.length <= STORY_SHOT_LIMITS.max &&
    shots.every(shot => Boolean(shot.title.trim() && shot.scene.trim() && shot.finalPrompt.trim()))
  );
}

function hasActiveGeneration(story: StoryProject): boolean {
  return story.shots.some(shot =>
    shot.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status)),
  );
}

function normalizeShotOrder(shots: StoryShot[]): StoryShot[] {
  return [...shots]
    .sort((left, right) => left.order - right.order)
    .map((shot, index) => ({ ...shot, order: index + 1 }));
}

function parseStory(value: unknown, migrateResolutionStale: boolean): StoryProject | null {
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
  const resolution = isResolution(value.resolution) ? value.resolution : '2k';
  const size = isSize(value.size) ? value.size : '16:9';
  const shots = normalizeShotOrder(
    Array.isArray(value.shots)
      ? value.shots
          .slice(0, STORY_SHOT_LIMITS.max)
          .map((shot, index) => parseShot(shot, index + 1))
          .filter((shot): shot is StoryShot => Boolean(shot))
      : [],
  ).map(shot => {
    const selectedVersion = shot.versions.find(version => version.id === shot.selectedVersionId);
    const legacyResolutionOnlyStale = Boolean(
      migrateResolutionStale &&
      shot.imageStale &&
      selectedVersion &&
      selectedVersion.size === size &&
      selectedVersion.resolution !== resolution,
    );
    return legacyResolutionOnlyStale ? { ...shot, imageStale: false } : shot;
  });
  const keyShotId =
    typeof value.keyShotId === 'string' && shots.some(shot => shot.id === value.keyShotId)
      ? value.keyShotId
      : (shots[0]?.id ?? null);
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    draft: parseDraft(value.draft),
    id: value.id,
    keyShotId,
    messages: parseMessages(value.messages),
    resolution,
    shots,
    size,
    storyboardReady: value.storyboardReady === true && isStoryboardComplete(shots),
    storyboardStale: value.storyboardStale === true && shots.length > 0,
    storyReady: value.storyReady === true,
    title: value.title.trim(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

async function getStorePath(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), STORE_FILE_NAME);
}

async function loadStore(): Promise<StoredStoryWorkspace> {
  const value = await readJsonFile(await getStorePath());
  if (!isRecord(value)) {
    return { stories: [], version: 2 };
  }
  const migrateResolutionStale = value.version !== 2;
  return {
    stories: Array.isArray(value.stories)
      ? value.stories
          .map(story => parseStory(story, migrateResolutionStale))
          .filter((story): story is StoryProject => Boolean(story))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : [],
    version: 2,
  };
}

async function saveStore(store: StoredStoryWorkspace): Promise<void> {
  await writeJsonFile(await getStorePath(), store);
}

function replaceStory(store: StoredStoryWorkspace, story: StoryProject): StoredStoryWorkspace {
  return {
    ...store,
    stories: [story, ...store.stories.filter(item => item.id !== story.id)].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}

function requireStory(store: StoredStoryWorkspace, storyId: string): StoryProject {
  if (!ID_PATTERN.test(storyId)) {
    throw new Error('故事编号无效');
  }
  const story = store.stories.find(item => item.id === storyId);
  if (!story) {
    throw new Error('未找到这个故事');
  }
  return story;
}

function requireShot(story: StoryProject, shotId: string): StoryShot {
  if (!ID_PATTERN.test(shotId)) {
    throw new Error('分镜编号无效');
  }
  const shot = story.shots.find(item => item.id === shotId);
  if (!shot) {
    throw new Error('未找到这个分镜');
  }
  return shot;
}

export async function getStoryWorkspace(): Promise<StoryWorkspaceState> {
  const store = await loadStore();
  return { stories: store.stories };
}

export async function getStory(storyId: string): Promise<StoryProject> {
  return requireStory(await loadStore(), storyId);
}

export async function createStory(_request: CreateStoryRequest): Promise<StoryProject> {
  const now = new Date().toISOString();
  const story: StoryProject = {
    createdAt: now,
    draft: createEmptyStoryDraft(),
    id: `story_${randomUUID()}`,
    keyShotId: null,
    messages: [],
    resolution: '2k',
    shots: [],
    size: '16:9',
    storyboardReady: false,
    storyboardStale: false,
    storyReady: false,
    title: '未命名故事',
    updatedAt: now,
  };
  await saveStore(replaceStory(await loadStore(), story));
  return story;
}

export async function updateStory(request: UpdateStoryRequest): Promise<StoryProject> {
  if (!request || typeof request !== 'object' || typeof request.storyId !== 'string') {
    throw new Error('故事更新参数无效');
  }
  if (
    request.title !== undefined &&
    (typeof request.title !== 'string' ||
      !request.title.trim() ||
      request.title.length > MAX_TITLE_LENGTH)
  ) {
    throw new Error('故事名称无效');
  }
  if (request.size !== undefined && !isSize(request.size)) {
    throw new Error('故事画幅无效');
  }
  if (request.resolution !== undefined && !isResolution(request.resolution)) {
    throw new Error('故事图片清晰度无效');
  }
  if (request.confirmStoryboard !== undefined && typeof request.confirmStoryboard !== 'boolean') {
    throw new Error('分镜确认状态无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  if (request.keyShotId !== undefined && !story.shots.some(shot => shot.id === request.keyShotId)) {
    throw new Error('关键帧选择无效');
  }
  const sizeChanged = request.size !== undefined && request.size !== story.size;
  const outputSettingsChanged =
    sizeChanged || (request.resolution !== undefined && request.resolution !== story.resolution);
  if (request.confirmStoryboard && (!story.storyReady || !isStoryboardComplete(story.shots))) {
    throw new Error('故事和分镜完整后才能确认');
  }
  const previousKeyVersionId = story.shots.find(
    shot => shot.id === story.keyShotId,
  )?.selectedVersionId;
  const keyShotChanged = request.keyShotId !== undefined && request.keyShotId !== story.keyShotId;
  if ((outputSettingsChanged || keyShotChanged) && hasActiveGeneration(story)) {
    throw new Error('分镜图片生成完成后才能调整关键帧或输出规格');
  }
  const shots = story.shots.map(shot => {
    const selectedVersion = shot.versions.find(version => version.id === shot.selectedVersionId);
    const dependsOnPreviousKey = Boolean(
      keyShotChanged &&
      previousKeyVersionId &&
      selectedVersion?.continuityVersion?.versionId === previousKeyVersionId,
    );
    return {
      ...shot,
      imageStale:
        Boolean(shot.selectedVersionId) && (shot.imageStale || sizeChanged || dependsOnPreviousKey),
    };
  });
  const updatedStory: StoryProject = {
    ...story,
    keyShotId: request.keyShotId ?? story.keyShotId,
    resolution: request.resolution ?? story.resolution,
    shots,
    size: request.size ?? story.size,
    storyboardStale: request.confirmStoryboard ? false : story.storyboardStale,
    title: request.title?.trim() ?? story.title,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return updatedStory;
}

export async function updateStoryDraft(
  storyId: string,
  patch: Partial<StoryDraft> & { title?: string },
  ready: boolean,
): Promise<StoryDraftUpdateResult> {
  const store = await loadStore();
  const story = requireStory(store, storyId);
  const draft = { ...story.draft };
  let contentChanged = false;
  for (const field of DRAFT_FIELDS) {
    const value = patch[field];
    if (typeof value === 'string') {
      const nextValue = value.trim().slice(0, MAX_TEXT_LENGTH);
      contentChanged ||= nextValue !== draft[field];
      draft[field] = nextValue;
    }
  }
  const title =
    typeof patch.title === 'string' && patch.title.trim()
      ? patch.title.trim().slice(0, MAX_TITLE_LENGTH)
      : story.title;
  const storyReady = ready && Boolean(draft.premise && draft.summary && draft.ending);
  const storyboardStale = story.shots.length > 0 && (story.storyboardStale || contentChanged);
  const updatedStory: StoryProject = {
    ...story,
    draft,
    storyboardStale,
    storyReady,
    title,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return { draft, storyboardStale, storyReady, title };
}

function createShot(content: StoryShotContent, order: number): StoryShot {
  return {
    ...content,
    id: `shot_${randomUUID()}`,
    imageStale: false,
    order,
    selectedVersionId: null,
    versions: [],
  };
}

export async function presentStoryboard(
  storyId: string,
  shotContents: StoryShotContent[],
): Promise<StoryboardUpdateResult> {
  if (
    !Array.isArray(shotContents) ||
    shotContents.length < STORY_SHOT_LIMITS.min ||
    shotContents.length > STORY_SHOT_LIMITS.max
  ) {
    throw new Error(`短篇故事需要 ${STORY_SHOT_LIMITS.min} 至 ${STORY_SHOT_LIMITS.max} 个分镜`);
  }
  const store = await loadStore();
  const story = requireStory(store, storyId);
  if (!story.storyReady) {
    throw new Error('请先完成并确认故事');
  }
  if (story.shots.some(shot => shot.versions.length > 0)) {
    throw new Error('已有生成画面时不能整体替换分镜，请逐镜调整');
  }
  const shots = shotContents.map((value, index) => createShot(parseShotContent(value), index + 1));
  const storyboardReady = isStoryboardComplete(shots);
  const keyShotId = shots[0]?.id ?? null;
  const updatedStory: StoryProject = {
    ...story,
    keyShotId,
    shots,
    storyboardReady,
    storyboardStale: false,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return { keyShotId, shots, storyboardReady, storyboardStale: false };
}

export async function confirmStoryboard(storyId: string): Promise<StoryboardUpdateResult> {
  const story = await updateStory({ confirmStoryboard: true, storyId });
  return {
    keyShotId: story.keyShotId,
    shots: story.shots,
    storyboardReady: story.storyboardReady,
    storyboardStale: story.storyboardStale,
  };
}

export async function patchStoryShot(
  storyId: string,
  shotId: string,
  patch: Partial<StoryShotContent>,
): Promise<StoryShotUpdateResult> {
  const store = await loadStore();
  const story = requireStory(store, storyId);
  const shot = requireShot(story, shotId);
  if (
    shot.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status))
  ) {
    throw new Error('这个分镜的图片生成完成后才能修改');
  }
  const nextShot = { ...shot };
  let visualChanged = false;
  for (const field of SHOT_FIELDS) {
    const value = patch[field];
    if (typeof value === 'string') {
      const nextValue = value.trim().slice(0, MAX_TEXT_LENGTH);
      visualChanged ||= VISUAL_SHOT_FIELDS.includes(field) && nextValue !== shot[field];
      nextShot[field] = nextValue;
    }
  }
  nextShot.imageStale = Boolean(nextShot.selectedVersionId) && (shot.imageStale || visualChanged);
  const shots = story.shots.map(item => (item.id === shotId ? nextShot : item));
  const updatedStory: StoryProject = {
    ...story,
    shots,
    storyboardReady: isStoryboardComplete(shots),
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return { shot: nextShot, storyboardReady: updatedStory.storyboardReady };
}

export async function updateStoryShot(
  request: UpdateStoryShotRequest,
): Promise<StoryShotUpdateResult> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string'
  ) {
    throw new Error('分镜更新参数无效');
  }
  return patchStoryShot(request.storyId, request.shotId, request);
}

export async function createStoryShot(request: CreateStoryShotRequest): Promise<StoryProject> {
  if (!request || typeof request !== 'object' || typeof request.storyId !== 'string') {
    throw new Error('新增分镜参数无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  if (hasActiveGeneration(story)) {
    throw new Error('分镜图片生成完成后才能新增分镜');
  }
  if (story.shots.length >= STORY_SHOT_LIMITS.max) {
    throw new Error(`短篇故事最多保留 ${STORY_SHOT_LIMITS.max} 个分镜`);
  }
  const shot = createShot(parseShotContent(request), story.shots.length + 1);
  const shots = [...story.shots, shot];
  const updatedStory: StoryProject = {
    ...story,
    keyShotId: story.keyShotId ?? shot.id,
    shots,
    storyboardReady: isStoryboardComplete(shots),
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return updatedStory;
}

export async function moveStoryShot(request: MoveStoryShotRequest): Promise<StoryProject> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string' ||
    ![-1, 1].includes(request.direction)
  ) {
    throw new Error('分镜移动参数无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  if (hasActiveGeneration(story)) {
    throw new Error('分镜图片生成完成后才能调整顺序');
  }
  const shots = normalizeShotOrder(story.shots);
  const index = shots.findIndex(shot => shot.id === request.shotId);
  const targetIndex = index + request.direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= shots.length) {
    return story;
  }
  [shots[index], shots[targetIndex]] = [shots[targetIndex], shots[index]];
  const updatedStory = {
    ...story,
    shots: shots.map((shot, shotIndex) => ({
      ...shot,
      imageStale: Boolean(shot.selectedVersionId),
      order: shotIndex + 1,
    })),
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return updatedStory;
}

export async function deleteStoryShot(request: DeleteStoryShotRequest): Promise<StoryProject> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string'
  ) {
    throw new Error('分镜删除参数无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  const shot = requireShot(story, request.shotId);
  if (hasActiveGeneration(story)) {
    throw new Error('所有分镜图片生成完成后才能删除分镜');
  }
  const shots = normalizeShotOrder(
    story.shots
      .filter(item => item.id !== shot.id)
      .map(item => {
        const selectedVersion = item.versions.find(
          version => version.id === item.selectedVersionId,
        );
        const dependsOnDeletedShot = selectedVersion?.continuityVersion?.shotId === shot.id;
        return {
          ...item,
          imageStale: Boolean(item.selectedVersionId) && (item.imageStale || dependsOnDeletedShot),
          versions: item.versions.map(version => ({
            ...version,
            baseVersion: version.baseVersion?.shotId === shot.id ? null : version.baseVersion,
            continuityVersion:
              version.continuityVersion?.shotId === shot.id ? null : version.continuityVersion,
          })),
        };
      }),
  );
  const updatedStory: StoryProject = {
    ...story,
    keyShotId: story.keyShotId === shot.id ? (shots[0]?.id ?? null) : story.keyShotId,
    shots,
    storyboardReady: isStoryboardComplete(shots),
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  await deleteVersionImages(shot.versions);
  return updatedStory;
}

export async function saveStoryConversation(
  request: SaveStoryConversationRequest,
): Promise<StoryProject> {
  if (!request || typeof request !== 'object' || typeof request.storyId !== 'string') {
    throw new Error('故事对话保存参数无效');
  }
  const messages = parseMessages(request.messages);
  if (
    messages.length !== request.messages.length ||
    messages.length > 200 ||
    JSON.stringify(messages).length > 2_000_000
  ) {
    throw new Error('故事对话消息无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  const updatedStory = { ...story, messages, updatedAt: new Date().toISOString() };
  await saveStore(replaceStory(store, updatedStory));
  return updatedStory;
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

async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
): Promise<CharacterPortraitImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('分镜图片生成任务已完成，但没有返回图片');
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
    throw new Error('参考图片超过 20 MB，无法用于故事图片生成');
  }
  return `data:${image.mimeType};base64,${imageData.toString('base64')}`;
}

function getSelectedVersionReference(shot: StoryShot): StoryVersionReference | null {
  const version = shot.versions.find(item => item.id === shot.selectedVersionId);
  const image = version?.images[0];
  if (!version || !image || version.status !== 'completed') {
    return null;
  }
  return { fileName: image.fileName, shotId: shot.id, versionId: version.id };
}

function resolveVersionImage(
  story: StoryProject,
  reference: StoryVersionReference,
): CharacterPortraitImage | null {
  const version = story.shots
    .find(shot => shot.id === reference.shotId)
    ?.versions.find(item => item.id === reference.versionId && item.status === 'completed');
  return version?.images.find(image => image.fileName === reference.fileName) ?? null;
}

function resolveContinuityReference(
  story: StoryProject,
  shot: StoryShot,
): StoryVersionReference | null {
  const previousShot = story.shots.find(item => item.order === shot.order - 1);
  const previousReference = previousShot ? getSelectedVersionReference(previousShot) : null;
  if (previousReference) {
    return previousReference;
  }
  if (story.keyShotId && story.keyShotId !== shot.id) {
    const keyShot = story.shots.find(item => item.id === story.keyShotId);
    return keyShot ? getSelectedVersionReference(keyShot) : null;
  }
  return null;
}

function resolveStyleReferenceImage(
  reference: IllustrationStyleReference,
  workspace: Awaited<ReturnType<typeof getIllustrationWorkspace>>,
): CharacterPortraitImage | null {
  if (reference.source === 'uploaded') {
    const upload = workspace.uploads.find(
      item => item.id === reference.uploadId && item.fileName === reference.fileName,
    );
    return upload
      ? { fileName: upload.fileName, mimeType: upload.mimeType, url: upload.url }
      : null;
  }
  return (
    workspace.topics
      .find(topic => topic.id === reference.topicId)
      ?.versions.find(
        version => version.id === reference.versionId && version.status === 'completed',
      )
      ?.images.find(image => image.fileName === reference.fileName) ?? null
  );
}

function buildPrompt(story: StoryProject, shot: StoryShot, prompt: string): string {
  return [
    '你正在创作同一个短篇故事中的一幅连续叙事插画。',
    `故事梗概：${story.draft.summary}`,
    `本镜作用：${shot.purpose}`,
    `本镜连续性：${shot.continuity || '保持与前后画面中的角色、场景和时间一致。'}`,
    '参考图中的角色是故事主角。必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致，不要重新设计角色。',
    prompt.trim(),
    '正式画风参考图只用于确认视觉语言，不要复制其中的具体人物动作、道具、环境或构图。',
    ILLUSTRATION_STYLE_GUIDANCE,
    '故事连续性参考图只用于延续角色状态、场景、时间和关键道具，不要照搬上一镜的景别或构图。',
    '只生成一个画面。不要添加标题、大段文字、边框、Logo、水印、漫画格、多格排版、重复人物或重复肢体。',
  ].join('\n');
}

function validateGenerateRequest(request: GenerateStoryShotRequest): void {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string' ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_TEXT_LENGTH ||
    (request.baseVersion !== null && !parseVersionReference(request.baseVersion))
  ) {
    throw new Error('分镜图片生成参数无效');
  }
}

export async function generateStoryShot(
  request: GenerateStoryShotRequest,
): Promise<StoryShotVersion> {
  validateGenerateRequest(request);
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  const shot = requireShot(story, request.shotId);
  if (!story.storyReady || !story.storyboardReady || story.storyboardStale) {
    throw new Error('请先确认故事和当前分镜');
  }
  if (
    shot.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status))
  ) {
    throw new Error('这个分镜已有图片正在生成');
  }

  const portraitWorkspace = await getCharacterPortraitWorkspace();
  const referencePortrait = portraitWorkspace.selectedImage;
  const referenceSheet = portraitWorkspace.selectedSheet;
  const portraitImage = portraitWorkspace.records
    .find(record => record.id === referencePortrait?.taskId)
    ?.images.find(image => image.fileName === referencePortrait?.fileName);
  const sheetImage = portraitWorkspace.sheetRecords
    .find(record => record.id === referenceSheet?.taskId)
    ?.images.find(image => image.fileName === referenceSheet?.fileName);
  if (!referencePortrait || !portraitImage) {
    throw new Error('请先选定或上传正式定妆照');
  }
  if (!referenceSheet || !sheetImage) {
    throw new Error('请先选定或上传正式角色表');
  }

  const illustrationWorkspace = await getIllustrationWorkspace();
  const referenceStyle = illustrationWorkspace.selectedStyleReference;
  if (!referenceStyle) {
    throw new Error('请先在插画管理中选择正式画风参考');
  }
  const styleImage = resolveStyleReferenceImage(referenceStyle, illustrationWorkspace);
  if (!styleImage) {
    throw new Error('正式画风参考已失效，请重新选择');
  }

  const referenceImages = [
    await readReferenceImage(PORTRAIT_ASSET_DIRECTORY, portraitImage),
    await readReferenceImage(SHEET_ASSET_DIRECTORY, sheetImage),
    await readReferenceImage(ILLUSTRATION_ASSET_DIRECTORY, styleImage),
  ];

  let continuityVersion = resolveContinuityReference(story, shot);
  if (continuityVersion) {
    const image = resolveVersionImage(story, continuityVersion);
    if (image) {
      referenceImages.push(await readReferenceImage(ASSET_DIRECTORY, image));
    } else {
      continuityVersion = null;
    }
  }

  let baseVersion: StoryVersionReference | null = null;
  if (request.baseVersion) {
    const image = resolveVersionImage(story, request.baseVersion);
    if (request.baseVersion.shotId !== shot.id || !image) {
      throw new Error('选择的旧分镜版本已失效');
    }
    baseVersion = { ...request.baseVersion };
    if (baseVersion.versionId !== continuityVersion?.versionId) {
      referenceImages.push(await readReferenceImage(ASSET_DIRECTORY, image));
    }
  }

  const prompt = buildPrompt(story, shot, request.prompt);
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify({
      image_urls: referenceImages,
      model: 'gpt-image-2',
      n: 1,
      prompt,
      resolution: story.resolution,
      size: story.size,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const version: StoryShotVersion = {
    baseVersion,
    continuityVersion,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    progress: 0,
    prompt,
    referencePortrait: { ...referencePortrait },
    referenceSheet: { ...referenceSheet },
    referenceStyle: { ...referenceStyle },
    resolution: story.resolution,
    size: story.size,
    status: 'submitted',
    updatedAt: now,
    versionNumber: Math.max(0, ...shot.versions.map(item => item.versionNumber)) + 1,
  };
  const updatedShot: StoryShot = {
    ...shot,
    finalPrompt: request.prompt.trim(),
    versions: [version, ...shot.versions],
  };
  const updatedStory = {
    ...story,
    shots: story.shots.map(item => (item.id === shot.id ? updatedShot : item)),
    updatedAt: now,
  };
  await saveStore(replaceStory(store, updatedStory));
  return version;
}

export async function getStoryShotTask(taskId: string): Promise<StoryShotVersion> {
  if (!ID_PATTERN.test(taskId)) {
    throw new Error('分镜图片生成任务编号无效');
  }
  const initialStore = await loadStore();
  const initialStory = initialStore.stories.find(story =>
    story.shots.some(shot => shot.versions.some(version => version.id === taskId)),
  );
  const initialVersion = initialStory?.shots
    .flatMap(shot => shot.versions)
    .find(version => version.id === taskId);
  if (!initialStory || !initialVersion) {
    throw new Error('未找到分镜图片生成任务');
  }
  if (initialVersion.status === 'completed' && initialVersion.images.length) {
    return initialVersion;
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
  const taskStatus = taskData.status;
  const images =
    taskStatus === 'completed' ? await downloadTaskImages(taskId, taskData) : initialVersion.images;

  const commit = taskCommitQueue.then(async () => {
    const store = await loadStore();
    const story = store.stories.find(item =>
      item.shots.some(shot => shot.versions.some(version => version.id === taskId)),
    );
    const shot = story?.shots.find(item => item.versions.some(version => version.id === taskId));
    const version = shot?.versions.find(item => item.id === taskId);
    if (!story || !shot || !version) {
      throw new Error('分镜图片生成任务已被删除');
    }
    const updatedVersion: StoryShotVersion = {
      ...version,
      errorMessage:
        taskStatus === 'failed' || taskStatus === 'cancelled'
          ? taskData.error?.message || '分镜图片生成任务未完成'
          : null,
      images,
      progress:
        taskStatus === 'completed'
          ? 100
          : Math.min(100, Math.max(0, taskData.progress ?? version.progress)),
      status: taskStatus,
      updatedAt: new Date().toISOString(),
    };
    const updatedShot = {
      ...shot,
      imageStale:
        updatedVersion.status === 'completed' && !shot.selectedVersionId
          ? updatedVersion.size !== story.size
          : shot.imageStale,
      selectedVersionId:
        updatedVersion.status === 'completed' && !shot.selectedVersionId
          ? updatedVersion.id
          : shot.selectedVersionId,
      versions: shot.versions.map(item => (item.id === taskId ? updatedVersion : item)),
    };
    const updatedStory = {
      ...story,
      shots: story.shots.map(item => (item.id === shot.id ? updatedShot : item)),
      updatedAt: updatedVersion.updatedAt,
    };
    await saveStore(replaceStory(store, updatedStory));
    return updatedVersion;
  });
  taskCommitQueue = commit.then(
    () => undefined,
    () => undefined,
  );
  return commit;
}

export async function selectStoryShotVersion(
  request: SelectStoryShotVersionRequest,
): Promise<StoryProject> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string' ||
    typeof request.versionId !== 'string'
  ) {
    throw new Error('正式分镜画面选择无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  const shot = requireShot(story, request.shotId);
  const version = shot.versions.find(item => item.id === request.versionId);
  if (!version || version.status !== 'completed' || !version.images.length) {
    throw new Error('这张分镜图片还不能设为正式画面');
  }
  const previousSelectedVersionId = shot.selectedVersionId;
  const updatedShot = {
    ...shot,
    imageStale: version.size !== story.size,
    selectedVersionId: version.id,
  };
  const updatedStory = {
    ...story,
    shots: story.shots.map(item => {
      if (item.id === shot.id) {
        return updatedShot;
      }
      const selectedVersion = item.versions.find(
        candidate => candidate.id === item.selectedVersionId,
      );
      const dependsOnPreviousVersion = Boolean(
        previousSelectedVersionId &&
        previousSelectedVersionId !== version.id &&
        selectedVersion?.continuityVersion?.versionId === previousSelectedVersionId,
      );
      return {
        ...item,
        imageStale:
          Boolean(item.selectedVersionId) && (item.imageStale || dependsOnPreviousVersion),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
  await saveStore(replaceStory(store, updatedStory));
  return updatedStory;
}

async function deleteVersionImages(versions: StoryShotVersion[]): Promise<void> {
  const assetDirectory = path.join(await getWorkspaceDirectory(), 'assets', ASSET_DIRECTORY);
  await Promise.all(
    versions.flatMap(version =>
      version.images.map(image =>
        unlink(path.join(assetDirectory, image.fileName)).catch(() => undefined),
      ),
    ),
  );
}

export async function deleteStoryShotVersion(
  request: DeleteStoryShotVersionRequest,
): Promise<StoryProject> {
  if (
    !request ||
    typeof request !== 'object' ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string' ||
    typeof request.versionId !== 'string'
  ) {
    throw new Error('分镜版本删除参数无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  const shot = requireShot(story, request.shotId);
  if (hasActiveGeneration(story)) {
    throw new Error('所有分镜图片生成完成后才能删除版本');
  }
  const version = shot.versions.find(item => item.id === request.versionId);
  if (!version) {
    throw new Error('未找到要删除的分镜版本');
  }
  if (['submitted', 'pending', 'processing'].includes(version.status)) {
    throw new Error('图片生成完成后才能删除这个版本');
  }
  const shots = story.shots.map(item => {
    const selectedVersion = item.versions.find(
      candidate => candidate.id === item.selectedVersionId,
    );
    const selectionDeleted = item.id === shot.id && item.selectedVersionId === version.id;
    const dependsOnDeletedVersion = selectedVersion?.continuityVersion?.versionId === version.id;
    return {
      ...item,
      imageStale:
        !selectionDeleted &&
        Boolean(item.selectedVersionId) &&
        (item.imageStale || dependsOnDeletedVersion),
      selectedVersionId: selectionDeleted ? null : item.selectedVersionId,
      versions: item.versions
        .filter(candidate => candidate.id !== version.id)
        .map(candidate => ({
          ...candidate,
          baseVersion:
            candidate.baseVersion?.versionId === version.id ? null : candidate.baseVersion,
          continuityVersion:
            candidate.continuityVersion?.versionId === version.id
              ? null
              : candidate.continuityVersion,
        })),
    };
  });
  const updatedStory = { ...story, shots, updatedAt: new Date().toISOString() };
  await saveStore(replaceStory(store, updatedStory));
  await deleteVersionImages([version]);
  return updatedStory;
}

export async function deleteStory(request: DeleteStoryRequest): Promise<StoryWorkspaceState> {
  if (!request || typeof request !== 'object' || typeof request.storyId !== 'string') {
    throw new Error('故事删除参数无效');
  }
  const store = await loadStore();
  const story = requireStory(store, request.storyId);
  if (
    story.shots.some(shot =>
      shot.versions.some(version =>
        ['submitted', 'pending', 'processing'].includes(version.status),
      ),
    )
  ) {
    throw new Error('分镜图片生成完成后才能删除这个故事');
  }
  const nextStore = { ...store, stories: store.stories.filter(item => item.id !== story.id) };
  await saveStore(nextStore);
  await deleteVersionImages(story.shots.flatMap(shot => shot.versions));
  return { stories: nextStore.stories };
}
