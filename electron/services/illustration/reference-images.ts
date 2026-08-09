import type {
  IllustrationReference,
  IllustrationRevisionReference,
  IllustrationTopic,
} from '../../../shared/illustration';
import { getCharacterExpressionWorkspace } from '../character-expression';
import { getCharacterLibrary } from '../character-library';
import {
  getCharacterVisualWorkspace,
  getOfficialCharacterVisualReferences,
} from '../character-visual';
import { loadStore } from './store';
import { readReferenceImage } from './assets';
import { ASSET_DIRECTORY, EXPRESSION_ASSET_DIRECTORY } from './constants';
import type { CharacterVisualImage } from '../../../shared/character-visual';
import type { StoredIllustrationWorkspace } from './types';

export interface ResolvedIllustrationReference {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  purpose: NonNullable<IllustrationReference['purpose']>;
  reference: IllustrationReference;
}

export interface ResolvedIllustrationRevisionReference {
  dataUrl: string;
  fileName: string;
  label: string;
  mimeType: string;
  prompt: string;
}

function referencePurpose(
  reference: IllustrationReference,
): NonNullable<IllustrationReference['purpose']> {
  if (reference.purpose) return reference.purpose;
  if (reference.kind !== 'illustration') return 'character';
  return reference.source === 'generated' ? 'style' : 'content';
}

async function resolveIllustrationReferences(
  store: StoredIllustrationWorkspace,
  references: IllustrationReference[],
): Promise<ResolvedIllustrationReference[]> {
  const characterIds = [
    ...new Set(
      references.flatMap(reference =>
        reference.kind === 'illustration' ? [] : [reference.characterId],
      ),
    ),
  ];
  const visualWorkspaces = new Map<
    string,
    Awaited<ReturnType<typeof getCharacterVisualWorkspace>>
  >();
  const expressionWorkspaces = new Map<
    string,
    Awaited<ReturnType<typeof getCharacterExpressionWorkspace>>
  >();
  if (characterIds.length) {
    const library = await getCharacterLibrary();
    if (!characterIds.every(id => library.characters.some(character => character.id === id))) {
      throw new Error('选择的角色已不存在');
    }
    const workspaces = await Promise.all(
      characterIds.map(async characterId => {
        const [visual, expression] = await Promise.all([
          getCharacterVisualWorkspace(characterId),
          getCharacterExpressionWorkspace({ characterId }),
        ]);
        return { characterId, expression, visual };
      }),
    );
    workspaces.forEach(({ characterId, expression, visual }) => {
      visualWorkspaces.set(characterId, visual);
      expressionWorkspaces.set(characterId, expression);
    });
  }

  const resolved: ResolvedIllustrationReference[] = [];
  for (const reference of references) {
    let image: CharacterVisualImage | undefined;
    let directory = ASSET_DIRECTORY;
    if (reference.kind === 'character-visual') {
      const workspace = visualWorkspaces.get(reference.characterId);
      const match =
        workspace &&
        getOfficialCharacterVisualReferences(workspace).find(
          item =>
            item.selection.taskId === reference.taskId &&
            item.selection.fileName === reference.fileName,
        );
      if (!match) throw new Error('选择的角色视觉已失效');
      directory = match.directoryName;
      image = match.image;
    } else if (reference.kind === 'character-expression') {
      const record = expressionWorkspaces
        .get(reference.characterId)
        ?.records.find(item => item.id === reference.taskId);
      image = record?.images.find(item => item.fileName === reference.fileName);
      directory = EXPRESSION_ASSET_DIRECTORY;
      if (!image) throw new Error('选择的角色表情已失效');
    } else if (reference.kind !== 'illustration') {
      throw new Error('选择的画面素材无效');
    } else if (reference.source === 'uploaded') {
      const upload = store.uploads.find(item => item.id === reference.uploadId);
      if (!upload || upload.fileName !== reference.fileName) throw new Error('选择的插画已失效');
      image = upload;
    } else {
      const sourceTopic = store.topics.find(item => item.id === reference.topicId);
      const sourceVersion = sourceTopic?.versions.find(item => item.id === reference.versionId);
      image = sourceVersion?.images.find(item => item.fileName === reference.fileName);
      if (!image || !sourceVersion || sourceVersion.status !== 'completed') {
        throw new Error('选择的创作插画已失效');
      }
    }
    resolved.push({
      dataUrl: await readReferenceImage(directory, image),
      fileName: image.fileName,
      mimeType: image.mimeType,
      purpose: referencePurpose(reference),
      reference,
    });
  }
  return resolved;
}

export async function resolveTopicIllustrationReferences(
  topic: IllustrationTopic,
): Promise<ResolvedIllustrationReference[]> {
  return resolveIllustrationReferences(await loadStore(), topic.references);
}

export async function resolveIllustrationRevisionReferenceForStore(
  store: StoredIllustrationWorkspace,
  topic: IllustrationTopic,
  reference: IllustrationRevisionReference,
): Promise<ResolvedIllustrationRevisionReference> {
  if (reference.source === 'uploaded') {
    const upload = store.uploads.find(
      item => item.id === reference.uploadId && item.fileName === reference.fileName,
    );
    if (!upload) {
      throw new Error('选择的上传插画已失效');
    }
    return {
      dataUrl: await readReferenceImage(ASSET_DIRECTORY, upload),
      fileName: upload.fileName,
      label: upload.originalName,
      mimeType: upload.mimeType,
      prompt: '',
    };
  }

  const version = topic.versions.find(item => item.id === reference.versionId);
  const image = version?.images.find(item => item.fileName === reference.fileName);
  if (!version || !image || version.status !== 'completed') {
    throw new Error('选择的旧插画版本已失效');
  }
  return {
    dataUrl: await readReferenceImage(ASSET_DIRECTORY, image),
    fileName: image.fileName,
    label: `V${version.versionNumber}`,
    mimeType: image.mimeType,
    prompt: version.prompt,
  };
}

export async function resolveIllustrationRevisionReference(
  topic: IllustrationTopic,
  reference: IllustrationRevisionReference,
): Promise<ResolvedIllustrationRevisionReference> {
  return resolveIllustrationRevisionReferenceForStore(await loadStore(), topic, reference);
}

export async function resolveIllustrationReferencesForStore(
  store: StoredIllustrationWorkspace,
  references: IllustrationReference[],
): Promise<ResolvedIllustrationReference[]> {
  return resolveIllustrationReferences(store, references);
}
