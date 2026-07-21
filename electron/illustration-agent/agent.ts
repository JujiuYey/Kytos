import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { IllustrationBrief, IllustrationTopic } from '../../shared/illustration';
import { updateIllustrationBrief } from '../services/illustration';
import {
  createDeepSeekCompatibleProvider,
  DEEPSEEK_PROVIDER_OPTIONS,
} from '../services/deepseek-provider';
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
  model: string;
  topic: IllustrationTopic;
}) {
  const deepSeek = createDeepSeekCompatibleProvider(options.apiKey);
  let currentBrief = options.topic.brief;

  async function saveBrief(patch: Partial<IllustrationBrief> & { title?: string }, ready: boolean) {
    const result = await updateIllustrationBrief(options.topic.id, patch, ready);
    currentBrief = result.brief;
    return result;
  }

  return new ToolLoopAgent({
    model: deepSeek(options.model),
    providerOptions: DEEPSEEK_PROVIDER_OPTIONS,
    instructions: buildIllustrationInstructions({
      brief: currentBrief,
      useCharacter: options.topic.useCharacter,
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
