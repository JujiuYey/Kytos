// 分镜图片生成：submit task + poll task 状态 + 串行提交结果
import { isPlainObject } from 'es-toolkit';
import {
  getOfficialCharacterVisualReferences,
  getCharacterVisualWorkspace,
} from '../character-visual';
import { getCredentialValue } from '../credentials';
import type {
  GenerateStoryShotRequest,
  StoryProject,
  StoryShot,
  StoryShotVersion,
  StoryVersionReference,
} from '../../../shared/story';
import { ID_PATTERN, MAX_TEXT_LENGTH } from '../../constants';
import {
  buildGptImage2RequestBody,
  isTaskStatus,
  pollImageTask,
  submitImageTask,
} from '../../utils';
import type { GptImage2Resolution } from '../../utils';
import { ASSET_DIRECTORY, isActiveGenerationStatus } from './constants';
import { downloadTaskImages, readReferenceImage } from './assets';
import { parseVersionReference, requireShot, requireStory } from './parsers';
import { loadStore, replaceStory, saveStore } from './store';

let taskCommitQueue: Promise<void> = Promise.resolve();

function buildPrompt(story: StoryProject, shot: StoryShot, prompt: string): string {
  return [
    '你正在创作同一个短篇故事中的一幅连续叙事插画。',
    `故事梗概：${story.draft.summary}`,
    `本镜作用：${shot.purpose}`,
    `本镜连续性：${shot.continuity || '保持与前后画面中的角色、场景和时间一致。'}`,
    '参考图中的角色是故事主角。必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致，不要重新设计角色。',
    prompt.trim(),
    '故事连续性参考图只用于延续角色状态、场景、时间和关键道具，不要照搬上一镜的景别或构图。',
    '只生成一个画面。不要添加标题、大段文字、边框、Logo、水印、漫画格、多格排版、重复人物或重复肢体。',
  ].join('\n');
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
): StoryShotVersion['images'][number] | null {
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

function validateGenerateRequest(request: GenerateStoryShotRequest): void {
  if (
    !isPlainObject(request) ||
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
  if (shot.versions.some(version => isActiveGenerationStatus(version.status))) {
    throw new Error('这个分镜已有图片正在生成');
  }

  const visualWorkspace = await getCharacterVisualWorkspace();
  const visualReferences = getOfficialCharacterVisualReferences(visualWorkspace);
  if (!visualReferences.length) {
    throw new Error('请先将至少一张角色视觉图片设为正式资产');
  }
  const referenceImages = await Promise.all(
    visualReferences.map(reference => readReferenceImage(reference.directoryName, reference.image)),
  );
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
  const body = buildGptImage2RequestBody({
    imageUrls: referenceImages,
    n: 1,
    prompt,
    resolution: story.resolution as GptImage2Resolution,
    size: story.size,
  });
  const taskId = await submitImageTask(body, apiKey);

  const now = new Date().toISOString();
  const version: StoryShotVersion = {
    baseVersion,
    characterReferences: visualReferences.map(reference => ({ ...reference.selection })),
    continuityVersion,
    createdAt: now,
    errorMessage: null,
    id: taskId,
    images: [],
    progress: 0,
    prompt,
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
  const taskData = await pollImageTask(taskId, apiKey);
  const taskStatusRaw = taskData.status;
  if (!isTaskStatus(taskStatusRaw)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }
  const taskStatus = taskStatusRaw;
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
