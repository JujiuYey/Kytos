import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type {
  CharacterCreateDraft,
  CharacterCreatePromptResult,
} from '../../shared/character-create';
import {
  createDeepSeekCompatibleProvider,
  DEEPSEEK_PROVIDER_OPTIONS,
} from '../services/deepseek-provider';

const draftFields = {
  accessories: z.string().max(2000).optional(),
  accentColor: z.string().max(2000).optional(),
  age: z.string().max(2000).optional(),
  backgroundColor: z.string().max(2000).optional(),
  bottomsColor: z.string().max(2000).optional(),
  bottomsLength: z.string().max(2000).optional(),
  bottomsStyle: z.string().max(2000).optional(),
  characterMood: z.string().max(2000).optional(),
  clothingColor: z.string().max(2000).optional(),
  clothingLength: z.string().max(2000).optional(),
  clothingStyle: z.string().max(2000).optional(),
  forbiddenColors: z.string().max(2000).optional(),
  gender: z.string().max(2000).optional(),
  hairColor: z.string().max(2000).optional(),
  hairstyle: z.string().max(2000).optional(),
  overallStyleKeywords: z.string().max(2000).optional(),
  primaryColor: z.string().max(2000).optional(),
  props: z.string().max(2000).optional(),
  secondaryColor: z.string().max(2000).optional(),
  shoesColor: z.string().max(2000).optional(),
  shoesHeight: z.string().max(2000).optional(),
  shoesStyle: z.string().max(2000).optional(),
};

const draftPatchSchema = z
  .object(draftFields)
  .refine(value => Object.keys(value).length > 0, '至少更新一个人物字段');

const finalPromptSchema = z.object({
  draft: z.object(draftFields).partial(),
  prompt: z.string().min(40).max(20_000),
});

function mergeDraft(
  draft: CharacterCreateDraft,
  patch: Partial<CharacterCreateDraft>,
): CharacterCreateDraft {
  const merged = { ...draft };
  for (const field of Object.keys(patch) as Array<keyof CharacterCreateDraft>) {
    const value = patch[field];
    if (typeof value === 'string') merged[field] = value;
  }
  return merged;
}

export function createCharacterCreateAgent(options: {
  apiKey: string;
  draft: CharacterCreateDraft;
  hasReferenceImage: boolean;
  model: string;
  stylePrompt: string;
}) {
  const deepSeek = createDeepSeekCompatibleProvider(options.apiKey);
  let currentDraft = options.draft;

  return new ToolLoopAgent({
    model: deepSeek(options.model),
    providerOptions: DEEPSEEK_PROVIDER_OPTIONS,
    instructions: `你是角色创建流程中的真实形象访谈 Agent。你的任务是通过自然对话，帮助用户确认一个“只包含单一人物”的正式视觉形象。

工作规则：
1. 不使用固定问卷。每次只追问一个真正影响画面的缺失信息，优先确认性别、年龄、发型、服装、鞋子、动作和配色。
2. 用户明确说出的信息才能写入草稿。不要把你的猜测当成用户确认的事实。
3. 用户提供或确认人物事实后，调用 updateCharacterDraft 同步右侧草稿。草稿只存在当前会话，不写入角色档案。
4. 用户说“整理提示词”“可以生成了”或信息已经足够时，调用 finalizeCharacterPrompt。最终提示词必须可直接用于 GPT-Image-2。
5. 最终提示词必须明确：单一人物、全身、纯白背景、人物设定优先、当前风格只负责画法。用户明确指定的颜色优先于风格示例中的默认颜色。
6. 默认禁止物品、道具、场景元素、背景装饰、文字、Logo、水印和第二个人物；只有用户明确要求时才允许加入配饰，仍然不要加入独立物品。
7. 参考照片只用于人物身份、脸型、发型和体态参考，不照搬背景、道具或照片中的环境。
8. 只输出简洁自然的中文，不输出隐藏思维过程，不声称图片已经生成。

参考照片：${options.hasReferenceImage ? '有，已由图片生成服务附加' : '无'}
当前风格提示词（只作画法约束）：
${options.stylePrompt || '没有预选风格，请根据用户描述决定画法。'}

当前会话草稿：
${JSON.stringify(currentDraft, null, 2)}`,
    stopWhen: isStepCount(5),
    tools: {
      updateCharacterDraft: tool({
        description: '保存用户已经明确说出的角色事实，并同步到右侧角色草稿。',
        inputSchema: draftPatchSchema,
        execute: async patch => {
          const updatedFields = Object.keys(patch) as Array<keyof CharacterCreateDraft>;
          currentDraft = mergeDraft(currentDraft, patch);
          return { draft: currentDraft, updatedFields };
        },
      }),
      finalizeCharacterPrompt: tool({
        description: '把已确认的人物事实和画法整理成最终生图提示词，不保存角色档案。',
        inputSchema: finalPromptSchema,
        execute: async input => {
          currentDraft = mergeDraft(currentDraft, input.draft);
          const result: CharacterCreatePromptResult = {
            draft: currentDraft,
            prompt: input.prompt,
            ready: true,
          };
          return result;
        },
      }),
    },
  });
}
