import { createAgentUIStreamResponse } from 'ai';
import { DEFAULT_DEEPSEEK_MODEL } from '../../shared/character';
import { loadCharacterDraft } from '../services/character-workspace';
import { getCredentialValue } from '../services/credentials';
import { getStory } from '../services/story';
import { createStoryAgent } from './agent';

interface StoryAgentRequestBody {
  messages: unknown[];
  model?: string;
  storyId: string;
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

function parseRequestBody(value: unknown): StoryAgentRequestBody {
  if (!value || typeof value !== 'object' || !('messages' in value) || !('storyId' in value)) {
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
  const model = 'model' in value && typeof value.model === 'string' ? value.model.trim() : '';
  if (model.length > 200 || (model && !/^[a-zA-Z0-9._-]+$/.test(model))) {
    throw new Error('模型标识无效');
  }
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
    const [apiKey, characterDraft, story] = await Promise.all([
      getCredentialValue('deepseek'),
      loadCharacterDraft(),
      getStory(body.storyId),
    ]);
    const agent = createStoryAgent({
      apiKey,
      characterDraft,
      model: resolveModel(body.model),
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
