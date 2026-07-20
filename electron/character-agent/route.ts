import { APICallError, createAgentUIStreamResponse } from 'ai';
import { DEFAULT_DEEPSEEK_MODEL } from '../../shared/character';
import { loadCharacterDraft } from '../services/character-workspace';
import { getCredentialValue } from '../services/credentials';
import { createCharacterAgent } from './agent';

interface CharacterAgentRequestBody {
  messages: unknown[];
  model?: string;
}

const MAX_CHARACTER_CHAT_REQUEST_BYTES = 64 * 1024 * 1024;

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

function parseRequestBody(value: unknown): CharacterAgentRequestBody {
  if (!value || typeof value !== 'object' || !('messages' in value)) {
    throw new Error('对话请求无效');
  }

  const messages = value.messages;
  if (!Array.isArray(messages) || messages.length > 200) {
    throw new Error('对话消息无效');
  }

  const model = 'model' in value && typeof value.model === 'string' ? value.model.trim() : '';
  if (model.length > 200 || (model && !/^[a-zA-Z0-9._-]+$/.test(model))) {
    throw new Error('模型标识无效');
  }
  return { messages, model: model || undefined };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : '角色 Agent 请求失败';
  return new Response(message, {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function getStreamErrorMessage(error: unknown): string {
  const message = APICallError.isInstance(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : '';
  const status = APICallError.isInstance(error) && error.statusCode ? ` (${error.statusCode})` : '';
  if (!message || /authorization|api[_-]?key|bearer|data:image/i.test(message)) {
    return `DeepSeek 多模态请求失败${status}`;
  }
  return `DeepSeek 请求失败${status}：${message.slice(0, 300)}`;
}

export async function handleCharacterAgentRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_CHARACTER_CHAT_REQUEST_BYTES) {
      throw new Error('对话请求过大');
    }
    const body = parseRequestBody(await request.json());
    const [apiKey, draft] = await Promise.all([
      getCredentialValue('deepseek'),
      loadCharacterDraft(),
    ]);
    const agent = createCharacterAgent({
      apiKey,
      draft,
      model: resolveModel(body.model),
    });

    return await createAgentUIStreamResponse({
      agent,
      uiMessages: body.messages,
      abortSignal: request.signal,
      headers: corsHeaders,
      onError: getStreamErrorMessage,
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
