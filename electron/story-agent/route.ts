import { createAgentUIStreamResponse } from 'ai';
import { DEFAULT_DEEPSEEK_MODEL, isDeepSeekModel } from '../../shared/character';
import type { DeepSeekModel } from '../../shared/character';
import { getCredentialValue } from '../services/credentials';
import { getStory } from '../services/story';
import { createStoryAgent } from './agent';
import { isPlainObject } from 'es-toolkit';

interface StoryAgentRequestBody {
  messages: unknown[];
  model?: DeepSeekModel;
  storyId: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function parseRequestBody(value: unknown): StoryAgentRequestBody {
  if (!isPlainObject(value) || !('messages' in value) || !('storyId' in value)) {
    throw new Error('故事对话请求无效');
  }
  const messages = value.messages;
  const storyId = value.storyId;
  if (!Array.isArray(messages) || messages.length > 200) {
    throw new Error('故事对话消息无效');
  }
  if (typeof storyId !== 'string' || !ID_PATTERN.test(storyId)) {
    throw new Error('故事编号无效');
  }
  const normalizedModel =
    'model' in value && typeof value.model === 'string' ? value.model.trim() : '';
  if (normalizedModel && !isDeepSeekModel(normalizedModel)) {
    throw new Error('模型标识无效');
  }
  const model = isDeepSeekModel(normalizedModel) ? normalizedModel : undefined;
  return { messages, model: model || undefined, storyId };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : '故事 Agent 请求失败';
  return new Response(message, {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function handleStoryAgentRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > 2_000_000) {
      throw new Error('故事对话请求过大');
    }
    const body = parseRequestBody(await request.json());
    const [apiKey, story] = await Promise.all([
      getCredentialValue('deepseek'),
      getStory(body.storyId),
    ]);
    const agent = createStoryAgent({
      apiKey,
      model: body.model ?? DEFAULT_DEEPSEEK_MODEL,
      story,
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
