// story 工作区 JSON 持久化
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { StoryProject } from '../../../shared/story';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { getWorkspaceDirectory } from '../workspace';
import { STORE_FILE_NAME } from './constants';
import { parseStory } from './parsers';
import type { StoredStoryWorkspace } from './types';

const STORE_VERSION = 3;

async function getStorePath(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), STORE_FILE_NAME);
}

export async function loadStore(): Promise<StoredStoryWorkspace> {
  const storePath = await getStorePath();
  const value = await readJsonFile(storePath);
  if (!isPlainObject(value)) {
    return { stories: [], version: STORE_VERSION };
  }
  const migrateResolutionStale = value.version !== 2 && value.version !== 3;
  const store: StoredStoryWorkspace = {
    stories: Array.isArray(value.stories)
      ? (value.stories as unknown[])
          .map(story => parseStory(story, migrateResolutionStale))
          .filter((story): story is StoryProject => Boolean(story))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : [],
    version: STORE_VERSION,
  };
  if (value.version !== STORE_VERSION) {
    await writeJsonFile(storePath, store);
  }
  return store;
}

export async function saveStore(store: StoredStoryWorkspace): Promise<void> {
  await writeJsonFile(await getStorePath(), store);
}

export function replaceStory(
  store: StoredStoryWorkspace,
  story: StoryProject,
): StoredStoryWorkspace {
  return {
    ...store,
    stories: [story, ...store.stories.filter(item => item.id !== story.id)].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}
