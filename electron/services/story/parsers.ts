// 持久化字段解析与类型守卫
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import { CHARACTER_VISUAL_RESOLUTIONS } from '../../../shared/character-visual';
import type {
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualAssetSelection,
} from '../../../shared/character-visual';
import type { IllustrationSize } from '../../../shared/illustration';
import { ILLUSTRATION_SIZES } from '../../../shared/illustration';
import {
  STORY_SHOT_LIMITS,
  createEmptyStoryDraft,
  createEmptyStoryShotContent,
} from '../../../shared/story';
import type {
  StoryAgentMessage,
  StoryDraft,
  StoryProject,
  StoryShot,
  StoryShotContent,
  StoryShotVersion,
  StoryVersionReference,
} from '../../../shared/story';
import { ID_PATTERN, MAX_STORED_PROMPT_LENGTH } from '../../constants';
import { isTaskStatus } from '../../utils';
import {
  ASSET_DIRECTORY,
  DRAFT_FIELDS,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  SHOT_FIELDS,
} from './constants';
import type { StoredStoryWorkspace } from './types';

export function isSize(value: unknown): value is IllustrationSize {
  return ILLUSTRATION_SIZES.includes(value as IllustrationSize);
}

export function isResolution(value: unknown): value is CharacterVisualResolution {
  return CHARACTER_VISUAL_RESOLUTIONS.includes(value as CharacterVisualResolution);
}

// 重新导出，保持现有调用方从 './parsers' 拿类型守卫的便利
export { isTaskStatus };

export function getAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
}

export function parseMessages(value: unknown): StoryAgentMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      message =>
        isPlainObject(message) &&
        typeof message.id === 'string' &&
        ['assistant', 'system', 'user'].includes(String(message.role)) &&
        Array.isArray(message.parts),
    )
    .slice(-200) as StoryAgentMessage[];
}

export function parseDraft(value: unknown): StoryDraft {
  const draft = createEmptyStoryDraft();
  if (!isPlainObject(value)) {
    return draft;
  }
  for (const field of DRAFT_FIELDS) {
    if (typeof value[field] === 'string') {
      draft[field] = (value[field] as string).slice(0, MAX_TEXT_LENGTH);
    }
  }
  return draft;
}

export function parseShotContent(value: unknown): StoryShotContent {
  const content = createEmptyStoryShotContent();
  if (!isPlainObject(value)) {
    return content;
  }
  for (const field of SHOT_FIELDS) {
    if (typeof value[field] === 'string') {
      content[field] = (value[field] as string).slice(0, MAX_TEXT_LENGTH);
    }
  }
  return content;
}

export function parseSelection(value: unknown): CharacterVisualAssetSelection | null {
  if (
    !isPlainObject(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId)
  ) {
    return null;
  }
  return { fileName: value.fileName, taskId: value.taskId };
}

export function parseVersionReference(value: unknown): StoryVersionReference | null {
  if (
    !isPlainObject(value) ||
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

export function parseImage(value: unknown): CharacterVisualImage | null {
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
    url: getAssetUrl(value.fileName),
  };
}

export function parseVersion(value: unknown): StoryShotVersion | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.versionNumber !== 'number' ||
    !Number.isInteger(value.versionNumber) ||
    value.versionNumber < 1 ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    !isSize(value.size) ||
    !isResolution(value.resolution)
  ) {
    return null;
  }
  const rawStatus = value.status;
  if (!isTaskStatus(rawStatus)) {
    return null;
  }
  const versionStatus = rawStatus;
  const characterReferences = Array.isArray(value.characterReferences)
    ? value.characterReferences
        .map(parseSelection)
        .filter((selection): selection is CharacterVisualAssetSelection => Boolean(selection))
    : [parseSelection(value.referencePortrait), parseSelection(value.referenceSheet)].filter(
        (selection): selection is CharacterVisualAssetSelection => Boolean(selection),
      );
  return {
    baseVersion: parseVersionReference(value.baseVersion),
    characterReferences: [
      ...new Map(
        characterReferences.map(selection => [
          `${selection.taskId}:${selection.fileName}`,
          selection,
        ]),
      ).values(),
    ],
    continuityVersion: parseVersionReference(value.continuityVersion),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images: Array.isArray(value.images)
      ? value.images
          .map(parseImage)
          .filter((image): image is CharacterVisualImage => Boolean(image))
      : [],
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    resolution: value.resolution,
    size: value.size,
    status: versionStatus,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    versionNumber: value.versionNumber,
  };
}

export function parseShot(value: unknown, fallbackOrder: number): StoryShot | null {
  if (
    !isPlainObject(value) ||
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

export function normalizeShotOrder(shots: StoryShot[]): StoryShot[] {
  return [...shots]
    .sort((left, right) => left.order - right.order)
    .map((shot, index) => ({ ...shot, order: index + 1 }));
}

export function isStoryboardComplete(shots: StoryShot[]): boolean {
  return (
    shots.length >= STORY_SHOT_LIMITS.min &&
    shots.length <= STORY_SHOT_LIMITS.max &&
    shots.every(shot => Boolean(shot.title.trim() && shot.scene.trim() && shot.finalPrompt.trim()))
  );
}

export function parseStory(value: unknown, migrateResolutionStale: boolean): StoryProject | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > MAX_TITLE_LENGTH
  ) {
    return null;
  }
  const resolution = isResolution(value.resolution) ? value.resolution : '1k';
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

export function requireStory(store: StoredStoryWorkspace, storyId: string): StoryProject {
  if (!ID_PATTERN.test(storyId)) {
    throw new Error('故事编号无效');
  }
  const story = store.stories.find(item => item.id === storyId);
  if (!story) {
    throw new Error('未找到这个故事');
  }
  return story;
}

export function requireShot(story: StoryProject, shotId: string): StoryShot {
  if (!ID_PATTERN.test(shotId)) {
    throw new Error('分镜编号无效');
  }
  const shot = story.shots.find(item => item.id === shotId);
  if (!shot) {
    throw new Error('未找到这个分镜');
  }
  return shot;
}

export function hasActiveGeneration(story: StoryProject): boolean {
  return story.shots.some(shot =>
    shot.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status)),
  );
}
