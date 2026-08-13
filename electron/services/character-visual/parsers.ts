// 解析 character-visual 持久化字段、类型守卫、URL 与选取 key
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import {
  CHARACTER_ANCHOR_ROLES,
  CHARACTER_VISUAL_RESOLUTIONS,
  CHARACTER_VISUAL_SIZES,
  MAX_CHARACTER_REFERENCE_IMAGES,
} from '../../../shared/character-visual';
import type {
  CharacterAnchorRole,
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualSize,
} from '../../../shared/character-visual';
import { ID_PATTERN, MAX_NAME_LENGTH, MAX_STORED_PROMPT_LENGTH } from '../../constants';
import { LEGACY_ACTION_ASSET_DIRECTORY, LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY } from './constants';
import { isTaskStatus } from '../../utils';
import type {
  LegacyActionRecord,
  LegacyReferenceBoardRecord,
  LegacyVisualAssetSelection,
} from './types';

export function isVisualSize(value: unknown): value is CharacterVisualSize {
  return CHARACTER_VISUAL_SIZES.includes(value as CharacterVisualSize);
}

export function isVisualResolution(value: unknown): value is CharacterVisualResolution {
  return CHARACTER_VISUAL_RESOLUTIONS.includes(value as CharacterVisualResolution);
}

export function isCharacterAnchorRole(value: unknown): value is CharacterAnchorRole {
  return CHARACTER_ANCHOR_ROLES.includes(value as CharacterAnchorRole);
}

// 重新导出，让 character-visual 的 'status' 类型守卫从 './parsers' 拿
export { isTaskStatus };

export function getCharacterAssetUrl(directoryName: string, fileName: string): string {
  return `app://bundle/workspace-assets/${directoryName}/${encodeURIComponent(fileName)}`;
}

export function parseImage(
  value: unknown,
  directoryName: string,
  fallbackName?: string,
): CharacterVisualImage | null {
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
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : fallbackName,
    url: getCharacterAssetUrl(directoryName, value.fileName),
  };
}

export function parseSelection(value: unknown): CharacterVisualAssetSelection | null {
  if (
    !isPlainObject(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId)
  ) {
    return null;
  }
  return { fileName: value.fileName, taskId: value.taskId };
}

export function parseLegacyVisualAssetSelection(value: unknown): LegacyVisualAssetSelection | null {
  const selection = parseSelection(value);
  if (
    !selection ||
    !isPlainObject(value) ||
    (value.kind !== 'portrait' && value.kind !== 'sheet')
  ) {
    return null;
  }
  return { ...selection, kind: value.kind };
}

export function legacySelectionKey(selection: LegacyVisualAssetSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

export function selectionKey(selection: CharacterVisualAssetSelection): string {
  return `${selection.taskId}:${selection.fileName}`;
}

export function parseLegacyActionRecord(value: unknown): LegacyActionRecord | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    !isVisualSize(value.size) ||
    !isVisualResolution(value.resolution) ||
    typeof value.count !== 'number' ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 4
  ) {
    return null;
  }
  const rawStatus = value.status;
  if (!isTaskStatus(rawStatus)) {
    return null;
  }
  const status = rawStatus;

  const images = Array.isArray(value.images)
    ? value.images
        .map(image => parseImage(image, LEGACY_ACTION_ASSET_DIRECTORY, '角色视觉'))
        .filter((image): image is CharacterVisualImage => Boolean(image))
    : [];

  return {
    count: value.count,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : '角色视觉',
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referenceAsset: parseLegacyVisualAssetSelection(value.referenceAsset),
    resolution: value.resolution,
    size: value.size,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

export function parseLegacyReferenceBoardRecord(value: unknown): LegacyReferenceBoardRecord | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    !isVisualSize(value.size) ||
    !isVisualResolution(value.resolution)
  ) {
    return null;
  }
  const rawStatus = value.status;
  if (!isTaskStatus(rawStatus)) {
    return null;
  }
  const status = rawStatus;

  const images = Array.isArray(value.images)
    ? value.images
        .map(image => parseImage(image, LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY, '角色参考板'))
        .filter((image): image is CharacterVisualImage => Boolean(image))
    : [];
  const parsedReferenceAssets = Array.isArray(value.referenceAssets)
    ? value.referenceAssets
        .map(parseLegacyVisualAssetSelection)
        .filter((asset): asset is LegacyVisualAssetSelection => Boolean(asset))
    : [];
  const referenceAssets = [
    ...new Map(parsedReferenceAssets.map(asset => [legacySelectionKey(asset), asset])).values(),
  ].slice(0, MAX_CHARACTER_REFERENCE_IMAGES);
  const legacyReferenceImage = parseSelection(value.referenceImage);

  return {
    count: 1,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_NAME_LENGTH)
        : '角色参考板',
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referenceAssets,
    referenceImage:
      legacyReferenceImage ??
      (referenceAssets[0]
        ? { fileName: referenceAssets[0].fileName, taskId: referenceAssets[0].taskId }
        : null),
    resolution: value.resolution,
    size: value.size,
    source: value.source === 'uploaded' ? 'uploaded' : 'generated',
    status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}
