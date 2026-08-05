// illustration 工作区的 JSON 持久化与轻量不可变更新
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { IllustrationTopic } from '../../../shared/illustration';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { getWorkspaceDirectory } from '../workspace';
import { ID_PATTERN } from '../../constants';
import { STORE_FILE_NAME, STORE_VERSION } from './constants';
import { parseTopic, parseUpload } from './parsers';
import type { StoredIllustrationWorkspace } from './types';

async function getStorePath(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), STORE_FILE_NAME);
}

export async function loadStore(): Promise<StoredIllustrationWorkspace> {
  const storePath = await getStorePath();
  const value = await readJsonFile(storePath);
  if (!isPlainObject(value)) {
    return { topics: [], uploads: [], version: STORE_VERSION };
  }
  const topics = Array.isArray(value.topics)
    ? (value.topics as unknown[])
        .map(parseTopic)
        .filter((topic): topic is IllustrationTopic => Boolean(topic))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    : [];
  const uploads = Array.isArray(value.uploads)
    ? (value.uploads as unknown[])
        .map(parseUpload)
        .filter((upload): upload is NonNullable<ReturnType<typeof parseUpload>> => Boolean(upload))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  const store: StoredIllustrationWorkspace = { topics, uploads, version: STORE_VERSION };
  if (value.version !== STORE_VERSION || 'selectedStyleReference' in value) {
    await writeJsonFile(storePath, store);
  }
  return store;
}

export async function saveStore(store: StoredIllustrationWorkspace): Promise<void> {
  await writeJsonFile(await getStorePath(), store);
}

export function replaceTopic(
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

export function removeTopic(
  store: StoredIllustrationWorkspace,
  topicId: string,
): StoredIllustrationWorkspace {
  return {
    ...store,
    topics: store.topics.filter(item => item.id !== topicId),
  };
}

export function removeUpload(
  store: StoredIllustrationWorkspace,
  uploadId: string,
): StoredIllustrationWorkspace {
  return {
    ...store,
    uploads: store.uploads.filter(item => item.id !== uploadId),
  };
}

export function requireTopic(
  store: StoredIllustrationWorkspace,
  topicId: string,
): IllustrationTopic {
  if (!ID_PATTERN.test(topicId)) {
    throw new Error('插画主题编号无效');
  }
  const topic = store.topics.find(item => item.id === topicId);
  if (!topic) {
    throw new Error('未找到插画主题');
  }
  return topic;
}
