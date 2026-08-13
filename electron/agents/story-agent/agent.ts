import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { ChatModel } from '../../../shared/chat-model';
import type { StoryDraft, StoryProject, StoryShotContent } from '../../../shared/story';
import { STORY_SHOT_LIMITS } from '../../../shared/story';
import {
  confirmStoryboard,
  patchStoryShot,
  presentStoryboard,
  updateStoryDraft,
} from '../../services/story';
import { createChatLanguageModel, getChatProviderOptions } from '../../providers/chat-provider';
import {
  buildStoryInstructions,
  type StoryCharacterDisplay,
  type StoryShotDisplay,
} from './instructions';

const draftFields = {
  conflict: z.string().max(20_000).optional(),
  ending: z.string().max(20_000).optional(),
  goal: z.string().max(20_000).optional(),
  premise: z.string().max(20_000).optional(),
  setting: z.string().max(20_000).optional(),
  summary: z.string().max(20_000).optional(),
  title: z.string().max(100).optional(),
  tone: z.string().max(20_000).optional(),
  turningPoint: z.string().max(20_000).optional(),
};

const storyDraftPatchSchema = z
  .object(draftFields)
  .refine(value => Object.keys(value).length > 0, '至少更新一个故事字段');

const storyPlanSchema = z.object({
  conflict: z.string().max(20_000),
  ending: z.string().min(1).max(20_000),
  goal: z.string().max(20_000),
  premise: z.string().min(1).max(20_000),
  setting: z.string().max(20_000),
  summary: z.string().min(20).max(20_000),
  title: z.string().min(1).max(100),
  tone: z.string().max(20_000),
  turningPoint: z.string().max(20_000),
});

const shotFields = {
  action: z.string().max(20_000),
  composition: z.string().max(20_000),
  continuity: z.string().max(20_000),
  emotion: z.string().max(20_000),
  finalPrompt: z.string().min(20).max(20_000),
  narration: z.string().max(20_000),
  purpose: z.string().max(20_000),
  scene: z.string().min(1).max(20_000),
  title: z.string().min(1).max(100),
};

const storyboardSchema = z.object({
  shots: z.array(z.object(shotFields)).min(STORY_SHOT_LIMITS.min).max(STORY_SHOT_LIMITS.max),
});

const storyShotPatchSchema = z
  .object({
    action: z.string().max(20_000).optional(),
    composition: z.string().max(20_000).optional(),
    continuity: z.string().max(20_000).optional(),
    emotion: z.string().max(20_000).optional(),
    finalPrompt: z.string().max(20_000).optional(),
    narration: z.string().max(20_000).optional(),
    purpose: z.string().max(20_000).optional(),
    scene: z.string().max(20_000).optional(),
    shotId: z.string().min(1).max(200),
    title: z.string().max(100).optional(),
  })
  .refine(value => Object.keys(value).some(key => key !== 'shotId'), '至少更新一个分镜字段');

export function createStoryAgent(options: {
  apiKey: string;
  model: ChatModel;
  story: StoryProject;
  characters: StoryCharacterDisplay[];
}) {
  let currentDraft = options.story.draft;
  let currentShots = options.story.shots;
  const providerOptions = getChatProviderOptions(options.model);

  async function saveDraft(patch: Partial<StoryDraft> & { title?: string }, ready: boolean) {
    const result = await updateStoryDraft(options.story.id, patch, ready);
    currentDraft = result.draft;
    return result;
  }

  return new ToolLoopAgent({
    model: createChatLanguageModel(options.apiKey, options.model),
    ...(providerOptions ? { providerOptions } : {}),
    instructions: buildStoryInstructions({
      draft: currentDraft,
      characters: options.characters,
      shots: currentShots.map<StoryShotDisplay>(({ versions, ...shot }) => ({
        ...shot,
        generatedVersionCount: versions.length,
      })),
      storyReady: options.story.storyReady,
      storyboardStale: options.story.storyboardStale,
    }),
    stopWhen: isStepCount(5),
    tools: {
      confirmStoryboard: tool({
        description: '用户明确确认当前分镜与最新故事一致后，解除分镜待检查状态。',
        inputSchema: z.object({}),
        execute: async () => confirmStoryboard(options.story.id),
      }),
      updateStoryDraft: tool({
        description: '保存用户已经提供或明确确认的故事信息。',
        inputSchema: storyDraftPatchSchema,
        execute: async patch => saveDraft(patch, false),
      }),
      presentStory: tool({
        description: '故事信息足够时，保存并展示可供用户确认的完整短篇故事。',
        inputSchema: storyPlanSchema,
        execute: async plan => saveDraft(plan, true),
      }),
      presentStoryboard: tool({
        description: '把已确认的短篇故事拆成 3 至 6 个连续文字分镜。',
        inputSchema: storyboardSchema,
        execute: async ({ shots }) => {
          const result = await presentStoryboard(options.story.id, shots as StoryShotContent[]);
          currentShots = result.shots;
          return result;
        },
      }),
      updateStoryShot: tool({
        description: '根据用户要求修改一个已经存在的分镜。',
        inputSchema: storyShotPatchSchema,
        execute: async ({ shotId, ...patch }) => {
          const result = await patchStoryShot(options.story.id, shotId, patch);
          currentShots = currentShots.map(shot => (shot.id === shotId ? result.shot : shot));
          return result;
        },
      }),
    },
  });
}
