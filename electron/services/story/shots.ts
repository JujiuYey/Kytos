// 分镜级 CRUD：present/confirm/patch/update/create/move/delete shot
import { randomUUID } from 'node:crypto';
import { isPlainObject } from 'es-toolkit';
import { STORY_SHOT_LIMITS } from '../../../shared/story';
import type {
  CreateStoryShotRequest,
  DeleteStoryShotRequest,
  MoveStoryShotRequest,
  StoryProject,
  StoryShot,
  StoryShotContent,
  StoryShotUpdateResult,
  StoryboardUpdateResult,
  UpdateStoryShotRequest,
} from '../../../shared/story';
import { MAX_TEXT_LENGTH, SHOT_FIELDS, VISUAL_SHOT_FIELDS } from './constants';
import {
  hasActiveGeneration,
  isStoryboardComplete,
  normalizeShotOrder,
  parseShotContent,
  requireShot,
  requireStory,
} from './parsers';
import { loadStore, replaceStory, saveStore } from './store';
import { deleteVersionImages } from './assets';
import { updateStory } from './crud';

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
    !isPlainObject(request) ||
    typeof request.storyId !== 'string' ||
    typeof request.shotId !== 'string'
  ) {
    throw new Error('分镜更新参数无效');
  }
  return patchStoryShot(request.storyId, request.shotId, request);
}

export async function createStoryShot(request: CreateStoryShotRequest): Promise<StoryProject> {
  if (!isPlainObject(request) || typeof request.storyId !== 'string') {
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
    !isPlainObject(request) ||
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
    !isPlainObject(request) ||
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
