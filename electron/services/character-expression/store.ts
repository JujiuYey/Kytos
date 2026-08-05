// character-expression 工作区的 JSON 持久化
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { CharacterExpressionRecord } from '../../../shared/character-expression';
import { getCharacterDirectory } from '../character-library';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { EXPRESSION_STORE_FILE_NAME, EXPRESSION_STORE_VERSION } from './constants';
import { parseExpressionRecord } from './parsers';
import type { StoredExpressionWorkspace } from './types';

async function resolveStorePath(characterId: string): Promise<string> {
  return path.join(await getCharacterDirectory(characterId), EXPRESSION_STORE_FILE_NAME);
}

export async function loadExpressionStore(characterId: string): Promise<StoredExpressionWorkspace> {
  const storePath = await resolveStorePath(characterId);
  const value = await readJsonFile(storePath);
  if (!isPlainObject(value)) {
    return { records: [], version: EXPRESSION_STORE_VERSION };
  }
  if (value.version !== EXPRESSION_STORE_VERSION) {
    throw new Error('表情数据版本无效');
  }
  const records = Array.isArray(value.records)
    ? (value.records as unknown[])
        .map(parseExpressionRecord)
        .filter((record): record is CharacterExpressionRecord => Boolean(record))
    : [];
  return {
    records: records.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    version: EXPRESSION_STORE_VERSION,
  };
}

export async function saveExpressionStore(
  characterId: string,
  store: StoredExpressionWorkspace,
): Promise<void> {
  await writeJsonFile(await resolveStorePath(characterId), store);
}

export function replaceRecord(
  store: StoredExpressionWorkspace,
  record: CharacterExpressionRecord,
): StoredExpressionWorkspace {
  return {
    ...store,
    records: [record, ...store.records.filter(item => item.id !== record.id)].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}

// 重命名 / 删除单条表情时的轻量更新 helper
export function patchRecordName(
  store: StoredExpressionWorkspace,
  recordId: string,
  name: string,
  updatedAt: string,
): StoredExpressionWorkspace {
  return {
    ...store,
    records: store.records.map(item =>
      item.id === recordId ? { ...item, name, updatedAt } : item,
    ),
  };
}

export function removeImageFromRecord(
  store: StoredExpressionWorkspace,
  recordId: string,
  fileName: string,
  updatedAt: string,
): StoredExpressionWorkspace {
  const record = store.records.find(item => item.id === recordId);
  if (!record) return store;
  const remainingImages = record.images.filter(item => item.fileName !== fileName);
  if (remainingImages.length > 0) {
    return {
      ...store,
      records: store.records.map(item =>
        item.id === recordId ? { ...item, images: remainingImages, updatedAt } : item,
      ),
    };
  }
  return {
    ...store,
    records: store.records.filter(item => item.id !== recordId),
  };
}
