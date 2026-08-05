import { createAgentUIStreamResponse } from 'ai';
import { DEFAULT_CHAT_MODEL, getChatModelDefinition, isChatModel } from '../../shared/character';
import type { ChatModel } from '../../shared/character';
import { getCredentialValue } from '../services/credentials';
import { getIllustrationTopic } from '../services/illustration';
import { createIllustrationAgent } from './agent';
import { isPlainObject } from 'es-toolkit';

interface IllustrationAgentRequestBody {
  messages: unknown[];
  model?: ChatModel;
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
  return { messages, model: model || undefined, topicId };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : '插画 Agent 请求失败';
  return new Response(message, {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
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
    const [apiKey, topic] = await Promise.all([
      getCredentialValue(getChatModelDefinition(model).provider),
      getIllustrationTopic(body.topicId),
    ]);
    const agent = createIllustrationAgent({
      apiKey,
      model,
      topic,
    });
    return await createAgentUIStreamResponse({
      agent,
      uiMessages: body.messages,
      abortSignal: request.signal,
      headers: corsHeaders,
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
