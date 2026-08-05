// 故事级 CRUD：createStory / updateStory / updateStoryDraft / saveStoryConversation / getStory / getStoryWorkspace
import { randomUUID } from 'node:crypto';
import { isPlainObject } from 'es-toolkit';
import { createEmptyStoryDraft } from '../../../shared/story';
import type {
  CreateStoryRequest,
  SaveStoryConversationRequest,
  StoryDraft,
  StoryDraftUpdateResult,
  StoryProject,
  StoryWorkspaceState,
  UpdateStoryRequest,
} from '../../../shared/story';
import { DRAFT_FIELDS, MAX_TEXT_LENGTH, MAX_TITLE_LENGTH } from './constants';
import {
  hasActiveGeneration,
  isResolution,
  isSize,
  isStoryboardComplete,
  parseMessages,
  requireStory,
} from './parsers';
import { loadStore, replaceStory, saveStore } from './store';

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
    resolution: '1k',
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
  if (!isPlainObject(request) || typeof request.storyId !== 'string') {
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

export async function saveStoryConversation(
  request: SaveStoryConversationRequest,
): Promise<StoryProject> {
  if (!isPlainObject(request) || typeof request.storyId !== 'string') {
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
