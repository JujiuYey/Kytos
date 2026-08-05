import { createAgentUIStreamResponse } from 'ai';
import { DEFAULT_CHAT_MODEL, getChatModelDefinition, isChatModel } from '../../../shared/chat-model';
import type { ChatModel } from '../../../shared/chat-model';
import type { CharacterCreateDraft } from '../../../shared/character-create';
import { getCredentialValue } from '../../services/credentials';
import { createCharacterCreateAgent } from './agent';
import { isPlainObject } from 'es-toolkit';

// 角色创建 Agent 请求体
interface CharacterCreateAgentRequestBody {
  // 当前角色草稿
  draft: CharacterCreateDraft;
  // 是否携带参考图
  hasReferenceImage: boolean;
  // 会话消息列表
  messages: unknown[];
  // 使用的模型
  model?: ChatModel;
  // 风格提示词
  stylePrompt?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function parseBody(value: unknown): CharacterCreateAgentRequestBody {
  if (!isPlainObject(value)) throw new Error('角色访谈请求无效');
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length > 100) {
    throw new Error('角色访谈消息无效');
  }
  if (!isPlainObject(body.draft)) throw new Error('角色草稿无效');
  const normalizedModel = typeof body.model === 'string' ? body.model.trim() : '';
  if (normalizedModel && !isChatModel(normalizedModel)) {
    throw new Error('模型标识无效');
  }
  const model = isChatModel(normalizedModel) ? normalizedModel : undefined;
  return {
    draft: body.draft as CharacterCreateDraft,
    hasReferenceImage: body.hasReferenceImage === true,
    messages: body.messages,
    model,
    stylePrompt: typeof body.stylePrompt === 'string' ? body.stylePrompt.slice(0, 20_000) : '',
  };
}

export async function handleCharacterCreateAgentRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST')
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    const body = parseBody(await request.json());
    const model = body.model ?? DEFAULT_CHAT_MODEL;
    const agent = createCharacterCreateAgent({
      apiKey: await getCredentialValue(getChatModelDefinition(model).provider),
      draft: body.draft,
      hasReferenceImage: body.hasReferenceImage,
      model,
      stylePrompt: body.stylePrompt || '',
    });
    return await createAgentUIStreamResponse({
      agent,
      abortSignal: request.signal,
      headers: corsHeaders,
      uiMessages: body.messages,
    });
  } catch (error: unknown) {
    return new Response(error instanceof Error ? error.message : '角色访谈失败', {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
