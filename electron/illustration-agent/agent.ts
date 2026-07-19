import { createDeepSeek } from '@ai-sdk/deepseek';
import type { DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';
import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { CharacterDraft } from '../../shared/character';
import type { IllustrationBrief, IllustrationTopic } from '../../shared/illustration';
import { ILLUSTRATION_STYLE_GUIDANCE } from '../../shared/illustration';
import { updateIllustrationBrief } from '../services/illustration';

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
  characterDraft: CharacterDraft;
  model: string;
  styleReferenceConfigured: boolean;
  topic: IllustrationTopic;
}) {
  const deepSeek = createDeepSeek({ apiKey: options.apiKey });
  let currentBrief = options.topic.brief;

  async function saveBrief(patch: Partial<IllustrationBrief> & { title?: string }, ready: boolean) {
    const result = await updateIllustrationBrief(options.topic.id, patch, ready);
    currentBrief = result.brief;
    return result;
  }

  const characterContext = options.topic.useCharacter
    ? JSON.stringify(options.characterDraft, null, 2)
    : '本主题未启用当前角色。画面可以是纯场景或其他通用插画，不要擅自加入当前角色。';

  return new ToolLoopAgent({
    model: deepSeek(options.model),
    providerOptions: {
      deepseek: {
        thinking: { type: 'disabled' },
      } satisfies DeepSeekLanguageModelChatOptions,
    },
    instructions: `你是一个插画共创 Agent。你通过自然对话帮助用户把模糊想法整理成可直接生图的画面方案。

工作规则：
1. 先理解用户想画的内容，再补齐真正影响画面的信息：主体、动作、环境、构图、氛围和关键细节。已配置正式画风参考时，不再追问或重新设计画风。
2. 不使用固定问卷。信息足够时直接整理方案；只有缺少关键决定时才追问，并且每次最多问一个问题。
3. 用户提供或确认画面事实后，调用 updateIllustrationBrief 保存结构化草稿。不要把你的建议擅自当成用户已确认的要求。
4. 当信息足够，或用户要求开始生图时，调用 presentIllustrationPlan，给出短标题、完整画面方案和可直接用于 GPT-Image-2 的最终提示词。
5. 最终提示词必须明确主体关系、动作姿态、环境、镜头构图、色彩、画幅意图和禁止项。已配置正式画风参考时，style 字段写“遵循正式画风参考”，不要提出冲突画风；未配置时才补充画风。不要包含图片比例或分辨率参数，界面会单独传递。
6. 如果启用了当前角色，最终提示词只描述角色在本次画面中的表现，不要重新设计角色外形。正式角色视觉会由系统自动作为身份参考图附加。
7. 不要声称图片已经生成。付费生图只能由用户在界面中点击确认。
8. 不输出隐藏思维过程，使用简洁自然的中文。

是否使用当前角色：${options.topic.useCharacter ? '是' : '否'}
当前角色档案：
${characterContext}

正式画风参考：${options.styleReferenceConfigured ? '已配置' : '未配置'}
固定画风约束：
${options.styleReferenceConfigured ? ILLUSTRATION_STYLE_GUIDANCE : '无。根据用户要求确定本次画风。'}

当前画面草稿：
${JSON.stringify(currentBrief, null, 2)}`,
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
