// 角色视觉候选工作区的 JSON 字段解析
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { CharacterVisualImage } from '../../../shared/character-visual';
import { ID_PATTERN } from '../../constants';
import { isTaskStatus } from '../../utils';
import { ASSET_DIRECTORY } from './constants';
import type { StoredGeneration } from './types';

export function getAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
}

export function parseImage(value: unknown): CharacterVisualImage | null {
  if (
    !isPlainObject(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName
  ) {
    return null;
  }
  return {
    fileName: value.fileName,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : 'image/png',
    name: typeof value.name === 'string' ? value.name : '角色候选视觉',
    url: getAssetUrl(value.fileName),
  };
}

export function parseGeneration(value: unknown): StoredGeneration | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }
  const images = Array.isArray(value.images)
    ? value.images.map(parseImage).filter((image): image is CharacterVisualImage => Boolean(image))
    : [];
  const image = parseImage(value.image) ?? images[0] ?? null;
  if (images.length === 0 && image) images.push(image);
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    image,
    images,
    progress: typeof value.progress === 'number' ? value.progress : 0,
    status: value.status,
    taskId: value.taskId,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}
