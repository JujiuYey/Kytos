import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type {
  CharacterCreateDraft,
  CharacterCreatePromptResult,
} from '../../shared/character-create';
import type { ChatModel } from '../../shared/character';
import { createChatLanguageModel, getChatProviderOptions } from '../services/chat-provider';
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

const finalPromptSchema = z.object({ draft: z.object(draftFields).partial() });

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

function valueOrDefault(value: string, fallback: string): string {
  return value.trim() || fallback;
}

export function buildCharacterCreatePrompt(
  draft: CharacterCreateDraft,
  stylePrompt: string,
): string {
  const forbiddenColors = draft.forbiddenColors.trim()
    ? `, forbidden colors ${draft.forbiddenColors.trim()}`
    : '';
  const positivePrompt = [
    `one single ${valueOrDefault(draft.gender, 'person')}`,
    valueOrDefault(draft.age, 'young adult'),
    'full body, centered',
    `${valueOrDefault(draft.hairstyle, 'natural')} hairstyle`,
    `${valueOrDefault(draft.hairColor, 'natural dark')} hair`,
    `${valueOrDefault(draft.clothingStyle, 'casual')} top`,
    `${valueOrDefault(draft.bottomsStyle, 'simple')} bottoms`,
    valueOrDefault(draft.characterMood, 'friendly and composed mood'),
    `main color ${valueOrDefault(draft.primaryColor, 'balanced neutral colors')}`,
    draft.overallStyleKeywords.trim(),
    stylePrompt.trim(),
    'pure white background, no shadow, character design sheet',
  ].filter(Boolean);
  const negativePrompt =
    `no props, no scene, no background decoration, no text, no logo, ` +
    `no watermark, no second person${forbiddenColors}`;
  return `${positivePrompt.join(', ')}.\n\nNegative prompt: ${negativePrompt}.`;
}

export function createCharacterCreateAgent(options: {
  apiKey: string;
  draft: CharacterCreateDraft;
  hasReferenceImage: boolean;
  model: ChatModel;
  stylePrompt: string;
}) {
  let currentDraft = options.draft;
  const providerOptions = getChatProviderOptions(options.model);

  return new ToolLoopAgent({
    model: createChatLanguageModel(options.apiKey, options.model),
    ...(providerOptions ? { providerOptions } : {}),
    instructions: buildCharacterCreateInstructions({
      draft: currentDraft,
      hasReferenceImage: options.hasReferenceImage,
      stylePrompt: options.stylePrompt,
    }),
    stopWhen: isStepCount(5),
    tools: {
      updateCharacterDraft: tool({
        description: '仅在用户补充信息时更新角色草稿。',
        inputSchema: draftPatchSchema,
        execute: async patch => {
          const updatedFields = Object.keys(patch) as Array<keyof CharacterCreateDraft>;
          currentDraft = mergeDraft(currentDraft, patch);
          return { draft: currentDraft, updatedFields };
        },
      }),
      finalizeCharacterPrompt: tool({
        description: '根据当前草稿和已选画风，按固定模板组装最终生图提示词，不保存角色档案。',
        inputSchema: finalPromptSchema,
        execute: async input => {
          currentDraft = mergeDraft(currentDraft, input.draft);
          const result: CharacterCreatePromptResult = {
            draft: currentDraft,
            prompt: buildCharacterCreatePrompt(currentDraft, options.stylePrompt),
            ready: true,
          };
          return result;
        },
      }),
    },
  });
}
