// illustration 模块的生成 / 轮询 / 删除版本
import { isPlainObject } from 'es-toolkit';
import { MAX_ILLUSTRATION_REFERENCE_IMAGES } from '../../../shared/illustration';
import type {
  DeleteIllustrationVersionRequest,
  IllustrationReference,
  GenerateIllustrationRequest,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
} from '../../../shared/illustration';
import { ID_PATTERN } from '../../constants';
import {
  buildGptImage2RequestBody,
  isTaskStatus,
  pollImageTask,
  submitImageTask,
} from '../../utils';
import type { GptImage2Resolution } from '../../utils';
import { getCharacterExpressionWorkspace } from '../character-expression';
import { getCharacterLibrary } from '../character-library';
import { getCredentialValue } from '../credentials';
import {
  getCharacterVisualWorkspace,
  getOfficialCharacterVisualReferences,
} from '../character-visual';
import { downloadTaskImages, readReferenceImage, safeUnlinkAssetFiles } from './assets';
import { ASSET_DIRECTORY, EXPRESSION_ASSET_DIRECTORY } from './constants';
import { illustrationReferenceKey, parseIllustrationReference } from './parsers';
import { buildIllustrationPrompt, validateGenerateRequest } from './prompts';
import { loadStore, replaceTopic, requireTopic, saveStore } from './store';

export async function generateIllustration(
  request: GenerateIllustrationRequest,
): Promise<IllustrationVersion> {
  validateGenerateRequest(request);
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  if (!topic.ready) {
    throw new Error('请先通过对话完成并确认画面方案');
  }

  // 1. 解析并去重本次明确选择的画面素材
  const parsedReferences = request.references.map(parseIllustrationReference);
  if (parsedReferences.some(selection => !selection)) {
    throw new Error('选择的画面素材无效');
  }
  const requestedReferences = [
    ...new Map(
      (parsedReferences as IllustrationReference[]).map(selection => [
        illustrationReferenceKey(selection),
        selection,
      ]),
    ).values(),
  ];

  // 2. 解析角色素材和插画素材，绝不回退到全局选中状态
  const referenceImages: string[] = [];
  const characterIds = [
    ...new Set(
      requestedReferences.flatMap(reference =>
        reference.kind === 'illustration' ? [] : [reference.characterId],
      ),
    ),
  ];
  const characterReferenceWorkspaces = new Map<
    string,
    Awaited<ReturnType<typeof getCharacterVisualWorkspace>>
  >();
  const expressionReferenceWorkspaces = new Map<
    string,
    Awaited<ReturnType<typeof getCharacterExpressionWorkspace>>
  >();
  if (characterIds.length) {
    const characterLibrary = await getCharacterLibrary();
    if (
      !characterIds.every(characterId =>
        characterLibrary.characters.some(item => item.id === characterId),
      )
    ) {
      throw new Error('选择的角色已不存在');
    }
    const workspaces = await Promise.all(
      characterIds.map(async characterId => {
        const [visualWorkspace, expressionWorkspace] = await Promise.all([
          getCharacterVisualWorkspace(characterId),
          getCharacterExpressionWorkspace({ characterId }),
        ]);
        return { characterId, expressionWorkspace, visualWorkspace };
      }),
    );
    for (const workspace of workspaces) {
      characterReferenceWorkspaces.set(workspace.characterId, workspace.visualWorkspace);
      expressionReferenceWorkspaces.set(workspace.characterId, workspace.expressionWorkspace);
    }
  }
  for (const reference of requestedReferences) {
    if (reference.kind === 'character-visual') {
      const workspace = characterReferenceWorkspaces.get(reference.characterId);
      const match =
        workspace &&
        getOfficialCharacterVisualReferences(workspace).find(
          item =>
            item.selection.taskId === reference.taskId &&
            item.selection.fileName === reference.fileName,
        );
      if (!match) throw new Error('选择的角色视觉已失效');
      referenceImages.push(await readReferenceImage(match.directoryName, match.image));
      continue;
    }
    if (reference.kind === 'character-expression') {
      const workspace = expressionReferenceWorkspaces.get(reference.characterId);
      const record = workspace?.records.find(item => item.id === reference.taskId);
      const image = record?.images.find(item => item.fileName === reference.fileName);
      if (!record || !image) throw new Error('选择的角色表情已失效');
      referenceImages.push(await readReferenceImage(EXPRESSION_ASSET_DIRECTORY, image));
      continue;
    }
    if (reference.kind !== 'illustration') {
      throw new Error('选择的画面素材无效');
    }
    if (reference.source === 'uploaded') {
      const upload = store.uploads.find(item => item.id === reference.uploadId);
      if (!upload || upload.fileName !== reference.fileName) throw new Error('选择的插画已失效');
      referenceImages.push(await readReferenceImage(ASSET_DIRECTORY, upload));
      continue;
    }
    const sourceTopic = store.topics.find(item => item.id === reference.topicId);
    const sourceVersion = sourceTopic?.versions.find(item => item.id === reference.versionId);
    const sourceImage = sourceVersion?.images.find(item => item.fileName === reference.fileName);
    if (!sourceImage || !sourceVersion || sourceVersion.status !== 'completed') {
      throw new Error('选择的创作插画已失效');
    }
    referenceImages.push(await readReferenceImage(ASSET_DIRECTORY, sourceImage));
  }

  // 3. 旧版本作为修改底稿
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

  // 4. 调用生成接口
  const prompt = buildIllustrationPrompt(
    request.prompt,
    requestedReferences.some(reference => reference.kind.startsWith('character-')),
    request.revisionPrompt?.trim() ?? '',
  );
  const apiKey = await getCredentialValue('apimart');
  const body = buildGptImage2RequestBody({
    imageUrls: referenceImages.length > 0 ? referenceImages : undefined,
    n: 1,
    prompt,
    resolution: request.resolution as GptImage2Resolution,
    size: request.size,
  });
  const taskId = await submitImageTask(body, apiKey);

  // 5. 写回任务记录
  const now = new Date().toISOString();
  const version: IllustrationVersion = {
    baseVersion,
    createdAt: now,
    errorMessage: null,
    id: taskId,
    images: [],
    progress: 0,
    prompt,
    resolution: request.resolution,
    references: requestedReferences.map(reference => ({ ...reference })),
    size: request.size,
    status: 'submitted',
    updatedAt: now,
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

// 旧插画版本所在的工作区子目录名（用 ASSET_DIRECTORY 即"illustrations"目录）

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
  const taskData = await pollImageTask(taskId, apiKey);
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
    !isPlainObject(request) ||
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
  await safeUnlinkAssetFiles(version.images.map(image => image.fileName));
  return updatedTopic;
}
