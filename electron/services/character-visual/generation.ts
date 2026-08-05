// 角色视觉的生成操作：动作、参考板、聊天模型提示词、任务轮询
import { generateText } from 'ai';
import { isPlainObject } from 'es-toolkit';
import { getChatModelDefinition } from '../../../shared/chat-model';
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
} from '../../../shared/character-visual';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import { getCredentialValue } from '../credentials';
import {
  LEGACY_ACTION_ASSET_DIRECTORY,
  LEGACY_REFERENCE_BOARD_ASSET_DIRECTORY,
  MAX_NAME_LENGTH,
} from './constants';
import { API_BASE_URL, ID_PATTERN, MAX_PROMPT_LENGTH } from '../../constants';
import { getSubmittedTaskId, parseTaskData, requestApi } from './api';
import {
  isTaskStatus,
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
import { downloadTaskImages, readOfficialReferenceImage } from './assets';
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
  const referenceDataUrl = await readOfficialReferenceImage(directoryName, image);
  const apiKey = await getCredentialValue('apimart');
  const body: Record<string, unknown> = {
    image_urls: [referenceDataUrl],
    model: 'gpt-image-2',
    n: request.count,
    prompt: buildCharacterActionPrompt(request.action),
    resolution: request.resolution,
    size: request.size,
  };
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const record: LegacyActionRecord = {
    count: request.count,
    name: request.name.trim(),
    prompt: request.action.trim(),
    referenceAsset: reference.selection,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
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
  const payload = await requestApi(
    `${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}?language=zh`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      method: 'GET',
    },
  );
  const taskData = parseTaskData(payload);
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
  await saveVisualStore(
    actionRecord
      ? replaceRecord(store, updatedRecord as LegacyActionRecord)
      : replaceSheetRecord(store, updatedRecord as LegacyReferenceBoardRecord),
  );
  return toVisualAssetRecord(updatedRecord, actionRecord ? 'action' : 'reference-board');
}

export async function generateCharacterReferenceBoard(
  request: GenerateCharacterReferenceBoardRequest,
): Promise<CharacterVisualAssetRecord> {
  if (
    !isPlainObject(request) ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > MAX_NAME_LENGTH ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_PROMPT_LENGTH ||
    !Array.isArray(request.referenceAssets) ||
    request.referenceAssets.length < 1 ||
    !isVisualResolution(request.resolution)
  ) {
    throw new Error('参考图生成参数无效');
  }

  const store = await loadVisualStore();
  const parsedReferenceAssets = request.referenceAssets.map(validateVisualAssetSelection);
  const publicReferenceAssets = [
    ...new Map(parsedReferenceAssets.map(asset => [selectionKey(asset), asset])).values(),
  ];
  const references = publicReferenceAssets.map(referenceAsset =>
    findVisualAsset(store, referenceAsset),
  );
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
    references.map(({ directoryName, image }) => readOfficialReferenceImage(directoryName, image)),
  );
  const apiKey = await getCredentialValue('apimart');
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify({
      image_urls: referenceImageUrls,
      model: 'gpt-image-2',
      n: 1,
      prompt: request.prompt.trim(),
      resolution: request.resolution,
      size: CHARACTER_REFERENCE_BOARD_SIZE,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const now = new Date().toISOString();
  const record: LegacyReferenceBoardRecord = {
    count: 1,
    createdAt: now,
    errorMessage: null,
    id: getSubmittedTaskId(payload),
    images: [],
    name: request.name.trim(),
    originalName: null,
    progress: 0,
    prompt: request.prompt.trim(),
    referenceAssets: references.map(reference => reference.selection),
    referenceImage: publicReferenceAssets[0]
      ? {
          fileName: publicReferenceAssets[0].fileName,
          taskId: publicReferenceAssets[0].taskId,
        }
      : null,
    resolution: request.resolution,
    size: CHARACTER_REFERENCE_BOARD_SIZE,
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
  const apiKey = await getCredentialValue(getChatModelDefinition(model).provider);
  const providerOptions = getChatProviderOptions(model);
  const { text } = await generateText({
    maxOutputTokens: 600,
    model: createChatLanguageModel(apiKey, model),
    prompt: `动作名称：${request.name.trim()}`,
    ...(providerOptions ? { providerOptions } : {}),
    system: `你负责为角色动作图生图编写中文提示词。根据用户给出的动作名称，输出一段可直接编辑和用于生图的姿势描述。

要求：
1. 只描述身体朝向、重心、躯干角度、头部角度、手臂、手势、腿部和脚步的位置关系，让姿势清晰且符合人体结构。
2. 不描述或改变角色的外貌、面部表情、视线、发型、身材、服装、配色、配饰和绘画风格，这些全部由参考图决定。
3. 不添加道具、场景、其他人物、文字、尺寸、分辨率或模型名称。
4. 不写解释、标题、Markdown 或引号，控制在 80 至 180 个中文字符，只输出提示词正文。`,
  });
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('聊天模型未返回动作提示词');
  }
  return prompt.slice(0, MAX_CHARACTER_ACTION_LENGTH);
}
