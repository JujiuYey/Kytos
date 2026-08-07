import { createAgentUIStreamResponse } from 'ai';
import {
  DEFAULT_CHAT_MODEL,
  getChatModelDefinition,
  isChatModel,
} from '../../../shared/chat-model';
import type { ChatModel } from '../../../shared/chat-model';
import {
  MAX_ILLUSTRATION_REFERENCE_IMAGES,
  type IllustrationReference,
} from '../../../shared/illustration';
import { getCredentialValue } from '../../services/credentials';
import {
  getIllustrationTopic,
  illustrationReferenceKey,
  parseIllustrationReferences,
  resolveTopicIllustrationReferences,
} from '../../services/illustration';
import { createIllustrationAgent } from './agent';
import { isPlainObject } from 'es-toolkit';

interface IllustrationAgentRequestBody {
  messages: unknown[];
  model?: ChatModel;
  references: IllustrationReference[];
  topicId: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function parseRequestBody(value: unknown): IllustrationAgentRequestBody {
  if (!isPlainObject(value) || !('messages' in value) || !('topicId' in value)) {
    throw new Error('插画对话请求无效');
  }
  const messages = value.messages;
  const topicId = value.topicId;
  if (!Array.isArray(messages) || messages.length > 200) {
    throw new Error('插画对话消息无效');
  }
  if (typeof topicId !== 'string' || !ID_PATTERN.test(topicId)) {
    throw new Error('插画主题编号无效');
  }
  const normalizedModel =
    'model' in value && typeof value.model === 'string' ? value.model.trim() : '';
  if (normalizedModel && !isChatModel(normalizedModel)) {
    throw new Error('模型标识无效');
  }
  const model = isChatModel(normalizedModel) ? normalizedModel : undefined;
  const rawReferences = 'references' in value ? value.references : [];
  const references = parseIllustrationReferences(rawReferences);
  if (!Array.isArray(rawReferences) || references.length !== rawReferences.length) {
    throw new Error('插画参考图无效');
  }
  return { messages, model: model || undefined, references, topicId };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : '插画 Agent 请求失败';
  return new Response(message, {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function attachTopicReferences(
  messages: unknown[],
  references: Awaited<ReturnType<typeof resolveTopicIllustrationReferences>>,
): unknown[] {
  const nextMessages = messages.map(message => {
    if (!isPlainObject(message) || !Array.isArray(message.parts)) return message;
    return {
      ...message,
      parts: message.parts.filter(part => !isPlainObject(part) || part.type !== 'file'),
    };
  });
  if (!references.length) return nextMessages;
  const lastUserMessage = [...nextMessages]
    .reverse()
    .find(
      message => isPlainObject(message) && message.role === 'user' && Array.isArray(message.parts),
    );
  if (!isPlainObject(lastUserMessage) || !Array.isArray(lastUserMessage.parts)) {
    return nextMessages;
  }
  lastUserMessage.parts = [
    ...lastUserMessage.parts,
    ...references.map((reference, index) => ({
      filename: `topic-reference-${index + 1}-${reference.fileName}`,
      mediaType: reference.mimeType,
      type: 'file',
      url: reference.dataUrl,
    })),
  ];
  return nextMessages;
}

export async function handleIllustrationAgentRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 2_000_000) {
      throw new Error('插画对话请求过大');
    }
    const body = parseRequestBody(await request.json());
    const model = body.model ?? DEFAULT_CHAT_MODEL;
    const modelDefinition = getChatModelDefinition(model);
    const [apiKey, topic] = await Promise.all([
      getCredentialValue(modelDefinition.provider),
      getIllustrationTopic(body.topicId),
    ]);
    const references = [
      ...new Map(
        [...topic.references, ...body.references].map(reference => [
          illustrationReferenceKey(reference),
          reference,
        ]),
      ).values(),
    ].slice(0, MAX_ILLUSTRATION_REFERENCE_IMAGES);
    if (references.length && !modelDefinition.supportsImageInput) {
      throw new Error('当前聊天模型不支持图片输入，请在模型设置中选择支持图片的模型');
    }
    const effectiveTopic = { ...topic, references };
    const resolvedReferences = await resolveTopicIllustrationReferences(effectiveTopic);
    const agent = createIllustrationAgent({
      apiKey,
      model,
      topic: effectiveTopic,
      referenceSummary: resolvedReferences
        .map((reference, index) => `参考图 ${index + 1}：${reference.purpose}`)
        .join('；'),
    });
    return await createAgentUIStreamResponse({
      agent,
      uiMessages: attachTopicReferences(body.messages, resolvedReferences),
      abortSignal: request.signal,
      headers: corsHeaders,
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
