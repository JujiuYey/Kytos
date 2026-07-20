import { createAgentUIStreamResponse } from 'ai';
import { DEFAULT_DEEPSEEK_MODEL } from '../../shared/character';
import { loadCharacterDraft } from '../services/character-workspace';
import { getCredentialValue } from '../services/credentials';
import { getIllustrationTopic } from '../services/illustration';
import { createIllustrationAgent } from './agent';

interface IllustrationAgentRequestBody {
  messages: unknown[];
  model?: string;
  topicId: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

function resolveModel(model: string | undefined): string {
  if (!model || model === 'deepseek-chat' || model === 'deepseek-reasoner') {
    return DEFAULT_DEEPSEEK_MODEL;
  }
  return model;
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function parseRequestBody(value: unknown): IllustrationAgentRequestBody {
  if (!value || typeof value !== 'object' || !('messages' in value) || !('topicId' in value)) {
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
  const model = 'model' in value && typeof value.model === 'string' ? value.model.trim() : '';
  if (model.length > 200 || (model && !/^[a-zA-Z0-9._-]+$/.test(model))) {
    throw new Error('模型标识无效');
  }
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
    const [apiKey, characterDraft, topic] = await Promise.all([
      getCredentialValue('deepseek'),
      loadCharacterDraft(),
      getIllustrationTopic(body.topicId),
    ]);
    const agent = createIllustrationAgent({
      apiKey,
      characterDraft,
      model: resolveModel(body.model),
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
