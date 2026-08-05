// character-expression 生成任务的独立 JSON 持久化
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { CharacterExpressionTask } from '../../../shared/character-expression';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { getCharacterDirectory } from '../character-library';
import { EXPRESSION_TASK_STORE_FILE_NAME, EXPRESSION_TASK_STORE_VERSION } from './constants';
import { parseExpressionTask } from './parsers';
import type { StoredExpressionTaskWorkspace } from './types';

async function resolveTaskStorePath(characterId: string): Promise<string> {
  return path.join(await getCharacterDirectory(characterId), EXPRESSION_TASK_STORE_FILE_NAME);
}

export async function loadExpressionTaskStore(
  characterId: string,
): Promise<StoredExpressionTaskWorkspace> {
  const value = await readJsonFile(await resolveTaskStorePath(characterId));
  if (!isPlainObject(value)) {
    return { tasks: {}, version: EXPRESSION_TASK_STORE_VERSION };
  }
  if (value.version !== EXPRESSION_TASK_STORE_VERSION) {
    throw new Error('表情任务数据版本无效');
  }
  const tasks: Record<string, CharacterExpressionTask> = {};
  if (isPlainObject(value.tasks)) {
    for (const [taskId, taskValue] of Object.entries(value.tasks)) {
      const task = parseExpressionTask(taskValue);
      if (task?.id === taskId) {
        tasks[taskId] = task;
      }
    }
  }
  return { tasks, version: EXPRESSION_TASK_STORE_VERSION };
}

export async function saveExpressionTaskStore(
  characterId: string,
  store: StoredExpressionTaskWorkspace,
): Promise<void> {
  await writeJsonFile(await resolveTaskStorePath(characterId), store);
}

export function upsertExpressionTask(
  store: StoredExpressionTaskWorkspace,
  task: CharacterExpressionTask,
): StoredExpressionTaskWorkspace {
  return {
    ...store,
    tasks: { ...store.tasks, [task.id]: task },
  };
}

export function removeExpressionTask(
  store: StoredExpressionTaskWorkspace,
  taskId: string,
): StoredExpressionTaskWorkspace {
  const { [taskId]: _removedTask, ...tasks } = store.tasks;
  return { ...store, tasks };
}
