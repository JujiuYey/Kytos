import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { ChatModel } from '../../../shared/chat-model';
import type { IllustrationBrief, IllustrationTopic } from '../../../shared/illustration';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import { updateIllustrationBrief } from '../../services/illustration';
import { buildIllustrationInstructions } from './instructions';

const briefFields = {
  action: z.string().max(20_000).optional(),
  composition: z.string().max(20_000).optional(),
  details: z.string().max(20_000).optional(),
  environment: z.string().max(20_000).optional(),
  finalPrompt: z.string().max(20_000).optional(),
  mood: z.string().max(20_000).optional(),
  style: z.string().max(20_000).optional(),
  subject: z.string().max(20_000).optional(),
  title: z.string().max(100).optional(),
};

const briefPatchSchema = z
  .object(briefFields)
  .refine(value => Object.keys(value).length > 0, '至少更新一个画面字段');

const illustrationPlanSchema = z.object({
  action: z.string().max(20_000),
  composition: z.string().max(20_000),
  details: z.string().max(20_000),
  environment: z.string().max(20_000),
  finalPrompt: z.string().min(20).max(20_000),
  mood: z.string().max(20_000),
  style: z.string().max(20_000),
  subject: z.string().min(1).max(20_000),
  title: z.string().min(1).max(100),
});

export function createIllustrationAgent(options: {
  apiKey: string;
  model: ChatModel;
  topic: IllustrationTopic;
  referenceSummary: string;
  revisionContext: {
    label: string;
    prompt: string;
  } | null;
}) {
  let currentBrief = options.topic.brief;
  const providerOptions = getChatProviderOptions(options.model);

  async function saveBrief(patch: Partial<IllustrationBrief> & { title?: string }, ready: boolean) {
    const result = await updateIllustrationBrief(options.topic.id, patch, ready);
    currentBrief = result.brief;
    return result;
  }

  return new ToolLoopAgent({
    model: createChatLanguageModel(options.apiKey, options.model),
    ...(providerOptions ? { providerOptions } : {}),
    instructions: buildIllustrationInstructions({
      brief: currentBrief,
      hasCharacterReferences: options.topic.references.some(reference =>
        reference.kind.startsWith('character-'),
      ),
      referenceSummary: options.referenceSummary,
      revisionContext: options.revisionContext,
    }),
    stopWhen: isStepCount(4),
    tools: {
      updateIllustrationBrief: tool({
        description: '保存用户已经提供或明确确认的画面信息。',
        inputSchema: briefPatchSchema,
        execute: async patch => saveBrief(patch, false),
      }),
      presentIllustrationPlan: tool({
        description: '信息足够时，保存并展示可供用户确认和生图的完整画面方案。',
        inputSchema: illustrationPlanSchema,
        execute: async plan => saveBrief(plan, true),
      }),
    },
  });
}
