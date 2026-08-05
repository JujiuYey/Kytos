// illustration 模块的生成 / 轮询 / 删除版本
import { isPlainObject } from 'es-toolkit';
import { MAX_ILLUSTRATION_REFERENCE_IMAGES } from '../../../shared/illustration';
import type { CharacterExpressionReferenceSelection } from '../../../shared/character-expression';
import type {
  DeleteIllustrationVersionRequest,
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
import { characterReferenceKey, parseCharacterReferenceSelection } from './parsers';
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

  // 1. 解析并去重用户提交的角色参考
  const parsedReferences = request.characterReferences.map(parseCharacterReferenceSelection);
  if (parsedReferences.some(selection => !selection)) {
    throw new Error('选择的角色参考无效');
  }
  const requestedCharacterReferences = [
    ...new Map(
      (parsedReferences as CharacterExpressionReferenceSelection[]).map(selection => [
        characterReferenceKey(selection),
        selection,
      ]),
    ).values(),
  ];
  if (requestedCharacterReferences.length === 0) {
    throw new Error('请先选择至少一张角色参考');
  }

  // 2. 收集 referenceImages：官方角色视觉（只在 useCharacter=true）
  const referenceImages: string[] = [];
  if (topic.useCharacter) {
    const characterLibrary = await getCharacterLibrary();
    const [visualWorkspace, expressionWorkspace] = await Promise.all([
      getCharacterVisualWorkspace(),
      getCharacterExpressionWorkspace({ characterId: characterLibrary.activeCharacterId }),
    ]);
    const visualReferences = getOfficialCharacterVisualReferences(visualWorkspace).map(
      reference => ({
        ...reference,
        selection: { ...reference.selection, kind: 'visual' as const },
      }),
    );
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
    const availableReferenceMap = new Map(
      [...visualReferences, ...expressionReferences].map(reference => [
        characterReferenceKey(reference.selection),
        reference,
      ]),
    );
    const references = requestedCharacterReferences.map(selection => {
      const match = availableReferenceMap.get(characterReferenceKey(selection));
      if (!match) {
        throw new Error('选择的角色参考已失效');
      }
      return match;
    });
    referenceImages.push(
      ...(await Promise.all(
        references.map(reference => readReferenceImage(reference.directoryName, reference.image)),
      )),
    );
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
    topic.useCharacter,
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
    characterReferences: requestedCharacterReferences.map(selection => ({ ...selection })),
    createdAt: now,
    errorMessage: null,
    id: taskId,
    images: [],
    progress: 0,
    prompt,
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
