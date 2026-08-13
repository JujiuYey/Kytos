// illustration 模块的字段解析、类型守卫、URL 与选取 key
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import {
  ILLUSTRATION_SIZES,
  MAX_ILLUSTRATION_REFERENCE_IMAGES,
  createEmptyIllustrationBrief,
} from '../../../shared/illustration';
import type {
  IllustrationAgentMessage,
  IllustrationBrief,
  IllustrationReference,
  IllustrationRevisionReference,
  IllustrationReferencePurpose,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
  UploadedIllustration,
} from '../../../shared/illustration';
import type {
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualResolution,
} from '../../../shared/character-visual';
import { CHARACTER_VISUAL_RESOLUTIONS } from '../../../shared/character-visual';
import {
  ID_PATTERN,
  MAX_STORED_PROMPT_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
} from '../../constants';
import { isTaskStatus } from '../../utils';
import { BRIEF_FIELDS } from './constants';

export function isSize(value: unknown): value is IllustrationSize {
  return ILLUSTRATION_SIZES.includes(value as IllustrationSize);
}

export function isResolution(value: unknown): value is CharacterVisualResolution {
  return CHARACTER_VISUAL_RESOLUTIONS.includes(value as CharacterVisualResolution);
}

export function getAssetUrl(fileName: string): string {
  return `app://bundle/workspace-assets/illustrations/${encodeURIComponent(fileName)}`;
}

export function parseBrief(value: unknown): IllustrationBrief {
  const brief = createEmptyIllustrationBrief();
  if (!isPlainObject(value)) {
    return brief;
  }
  for (const field of BRIEF_FIELDS) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string') {
      brief[field] = fieldValue.slice(0, MAX_TEXT_LENGTH);
    }
  }
  return brief;
}

export function parseMessages(value: unknown): IllustrationAgentMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      message =>
        isPlainObject(message) &&
        typeof message.id === 'string' &&
        ['assistant', 'system', 'user'].includes(String(message.role)) &&
        Array.isArray(message.parts),
    )
    .slice(-200) as IllustrationAgentMessage[];
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

export function parseIllustrationReference(value: unknown): IllustrationReference | null {
  if (!isPlainObject(value)) {
    return null;
  }
  if (
    (value.kind === 'character-action' ||
      value.kind === 'character-anchor' ||
      value.kind === 'character-expression') &&
    typeof value.characterId === 'string' &&
    ID_PATTERN.test(value.characterId)
  ) {
    const selection = parseSelection(value);
    if (!selection) return null;
    return {
      ...selection,
      characterId: value.characterId,
      kind: value.kind,
      purpose: 'character',
    };
  }
  if (
    value.kind !== 'illustration' ||
    (value.source !== 'generated' && value.source !== 'uploaded')
  ) {
    return null;
  }
  const topicId =
    typeof value.topicId === 'string' && ID_PATTERN.test(value.topicId) ? value.topicId : null;
  const versionId =
    typeof value.versionId === 'string' && ID_PATTERN.test(value.versionId)
      ? value.versionId
      : null;
  const uploadId =
    typeof value.uploadId === 'string' && ID_PATTERN.test(value.uploadId) ? value.uploadId : null;
  if (
    (value.source === 'generated' && (!topicId || !versionId || uploadId)) ||
    (value.source === 'uploaded' && (!uploadId || topicId || versionId)) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName
  ) {
    return null;
  }
  const purpose =
    parseReferencePurpose(value.purpose) ?? (value.source === 'generated' ? 'style' : 'content');
  return {
    fileName: value.fileName,
    kind: 'illustration',
    purpose,
    source: value.source,
    topicId,
    uploadId,
    versionId,
  };
}

function parseReferencePurpose(value: unknown): IllustrationReferencePurpose | null {
  return value === 'style' || value === 'content' || value === 'character' ? value : null;
}

export function parseIllustrationReferences(value: unknown): IllustrationReference[] {
  if (!Array.isArray(value)) return [];
  const references = value
    .map(parseIllustrationReference)
    .filter((reference): reference is IllustrationReference => Boolean(reference));
  return [
    ...new Map(
      references.map(reference => [illustrationReferenceKey(reference), reference]),
    ).values(),
  ].slice(0, MAX_ILLUSTRATION_REFERENCE_IMAGES);
}

export function illustrationReferenceKey(reference: IllustrationReference): string {
  if (reference.kind === 'illustration') {
    return `illustration:${reference.source}:${reference.topicId ?? reference.uploadId}:${reference.versionId ?? reference.fileName}`;
  }
  return `${reference.kind}:${reference.characterId}:${reference.taskId}:${reference.fileName}`;
}

export function parseVersionReference(value: unknown): IllustrationVersionReference | null {
  if (
    !isPlainObject(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.versionId !== 'string' ||
    !ID_PATTERN.test(value.versionId)
  ) {
    return null;
  }
  return { fileName: value.fileName, versionId: value.versionId };
}

export function parseIllustrationRevisionReference(
  value: unknown,
): IllustrationRevisionReference | null {
  if (
    !isPlainObject(value) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName
  ) {
    return null;
  }
  if (
    value.source === 'generated' &&
    typeof value.versionId === 'string' &&
    ID_PATTERN.test(value.versionId)
  ) {
    return { fileName: value.fileName, source: 'generated', versionId: value.versionId };
  }
  if (
    value.source === 'uploaded' &&
    typeof value.uploadId === 'string' &&
    ID_PATTERN.test(value.uploadId)
  ) {
    return { fileName: value.fileName, source: 'uploaded', uploadId: value.uploadId };
  }
  return null;
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
    url: getAssetUrl(value.fileName),
  };
}

export function parseUpload(value: unknown): UploadedIllustration | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.fileName !== 'string' ||
    path.basename(value.fileName) !== value.fileName ||
    typeof value.originalName !== 'string' ||
    !value.originalName.trim() ||
    typeof value.mimeType !== 'string' ||
    !value.mimeType.startsWith('image/') ||
    typeof value.size !== 'number' ||
    !Number.isFinite(value.size) ||
    value.size <= 0
  ) {
    return null;
  }
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    fileName: value.fileName,
    id: value.id,
    mimeType: value.mimeType,
    originalName: value.originalName.trim(),
    size: value.size,
    url: getAssetUrl(value.fileName),
  };
}

export function parseVersion(value: unknown): IllustrationVersion | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.versionNumber !== 'number' ||
    !Number.isInteger(value.versionNumber) ||
    value.versionNumber < 1 ||
    typeof value.prompt !== 'string' ||
    value.prompt.length > MAX_STORED_PROMPT_LENGTH ||
    !isSize(value.size) ||
    !isResolution(value.resolution) ||
    !isTaskStatus(value.status)
  ) {
    return null;
  }
  return {
    baseVersion: parseVersionReference(value.baseVersion),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    id: value.id,
    images: Array.isArray(value.images)
      ? value.images
          .map(parseImage)
          .filter((image): image is CharacterVisualImage => Boolean(image))
      : [],
    progress: typeof value.progress === 'number' ? Math.min(100, Math.max(0, value.progress)) : 0,
    prompt: value.prompt,
    resolution: value.resolution,
    references: parseIllustrationReferences(value.references),
    size: value.size,
    status: value.status,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    versionNumber: value.versionNumber,
  };
}

export function parseTopic(value: unknown): IllustrationTopic | null {
  if (
    !isPlainObject(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > MAX_TITLE_LENGTH
  ) {
    return null;
  }
  const versions = Array.isArray(value.versions)
    ? (value.versions as unknown[])
        .map(parseVersion)
        .filter((version): version is IllustrationVersion => Boolean(version))
        .sort((left, right) => right.versionNumber - left.versionNumber)
    : [];
  return {
    brief: parseBrief(value.brief),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    id: value.id,
    messages: parseMessages(value.messages),
    ready: value.ready === true,
    references: parseIllustrationReferences(value.references),
    title: value.title.trim(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    versions,
  };
}
