// character-expression 工作区的 JSON 持久化
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { CharacterExpressionRecord } from '../../../shared/character-expression';
import { getCharacterDirectory } from '../character-library';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { EXPRESSION_STORE_FILE_NAME, EXPRESSION_STORE_VERSION } from './constants';
import { parseExpressionRecord } from './parsers';
import type { StoredExpressionWorkspace } from './types';

// 定位指定角色表情库的 JSON 文件路径
async function resolveStorePath(characterId: string): Promise<string> {
  return path.join(await getCharacterDirectory(characterId), EXPRESSION_STORE_FILE_NAME);
}

// 读取表情库：文件缺失或非对象视为空 store；版本不一致抛错避免污染新数据
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

// 把表情库整体写回 JSON，覆盖式持久化
export async function saveExpressionStore(
  characterId: string,
  store: StoredExpressionWorkspace,
): Promise<void> {
  await writeJsonFile(await resolveStorePath(characterId), store);
}

// 替换或前置插入一条表情记录，并按 updatedAt 倒序重排，保证最新记录在最前
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

// 移除记录中指定图片；若该记录图片被全部清空则一并删除整条记录，保持“记录必有图”约束
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
