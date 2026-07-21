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
import { buildCharacterCreateInstructions } from './instructions';

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
    instructions: buildCharacterCreateInstructions({
      draft: currentDraft,
      hasReferenceImage: options.hasReferenceImage,
      stylePrompt: options.stylePrompt,
    }),
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
