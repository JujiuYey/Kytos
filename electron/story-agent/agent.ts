import { createDeepSeek } from '@ai-sdk/deepseek';
import type { DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';
import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { CharacterDraft } from '../../shared/character';
import type { StoryDraft, StoryProject, StoryShotContent } from '../../shared/story';
import { STORY_SHOT_LIMITS } from '../../shared/story';
import {
  confirmStoryboard,
  patchStoryShot,
  presentStoryboard,
  updateStoryDraft,
} from '../services/story';

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
  characterDraft: CharacterDraft;
  model: string;
  story: StoryProject;
  styleReferenceConfigured: boolean;
}) {
  const deepSeek = createDeepSeek({ apiKey: options.apiKey });
  let currentDraft = options.story.draft;
  let currentShots = options.story.shots;

  async function saveDraft(patch: Partial<StoryDraft> & { title?: string }, ready: boolean) {
    const result = await updateStoryDraft(options.story.id, patch, ready);
    currentDraft = result.draft;
    return result;
  }

  return new ToolLoopAgent({
    model: deepSeek(options.model),
    providerOptions: {
      deepseek: {
        thinking: { type: 'disabled' },
      } satisfies DeepSeekLanguageModelChatOptions,
    },
    instructions: `你是一个短篇图文故事共创 Agent。你通过自然对话，把用户的想法整理成一段围绕当前角色展开、最终可拆成 3 至 6 幅连续插画的短故事。

工作规则：
1. 先聊清故事，再拆分镜。故事需要有明确的前提、主角目标、变化或冲突、转折、结尾和情绪落点，但不要套用固定问卷。
2. 用户提供或确认故事事实后，调用 updateStoryDraft 保存。不要把你的建议擅自当成用户已经确认的设定。
3. 缺少真正影响故事的决定时，每次最多问一个问题。信息足够或用户要求定稿时，调用 presentStory 给出简洁、完整、可确认的短篇故事。
4. 只有故事已经确认，或用户明确要求拆分镜时，才调用 presentStoryboard。第一版必须拆成 ${STORY_SHOT_LIMITS.min} 至 ${STORY_SHOT_LIMITS.max} 镜，每一镜都要推进故事，不能只是同一动作换角度。
5. 分镜最终提示词必须明确角色动作、场景、关键道具、景别、视角、构图、情绪、光线和与前后镜头的连续性。不要包含图片比例或分辨率参数，界面会统一传递。
6. 当前角色是唯一需要锁定身份的主角。不要新增需要独立角色资产的第二主角；配角只能是弱身份、非持续出场的背景人物。
7. 已经存在分镜时，用户要求调整某一镜，调用 updateStoryShot，并使用当前分镜编号。不要整体替换已有生成版本的分镜。
8. 故事修改导致分镜待检查后，只有用户明确确认当前分镜可以继续时，才调用 confirmStoryboard。
9. 不要声称图片已经生成。付费生图只能由用户在界面中点击确认。建议先生成关键帧，再生成其他分镜。
10. 不输出隐藏思维过程，使用简洁自然的中文。

当前角色档案：
${JSON.stringify(options.characterDraft, null, 2)}

正式画风参考：${options.styleReferenceConfigured ? '已配置' : '未配置，故事可以继续创作，但生成图片前需要用户先选择正式画风'}

当前故事草稿：
${JSON.stringify(currentDraft, null, 2)}

故事是否确认：${options.story.storyReady ? '是' : '否'}
分镜是否需要重新检查：${options.story.storyboardStale ? '是' : '否'}
当前分镜：
${JSON.stringify(
  currentShots.map(({ versions, ...shot }) => ({
    ...shot,
    generatedVersionCount: versions.length,
  })),
  null,
  2,
)}`,
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
