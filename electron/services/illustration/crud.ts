// illustration 公共 CRUD：workspace / topic / brief / conversation / 上传图
import { randomUUID } from 'node:crypto';
import { isPlainObject } from 'es-toolkit';
import type {
  CreateIllustrationTopicRequest,
  DeleteIllustrationUploadRequest,
  DeleteIllustrationTopicRequest,
  IllustrationBrief,
  IllustrationBriefUpdateResult,
  IllustrationTopic,
  IllustrationWorkspaceState,
  SaveIllustrationConversationRequest,
  UpdateIllustrationTopicRequest,
  UploadedIllustration,
  UploadIllustrationRequest,
} from '../../../shared/illustration';
import { createEmptyIllustrationBrief } from '../../../shared/illustration';
import { ID_PATTERN, MAX_TEXT_LENGTH, MAX_TITLE_LENGTH } from '../../constants';
import { isNodeError } from '../../utils/node-error';
import { saveUploadedIllustrationFile, safeUnlinkAssetFile } from './assets';
import { BRIEF_FIELDS } from './constants';
import { getAssetUrl, parseMessages } from './parsers';
import {
  loadStore,
  removeTopic,
  removeUpload,
  replaceTopic,
  requireTopic,
  saveStore,
} from './store';

export async function getIllustrationWorkspace(): Promise<IllustrationWorkspaceState> {
  const store = await loadStore();
  return {
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
  if (!isPlainObject(request) || typeof request.useCharacter !== 'boolean') {
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
  if (!isPlainObject(request) || typeof request.topicId !== 'string') {
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

type IllustrationBriefPatch = Partial<IllustrationBrief> & { title?: string };

export async function updateIllustrationBrief(
  topicId: string,
  patch: IllustrationBriefPatch,
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
  if (!isPlainObject(request) || typeof request.topicId !== 'string') {
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

export async function uploadIllustration(
  request: UploadIllustrationRequest,
): Promise<UploadedIllustration> {
  const fileName = await saveUploadedIllustrationFile(request);
  const upload: UploadedIllustration = {
    createdAt: new Date().toISOString(),
    fileName,
    id: fileName.split('.')[0],
    mimeType: request.mimeType,
    originalName: request.fileName.trim(),
    size: request.fileData.byteLength,
    url: getAssetUrl(fileName),
  };
  try {
    const store = await loadStore();
    await saveStore({ ...store, uploads: [upload, ...store.uploads] });
  } catch (error: unknown) {
    await safeUnlinkAssetFile(fileName);
    throw error;
  }
  return upload;
}

export async function deleteIllustrationUpload(
  request: DeleteIllustrationUploadRequest,
): Promise<IllustrationWorkspaceState> {
  if (
    !isPlainObject(request) ||
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
  const nextStore = removeUpload(store, upload.id);
  await saveStore(nextStore);
  try {
    await safeUnlinkAssetFile(upload.fileName);
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      await saveStore(store);
      throw new Error(
        error instanceof Error ? `上传插画删除失败：${error.message}` : '上传插画删除失败',
      );
    }
  }
  return {
    topics: nextStore.topics,
    uploads: nextStore.uploads,
  };
}

export async function deleteIllustrationTopic(
  request: DeleteIllustrationTopicRequest,
): Promise<IllustrationWorkspaceState> {
  if (!isPlainObject(request) || typeof request.topicId !== 'string') {
    throw new Error('插画主题删除参数无效');
  }
  const store = await loadStore();
  const topic = requireTopic(store, request.topicId);
  if (
    topic.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status))
  ) {
    throw new Error('插画生成完成后才能删除这个主题');
  }
  const nextStore = removeTopic(store, topic.id);
  await saveStore(nextStore);
  const allImageFileNames = topic.versions.flatMap(version =>
    version.images.map(image => image.fileName),
  );
  await Promise.all(allImageFileNames.map(safeUnlinkAssetFile));
  return {
    topics: nextStore.topics,
    uploads: nextStore.uploads,
  };
}
