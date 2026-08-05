// character-expression 模块的字段解析与类型守卫
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import {
  CHARACTER_EXPRESSION_SIZES,
  MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES,
} from '../../../shared/character-expression';
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
  CharacterExpressionSize,
  CharacterExpressionTask,
} from '../../../shared/character-expression';
import { CHARACTER_VISUAL_RESOLUTIONS } from '../../../shared/character-visual';
import type {
  CharacterVisualImage,
  CharacterVisualResolution,
} from '../../../shared/character-visual';
import { ID_PATTERN, MAX_NAME_LENGTH, MAX_PROMPT_LENGTH } from '../../constants';
import { isTaskStatus } from '../../utils';
import { EXPRESSION_ASSET_DIRECTORY } from './constants';
import type { StoredExpressionWorkspace } from './types';

export function isExpressionSize(value: unknown): value is CharacterExpressionSize {
  return CHARACTER_EXPRESSION_SIZES.includes(value as CharacterExpressionSize);
}

export function isResolution(value: unknown): value is CharacterVisualResolution {
  return CHARACTER_VISUAL_RESOLUTIONS.includes(value as CharacterVisualResolution);
}

export function selectionKey(selection: CharacterExpressionReferenceSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

export function parseReferenceSelection(
  value: unknown,
): CharacterExpressionReferenceSelection | null {
  if (
    !isPlainObject(value) ||
    !['expression', 'visual', 'portrait', 'sheet'].includes(String(value.kind)) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.taskId !== 'string' ||
    !ID_PATTERN.test(value.taskId)
  ) {
    return null;
  }
  return {
    fileName: value.fileName,
    kind: value.kind === 'expression' ? 'expression' : 'visual',
    taskId: value.taskId,
  };
}

export function getExpressionAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/${EXPRESSION_ASSET_DIRECTORY}/${encodeURIComponent(fileName)}`;
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
    url: getExpressionAssetUrl(value.fileName),
  };
}

interface ParsedExpressionFields {
  count: number;
  createdAt: string;
  description: string;
  errorMessage: string | null;
  id: string;
  name: string;
  progress: number;
  prompt: string;
  referenceAssets: CharacterExpressionReferenceSelection[];
  resolution: CharacterVisualResolution;
  size: CharacterExpressionSize;
  updatedAt: string;
}

function parseExpressionFields(
  value: unknown,
  allowEmptyReferences: boolean,
): ParsedExpressionFields | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > MAX_NAME_LENGTH ||
    typeof value.description !== 'string' ||
    value.description.length > MAX_PROMPT_LENGTH ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_PROMPT_LENGTH ||
    !isExpressionSize(value.size) ||
    !isResolution(value.resolution) ||
    typeof value.count !== 'number' ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 4 ||
    !Array.isArray(value.referenceAssets)
  ) {
    return null;
  }

  const parsedReferenceAssets = value.referenceAssets.map(parseReferenceSelection);
  if (parsedReferenceAssets.some(asset => !asset)) {
    return null;
  }
  const referenceAssets = parsedReferenceAssets.filter(
    (asset): asset is CharacterExpressionReferenceSelection => Boolean(asset),
  );
  if (
    referenceAssets.length > MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES ||
    new Set(referenceAssets.map(selectionKey)).size !== referenceAssets.length ||
    (!allowEmptyReferences && referenceAssets.length < 1)
  ) {
    return null;
  }

  return {
    count: value.count,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    description: value.description,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    name: value.name.trim(),
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    referenceAssets,
    resolution: value.resolution,
    size: value.size,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

export function parseExpressionRecord(value: unknown): CharacterExpressionRecord | null {
  if (
    !isPlainObject(value) ||
    value.status !== 'completed' ||
    !['generated', 'uploaded'].includes(String(value.source))
  ) {
    return null;
  }
  const source = value.source === 'uploaded' ? 'uploaded' : 'generated';
  const fields = parseExpressionFields(value, source === 'uploaded');
  const images = Array.isArray(value.images)
    ? value.images.map(parseImage).filter((image): image is CharacterVisualImage => Boolean(image))
    : [];
  if (!fields || images.length < 1) {
    return null;
  }
  return {
    ...fields,
    images,
    originalName: typeof value.originalName === 'string' ? value.originalName : null,
    progress: 100,
    source,
    status: 'completed',
  };
}

export function parseExpressionTask(value: unknown): CharacterExpressionTask | null {
  if (!isPlainObject(value) || !isTaskStatus(value.status)) {
    return null;
  }
  const fields = parseExpressionFields(value, false);
  if (!fields) {
    return null;
  }
  return {
    ...fields,
    // 旧 store 可能在图片下载完成前已记录 completed，迁移后继续轮询即可恢复。
    status: value.status === 'completed' ? 'processing' : value.status,
  };
}

export type { StoredExpressionWorkspace };
