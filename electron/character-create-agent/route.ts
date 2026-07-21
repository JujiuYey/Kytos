import { createAgentUIStreamResponse } from 'ai';
import { DEFAULT_DEEPSEEK_MODEL, isDeepSeekModel } from '../../shared/character';
import type { DeepSeekModel } from '../../shared/character';
import type { CharacterCreateDraft } from '../../shared/character-create';
import { getCredentialValue } from '../services/credentials';
import { createCharacterCreateAgent } from './agent';

interface CharacterCreateAgentRequestBody {
  draft: CharacterCreateDraft;
  hasReferenceImage: boolean;
  messages: unknown[];
  model?: DeepSeekModel;
  stylePrompt?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function parseBody(value: unknown): CharacterCreateAgentRequestBody {
  if (!value || typeof value !== 'object') throw new Error('角色访谈请求无效');
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length > 100) {
    throw new Error('角色访谈消息无效');
  }
  if (!body.draft || typeof body.draft !== 'object') throw new Error('角色草稿无效');
  const normalizedModel = typeof body.model === 'string' ? body.model.trim() : '';
  if (normalizedModel && !isDeepSeekModel(normalizedModel)) {
    throw new Error('模型标识无效');
  }
  const model = isDeepSeekModel(normalizedModel) ? normalizedModel : undefined;
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
    const agent = createCharacterCreateAgent({
      apiKey: await getCredentialValue('deepseek'),
      draft: body.draft,
      hasReferenceImage: body.hasReferenceImage,
      model: body.model || DEFAULT_DEEPSEEK_MODEL,
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
