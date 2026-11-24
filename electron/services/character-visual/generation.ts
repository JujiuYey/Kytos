// 角色视觉的生成操作：动作、参考板、聊天模型提示词、任务轮询
import { generateText } from 'ai';
import { isPlainObject } from 'es-toolkit';
import type {
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  GenerateCharacterActionPromptRequest,
  GenerateCharacterActionRequest,
  GenerateCharacterReferenceBoardRequest,
} from '../../../shared/character-visual';
import {
  CHARACTER_REFERENCE_BOARD_SIZE,
  MAX_CHARACTER_ACTION_LENGTH,
  MAX_CHARACTER_REFERENCE_BOARD_FEEDBACK_LENGTH,
  MAX_CHARACTER_REFERENCE_IMAGES,
} from '../../../shared/character-visual';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import { getCredentialValue } from '../credentials';
import { getImageModel } from '../workspace';
import {
  LEGACY_ACTION_ASSET_DIRECTORY,
  LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY,
  MAX_NAME_LENGTH,
} from './constants';
import { ID_PATTERN, MAX_PROMPT_LENGTH } from '../../constants';
import { isTaskStatus, pollImageTask, prepareImageRequestBody, submitImageTask } from '../../utils';
import type { ImageResolution } from '../../utils';
import {
  isCharacterAnchorRole,
  isVisualResolution,
  isVisualSize,
  legacySelectionKey,
  selectionKey,
} from './parsers';
import {
  findVisualAsset,
  loadVisualStore,
  replaceRecord,
  replaceSheetRecord,
  saveVisualStore,
  toVisualAssetRecord,
  validateVisualAssetSelection,
} from './store';
import { buildCharacterActionPrompt, resolveChatModel } from './prompts';
import { buildCharacterActionInstructions } from './instructions';
import { downloadTaskImages, readVisualReferenceImage } from './assets';
import type { LegacyActionRecord, LegacyReferenceBoardRecord } from './types';

function validateGenerateRequest(
  request: GenerateCharacterActionRequest,
): CharacterVisualAssetSelection {
  if (!isPlainObject(request)) {
    throw new Error('生成参数无效');
  }
  if (
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.action !== 'string' ||
    !request.action.trim() ||
    request.action.length > MAX_CHARACTER_ACTION_LENGTH
  ) {
    throw new Error('角色动作名称或描述无效');
  }
  if (!Number.isInteger(request.count) || request.count < 1 || request.count > 4) {
    throw new Error('候选张数必须在 1 到 4 之间');
  }
  if (!isVisualSize(request.size) || !isVisualResolution(request.resolution)) {
    throw new Error('图片规格无效');
  }
  return validateVisualAssetSelection(request.referenceAsset);
}

export async function generateCharacterAction(
  request: GenerateCharacterActionRequest,
): Promise<CharacterVisualAssetRecord> {
  const referenceAsset = validateGenerateRequest(request);
  const store = await loadVisualStore();
  const reference = findVisualAsset(store, referenceAsset);
  if (
    !store.officialAssets.some(
      asset => legacySelectionKey(asset) === legacySelectionKey(reference.selection),
    )
  ) {
    throw new Error('动作参考图必须是当前角色的正式视觉');
  }
  const { directoryName, image } = reference;
  const referenceDataUrl = await readVisualReferenceImage(directoryName, image);
  const apiKey = await getCredentialValue('apimart');
  const body = await prepareImageRequestBody(
    {
      imageUrls: [referenceDataUrl],
      model: getImageModel(),
      n: request.count,
      prompt: buildCharacterActionPrompt(request.action),
      resolution: request.resolution as ImageResolution,
      size: request.size,
    },
    apiKey,
  );
  const taskId = await submitImageTask(body, apiKey);

  const now = new Date().toISOString();
  const record: LegacyActionRecord = {
    count: request.count,
    name: request.name.trim(),
    prompt: request.action.trim(),
    referenceAsset: reference.selection,
    createdAt: now,
    errorMessage: null,
    id: taskId,
    images: [],
    originalName: null,
    progress: 0,
    source: 'generated',
    status: 'submitted',
    resolution: request.resolution,
    size: request.size,
    updatedAt: now,
  };
  await saveVisualStore(replaceRecord(store, record));
  return toVisualAssetRecord(record, 'action');
}

export async function getCharacterVisualAssetTask(
  taskId: string,
): Promise<CharacterVisualAssetRecord> {
  if (!ID_PATTERN.test(taskId)) {
    throw new Error('图片生成任务编号无效');
  }
  const store = await loadVisualStore();
  const actionRecord = store.records.find(record => record.id === taskId);
  const referenceBoardRecord = store.sheetRecords.find(record => record.id === taskId);
  const existingRecord = actionRecord ?? referenceBoardRecord;
  if (!existingRecord) {
    throw new Error('未找到图片生成任务');
  }
  if (existingRecord.status === 'completed' && existingRecord.images.length > 0) {
    return toVisualAssetRecord(existingRecord, actionRecord ? 'action' : 'reference-board');
  }

  const apiKey = await getCredentialValue('apimart');
  const taskData = await pollImageTask(taskId, apiKey);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }

  const images =
    taskData.status === 'completed'
      ? await downloadTaskImages(
          taskId,
          taskData,
          actionRecord ? LEGACY_ACTION_ASSET_DIRECTORY : LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY,
          existingRecord.name,
        )
      : existingRecord.images;
  const updatedRecord = {
    ...existingRecord,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '图片生成任务未完成'
        : null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existingRecord.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  const nextStore = actionRecord
    ? replaceRecord(store, updatedRecord as LegacyActionRecord)
    : replaceSheetRecord(store, updatedRecord as LegacyReferenceBoardRecord);
  if (taskData.status === 'completed' && referenceBoardRecord?.anchorRole && images[0]) {
    const selection = {
      fileName: images[0].fileName,
      kind: 'sheet' as const,
      taskId,
    };
    nextStore.officialAssets = [
      ...nextStore.officialAssets.filter(
        asset => legacySelectionKey(asset) !== legacySelectionKey(selection),
      ),
      selection,
    ];
    nextStore.anchorBindings = [
      ...nextStore.anchorBindings
        .filter(asset => selectionKey(asset) !== selectionKey(selection))
        .map(binding =>
          binding.role === referenceBoardRecord.anchorRole
            ? { ...binding, role: 'unassigned' as const }
            : binding,
        ),
      { fileName: selection.fileName, role: referenceBoardRecord.anchorRole, taskId },
    ];
  }
  await saveVisualStore(nextStore);
  return toVisualAssetRecord(updatedRecord, actionRecord ? 'action' : 'reference-board');
}

export async function generateCharacterReferenceBoard(
  request: GenerateCharacterReferenceBoardRequest,
): Promise<CharacterVisualAssetRecord> {
  if (!isPlainObject(request)) {
    throw new Error('参考图生成参数无效');
  }
  const anchorRole: unknown = request.anchorRole;
  const { feedback } = request;
  if (
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH ||
    (feedback !== undefined &&
      (!isPlainObject(feedback) ||
        typeof feedback.text !== 'string' ||
        !feedback.text.trim() ||
        feedback.text.length > MAX_CHARACTER_REFERENCE_BOARD_FEEDBACK_LENGTH ||
        anchorRole !== undefined)) ||
    !Array.isArray(request.referenceAssets) ||
    (request.referenceAssets.length < 1 && !feedback) ||
    !isVisualResolution(request.resolution) ||
    (request.size !== undefined && !isVisualSize(request.size)) ||
    (anchorRole !== undefined &&
      (!isCharacterAnchorRole(anchorRole) ||
        anchorRole === 'unassigned' ||
        anchorRole === 'standard'))
  ) {
    throw new Error('参考图生成参数无效');
  }
  const store = await loadVisualStore();
  const revision = feedback
    ? findVisualAsset(store, validateVisualAssetSelection(feedback.source))
    : null;
  if (
    revision &&
    (revision.selection.kind !== 'sheet' ||
      revision.record.source !== 'generated' ||
      revision.record.status !== 'completed')
  ) {
    throw new Error('请选择已生成的角色锚点图片');
  }
  const parsedReferenceAssets = request.referenceAssets.map(validateVisualAssetSelection);
  const publicReferenceAssets = [
    ...new Map(parsedReferenceAssets.map(asset => [selectionKey(asset), asset])).values(),
  ];
  const revisionKey = revision ? selectionKey(revision.selection) : null;
  const referenceAssets = revision
    ? publicReferenceAssets
        .filter(asset => selectionKey(asset) !== revisionKey)
        .slice(0, MAX_CHARACTER_REFERENCE_IMAGES - 1)
    : publicReferenceAssets;
  const references = referenceAssets.map(referenceAsset => findVisualAsset(store, referenceAsset));
  if (
    references.some(
      reference =>
        !store.officialAssets.some(
          asset => legacySelectionKey(asset) === legacySelectionKey(reference.selection),
        ),
    )
  ) {
    throw new Error('画布连接的参考图包含非正式资产');
  }

  const referenceImageUrls = await Promise.all(
    (revision ? [revision, ...references] : references).map(({ directoryName, image }) =>
      readVisualReferenceImage(directoryName, image),
    ),
  );
  const apiKey = await getCredentialValue('apimart');
  const adjustment = feedback
    ? `\n\n以第一张图片为上一版，按以下意见重新生成，并保留未要求修改的角色特征：\n${feedback.text.trim()}`
    : '';
  const prompt = request.prompt.trim().slice(0, MAX_PROMPT_LENGTH - adjustment.length) + adjustment;
  const body = await prepareImageRequestBody(
    {
      imageUrls: referenceImageUrls,
      model: getImageModel(),
      n: 1,
      prompt,
      resolution: request.resolution as ImageResolution,
      size: request.size ?? CHARACTER_REFERENCE_BOARD_SIZE,
    },
    apiKey,
  );
  const taskId = await submitImageTask(body, apiKey);

  const now = new Date().toISOString();
  const record: LegacyReferenceBoardRecord = {
    ...(anchorRole ? { anchorRole } : {}),
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: taskId,
    images: [],
    name: request.name.trim(),
    originalName: null,
    progress: 0,
    prompt,
    referenceAssets: references.map(reference => reference.selection),
    referenceImage: referenceAssets[0] ?? null,
    resolution: request.resolution,
    size: request.size ?? CHARACTER_REFERENCE_BOARD_SIZE,
    source: 'generated',
    status: 'submitted',
    updatedAt: now,
  };
  await saveVisualStore(replaceSheetRecord(store, record));
  return toVisualAssetRecord(record, 'reference-board');
}

export async function generateCharacterActionPrompt(
  request: GenerateCharacterActionPromptRequest,
): Promise<string> {
  if (
    !isPlainObject(request) ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error('请先填写有效的动作名称');
  }
  const model = resolveChatModel(request.model);
  // 聊天模型现统一走 DeepSeek
  const apiKey = await getCredentialValue('deepseek');
  const providerOptions = getChatProviderOptions(model);
  const { text } = await generateText({
    maxOutputTokens: 600,
    model: createChatLanguageModel(apiKey, model),
    prompt: `动作名称：${request.name.trim()}`,
    ...(providerOptions ? { providerOptions } : {}),
    system: buildCharacterActionInstructions(),
  });
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('聊天模型未返回动作提示词');
  }
  return prompt.slice(0, MAX_CHARACTER_ACTION_LENGTH);
}
