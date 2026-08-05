// 分镜版本选择 / 删除版本 / 删除故事
import { isPlainObject } from 'es-toolkit';
import type {
  DeleteStoryRequest,
  DeleteStoryShotVersionRequest,
  SelectStoryShotVersionRequest,
  StoryProject,
  StoryWorkspaceState,
} from '../../../shared/story';
import { hasActiveGeneration, requireShot, requireStory } from './parsers';
import { loadStore, replaceStory, saveStore } from './store';
import { deleteVersionImages } from './assets';

export async function selectStoryShotVersion(
  request: SelectStoryShotVersionRequest,
): Promise<StoryProject> {
  if (
    !isPlainObject(request) ||
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

export async function deleteStoryShotVersion(
  request: DeleteStoryShotVersionRequest,
): Promise<StoryProject> {
  if (
    !isPlainObject(request) ||
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
  if (!isPlainObject(request) || typeof request.storyId !== 'string') {
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
