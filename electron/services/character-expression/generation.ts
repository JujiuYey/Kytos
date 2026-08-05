// 角色表情的生成操作：生成表情 / 任务轮询 / 聊天模型提示词
import { generateText } from 'ai';
import { z } from 'zod';
import { getChatModelDefinition } from '../../../shared/chat-model';
import {
  CHARACTER_EXPRESSION_SIZES,
  MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES,
} from '../../../shared/character-expression';
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
  GenerateCharacterExpressionPromptRequest,
  GenerateCharacterExpressionRequest,
  GetCharacterExpressionTaskRequest,
} from '../../../shared/character-expression';
import { CHARACTER_VISUAL_RESOLUTIONS } from '../../../shared/character-visual';
import { MAX_NAME_LENGTH, MAX_PROMPT_LENGTH } from '../../constants';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import { getCredentialValue } from '../credentials';
import { getCharacterVisualReferences, getCharacterVisualWorkspace } from '../character-visual';
import { downloadTaskImages, getReferenceData } from './assets';
import { EXPRESSION_ASSET_DIRECTORY } from './constants';
import { parseReferenceSelection, selectionKey } from './parsers';
import { buildExpressionPrompt, resolveChatModel } from './prompts';
import { loadExpressionStore, replaceRecord, saveExpressionStore } from './store';
import {
  buildGptImage2RequestBody,
  idSchema,
  isTaskStatus,
  nameSchema,
  parseRequest,
  pollImageTask,
  submitImageTask,
} from '../../utils';
import type { GptImage2Resolution } from '../../utils';
import type { ExpressionReferenceData } from './types';
import type { StoredExpressionWorkspace } from './types';

const generateRequestSchema = z.object({
  characterId: z.string(),
  count: z.number().int().min(1).max(4),
  description: nameSchema(MAX_PROMPT_LENGTH),
  name: nameSchema(MAX_NAME_LENGTH),
  referenceAssets: z.array(z.unknown()).min(1).max(MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES),
  resolution: z.enum(CHARACTER_VISUAL_RESOLUTIONS),
  size: z.enum(CHARACTER_EXPRESSION_SIZES),
});

const getTaskRequestSchema = z.object({
  characterId: z.string(),
  taskId: idSchema,
});

const generatePromptRequestSchema = z.object({
  name: nameSchema(MAX_NAME_LENGTH),
});

export function getAvailableReferences(
  visualReferences: ReturnType<typeof getCharacterVisualReferences>,
  expressionStore: StoredExpressionWorkspace,
): ExpressionReferenceData[] {
  const characterVisualReferences = visualReferences.map(reference => ({
    ...reference,
    selection: { ...reference.selection, kind: 'visual' as const },
  }));
  const expressionReferences = expressionStore.records.flatMap(record =>
    record.status === 'completed'
      ? record.images.map(image => ({
          directoryName: EXPRESSION_ASSET_DIRECTORY,
          image,
          selection: {
            fileName: image.fileName,
            kind: 'expression' as const,
            taskId: record.id,
          },
        }))
      : [],
  );
  return [...characterVisualReferences, ...expressionReferences];
}

function validateGenerateRequest(
  request: GenerateCharacterExpressionRequest,
): CharacterExpressionReferenceSelection[] {
  const parsed = parseRequest(request, generateRequestSchema);
  const selections = parsed.referenceAssets
    .map(parseReferenceSelection)
    .filter((selection): selection is CharacterExpressionReferenceSelection => Boolean(selection));
  if (selections.length !== parsed.referenceAssets.length) {
    throw new Error('选择的角色参考图无效');
  }
  if (new Set(selections.map(selectionKey)).size !== selections.length) {
    throw new Error('角色参考图不能重复选择');
  }
  return selections;
}

export async function generateCharacterExpression(
  request: GenerateCharacterExpressionRequest,
): Promise<CharacterExpressionRecord> {
  const requestedAssets = validateGenerateRequest(request);
  const [visualWorkspace, expressionStore] = await Promise.all([
    getCharacterVisualWorkspace(request.characterId),
    loadExpressionStore(request.characterId),
  ]);
  const availableReferences = getAvailableReferences(
    getCharacterVisualReferences(visualWorkspace),
    expressionStore,
  );
  const referencesByKey = new Map(
    availableReferences.map(reference => [selectionKey(reference.selection), reference]),
  );
  const references = requestedAssets.map(selection => {
    const reference = referencesByKey.get(selectionKey(selection));
    if (!reference) {
      throw new Error('选择的角色参考图已失效，请重新选择');
    }
    return reference;
  });

  const imageUrls = await Promise.all(
    references.map(reference =>
      getReferenceData(reference.selection, reference.directoryName, reference.image),
    ),
  );
  const apiKey = await getCredentialValue('apimart');
  const body = buildGptImage2RequestBody({
    imageUrls,
    n: request.count,
    prompt: buildExpressionPrompt(request),
    resolution: request.resolution as GptImage2Resolution,
    size: request.size,
  });
  const taskId = await submitImageTask(body, apiKey);

  const now = new Date().toISOString();
  const prompt = buildExpressionPrompt(request);
  const record: CharacterExpressionRecord = {
    count: request.count,
    createdAt: now,
    description: request.description.trim(),
    errorMessage: null,
    id: taskId,
    images: [],
    name: request.name.trim(),
    originalName: null,
    progress: 0,
    prompt,
    referenceAssets: requestedAssets.map(asset => ({ ...asset })),
    resolution: request.resolution,
    size: request.size,
    source: 'generated',
    status: 'submitted',
    updatedAt: now,
  };
  const latestStore = await loadExpressionStore(request.characterId);
  await saveExpressionStore(request.characterId, replaceRecord(latestStore, record));
  return record;
}

export async function getCharacterExpressionTask(
  request: GetCharacterExpressionTaskRequest,
): Promise<CharacterExpressionRecord> {
  const { characterId, taskId } = parseRequest(request, getTaskRequestSchema);
  const store = await loadExpressionStore(characterId);
  const existingRecord = store.records.find(record => record.id === taskId);
  if (!existingRecord) {
    throw new Error('未找到表情生成任务');
  }
  if (existingRecord.status === 'completed' && existingRecord.images.length > 0) {
    return existingRecord;
  }

  const apiKey = await getCredentialValue('apimart');
  const taskData = await pollImageTask(taskId, apiKey);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }
  const images =
    taskData.status === 'completed'
      ? await downloadTaskImages(taskId, taskData)
      : existingRecord.images;
  const updatedRecord: CharacterExpressionRecord = {
    ...existingRecord,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '表情生成任务未完成'
        : null,
    images,
    progress:
      taskData.status === 'completed'
        ? 100
        : Math.min(100, Math.max(0, taskData.progress ?? existingRecord.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await saveExpressionStore(characterId, replaceRecord(store, updatedRecord));
  return updatedRecord;
}

// 生成表情提示词
export async function generateCharacterExpressionPrompt(
  request: GenerateCharacterExpressionPromptRequest,
): Promise<string> {
  const { name } = parseRequest(request, generatePromptRequestSchema);
  const model = resolveChatModel(request.model);
  const apiKey = await getCredentialValue(getChatModelDefinition(model).provider);
  const providerOptions = getChatProviderOptions(model);
  const { text } = await generateText({
    maxOutputTokens: 600,
    model: createChatLanguageModel(apiKey, model),
    prompt: `表情名称：${name.trim()}`,
    ...(providerOptions ? { providerOptions } : {}),
    system: `你负责为角色表情图生图编写中文提示词。根据用户给出的表情名称，输出一段可直接编辑和用于生图的表情描述。

要求：
1. 具体描述眉毛、眼睛、视线、嘴部、面部肌肉、情绪强度以及自然的头部或上半身姿态。
2. 不重新设计角色外形、服装和画风，这些由参考图决定。
3. 不写尺寸、分辨率、模型名称、解释、标题、Markdown 或引号。
4. 控制在 80 至 180 个中文字符，只输出提示词正文。`,
  });
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('聊天模型未返回表情提示词');
  }
  return prompt.slice(0, MAX_PROMPT_LENGTH);
}
