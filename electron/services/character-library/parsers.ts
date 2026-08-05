// 角色库的 JSON 字段解析与类型守卫
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type {
  CharacterLibraryVisualAsset,
  CharacterSummary,
} from '../../../shared/character-library';
import type { CharacterVisualSize } from '../../../shared/character-visual';
import {
  CHARACTER_REFERENCE_BOARD_SIZE,
  CHARACTER_VISUAL_SIZES,
} from '../../../shared/character-visual';
import { ID_PATTERN, MAX_NAME_LENGTH } from '../../constants';
import { LEGACY_ACTION_ASSET_DIRECTORY, LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY } from './constants';
import type { StoredCharacterLibrary, VisualAssetCandidate } from './types';

export function isVisualSize(value: unknown): value is CharacterVisualSize {
  return CHARACTER_VISUAL_SIZES.includes(value as CharacterVisualSize);
}

export function isImageSize(value: unknown): value is CharacterVisualSize {
  return isVisualSize(value) || value === CHARACTER_REFERENCE_BOARD_SIZE;
}

export function parseCharacter(value: unknown): CharacterSummary | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > MAX_NAME_LENGTH
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    id: value.id,
    name: value.name.trim(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
  };
}

export function parseCharacters(value: unknown): CharacterSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(parseCharacter)
    .filter((character): character is CharacterSummary => Boolean(character));
}

export function parseStore(value: unknown): StoredCharacterLibrary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  let characters = parseCharacters(value.characters);
  if (!characters.length && Array.isArray(value.ips)) {
    characters = value.ips.flatMap(ip => (isPlainObject(ip) ? parseCharacters(ip.characters) : []));
  }
  if (!characters.length) {
    return null;
  }

  const activeCharacterId =
    typeof value.activeCharacterId === 'string' &&
    characters.some(character => character.id === value.activeCharacterId)
      ? value.activeCharacterId
      : characters[0].id;
  return { activeCharacterId, characters, version: 2 };
}

export function parseVisualAssetRecords(
  value: unknown,
  kind: 'portrait' | 'sheet',
  officialAssets: Set<string>,
): VisualAssetCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const directory =
    kind === 'portrait' ? LEGACY_ACTION_ASSET_DIRECTORY : LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY;
  const candidates: VisualAssetCandidate[] = [];
  for (const record of value) {
    if (!isPlainObject(record) || !isImageSize(record.size) || !Array.isArray(record.images)) {
      continue;
    }
    if (
      (kind === 'portrait' && !isVisualSize(record.size)) ||
      (kind === 'sheet' && record.size !== CHARACTER_REFERENCE_BOARD_SIZE)
    ) {
      continue;
    }
    const image = record.images.find(
      item =>
        isPlainObject(item) &&
        typeof item.fileName === 'string' &&
        path.basename(item.fileName) === item.fileName &&
        officialAssets.has(`${kind}:${record.id}:${item.fileName}`),
    );
    if (isPlainObject(image) && typeof image.fileName === 'string') {
      candidates.push({
        asset: {
          name:
            typeof image.name === 'string' && image.name.trim()
              ? image.name.trim()
              : kind === 'portrait'
                ? '角色视觉'
                : '角色参考板',
          size: record.size,
          url: `app://bundle/workspace-assets/${directory}/${encodeURIComponent(image.fileName)}`,
        },
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
      });
    }
  }
  return candidates;
}

export function parseCharacterVisualAsset(value: unknown): CharacterLibraryVisualAsset | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const officialAssets = new Set(
    Array.isArray(value.officialAssets)
      ? value.officialAssets.flatMap(asset =>
          isPlainObject(asset) &&
          (asset.kind === 'portrait' || asset.kind === 'sheet') &&
          typeof asset.taskId === 'string' &&
          typeof asset.fileName === 'string'
            ? [`${asset.kind}:${asset.taskId}:${asset.fileName}`]
            : [],
        )
      : [
          isPlainObject(value.selectedImage) &&
          typeof value.selectedImage.taskId === 'string' &&
          typeof value.selectedImage.fileName === 'string'
            ? `portrait:${value.selectedImage.taskId}:${value.selectedImage.fileName}`
            : '',
          isPlainObject(value.selectedSheet) &&
          typeof value.selectedSheet.taskId === 'string' &&
          typeof value.selectedSheet.fileName === 'string'
            ? `sheet:${value.selectedSheet.taskId}:${value.selectedSheet.fileName}`
            : '',
        ].filter(Boolean),
  );
  const candidates = [
    ...parseVisualAssetRecords(value.records, 'portrait', officialAssets),
    ...parseVisualAssetRecords(value.sheetRecords, 'sheet', officialAssets),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return candidates[0]?.asset ?? null;
}
