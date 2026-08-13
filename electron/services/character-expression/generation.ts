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
  CharacterExpressionTask,
  CharacterExpressionTaskResult,
  GenerateCharacterExpressionPromptRequest,
  GenerateCharacterExpressionRequest,
  GetCharacterExpressionTaskRequest,
} from '../../../shared/character-expression';
import { CHARACTER_VISUAL_RESOLUTIONS } from '../../../shared/character-visual';
import { MAX_NAME_LENGTH, MAX_PROMPT_LENGTH } from '../../constants';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import { getCredentialValue } from '../credentials';
import {
  getCharacterVisualWorkspace,
  getOfficialCharacterVisualReferences,
} from '../character-visual';
import { downloadTaskImages, getReferenceData } from './assets';
import { EXPRESSION_ASSET_DIRECTORY } from './constants';
import { parseReferenceSelection, selectionKey } from './parsers';
import { buildExpressionPrompt, resolveChatModel } from './prompts';
import { buildExpressionInstructions } from './instructions';
import {
  completeExpressionTask,
  deleteExpressionTask,
  findExpressionRecord,
  findExpressionTask,
  getExpressionWorkspace,
  saveExpressionTask,
} from './repository';
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

// 获取可用的参考图
export function getAvailableReferences(
  visualReferences: ReturnType<typeof getOfficialCharacterVisualReferences>,
  expressionRecords: CharacterExpressionRecord[],
): ExpressionReferenceData[] {
  const characterVisualReferences = visualReferences.map(reference => ({
    ...reference,
    selection: { ...reference.selection, kind: 'visual' as const },
  }));
  const expressionReferences = expressionRecords.flatMap(record =>
    record.images.map(image => ({
      directoryName: EXPRESSION_ASSET_DIRECTORY,
      image,
      selection: {
        fileName: image.fileName,
        kind: 'expression' as const,
        taskId: record.id,
      },
    })),
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

// 创建表情描述
export async function generateCharacterExpression(
  request: GenerateCharacterExpressionRequest,
): Promise<CharacterExpressionTask> {
  const requestedAssets = validateGenerateRequest(request);
  const [visualWorkspace, expressionWorkspace] = await Promise.all([
    getCharacterVisualWorkspace(request.characterId),
    getExpressionWorkspace(request.characterId),
  ]);
  const availableReferences = getAvailableReferences(
    getOfficialCharacterVisualReferences(visualWorkspace),
    expressionWorkspace.records,
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
  const task: CharacterExpressionTask = {
    count: request.count,
    createdAt: now,
    description: request.description.trim(),
    errorMessage: null,
    id: taskId,
    name: request.name.trim(),
    progress: 0,
    prompt,
    referenceAssets: requestedAssets.map(asset => ({ ...asset })),
    resolution: request.resolution,
    size: request.size,
    status: 'submitted',
    updatedAt: now,
  };
  await saveExpressionTask(request.characterId, task);
  return task;
}

// 表情生成任务
export async function getCharacterExpressionTask(
  request: GetCharacterExpressionTaskRequest,
): Promise<CharacterExpressionTaskResult> {
  const { characterId, taskId } = parseRequest(request, getTaskRequestSchema);
  const existingTask = await findExpressionTask(characterId, taskId);
  if (!existingTask) {
    const completedRecord = await findExpressionRecord(characterId, taskId);
    if (completedRecord) {
      return { record: completedRecord, task: null };
    }
    throw new Error('未找到表情生成任务');
  }

  const apiKey = await getCredentialValue('apimart');
  const taskData = await pollImageTask(taskId, apiKey);
  if (!isTaskStatus(taskData.status)) {
    throw new Error('图片生成服务返回了未知任务状态');
  }
  if (taskData.status === 'completed') {
    const completedRecord = await findExpressionRecord(characterId, taskId);
    if (completedRecord) {
      await deleteExpressionTask(characterId, taskId);
      return { record: completedRecord, task: null };
    }
    const images = await downloadTaskImages(taskId, taskData);
    const now = new Date().toISOString();
    const record: CharacterExpressionRecord = {
      ...existingTask,
      images,
      originalName: null,
      progress: 100,
      source: 'generated',
      status: 'completed',
      updatedAt: now,
    };
    await completeExpressionTask(characterId, record);
    return { record, task: null };
  }

  const updatedTask: CharacterExpressionTask = {
    ...existingTask,
    errorMessage:
      taskData.status === 'failed' || taskData.status === 'cancelled'
        ? taskData.error?.message || '表情生成任务未完成'
        : null,
    progress: Math.min(100, Math.max(0, taskData.progress ?? existingTask.progress)),
    status: taskData.status,
    updatedAt: new Date().toISOString(),
  };
  await saveExpressionTask(characterId, updatedTask);
  return { record: null, task: updatedTask };
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
    system: buildExpressionInstructions(),
  });
  const prompt = text.trim();
  if (!prompt) {
    throw new Error('聊天模型未返回表情提示词');
  }
  return prompt.slice(0, MAX_PROMPT_LENGTH);
}
