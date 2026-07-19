import { createDeepSeek } from '@ai-sdk/deepseek';
import type { DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';
import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { CharacterDraft, CharacterDraftPatch } from '../../shared/character';
import {
  CHARACTER_DRAFT_FIELDS,
  getCharacterDraftProgress,
  isCharacterDraftReady,
} from '../../shared/character';
import { saveCharacterDraft } from '../services/character-workspace';

const draftPatchSchema = z
  .object({
    background: z.string().max(4_000).optional(),
    concept: z.string().max(1_000).optional(),
    motivation: z.string().max(2_000).optional(),
    name: z.string().max(100).optional(),
    personality: z.string().max(2_000).optional(),
    relationships: z.string().max(3_000).optional(),
    speechStyle: z.string().max(2_000).optional(),
  })
  .refine(patch => Object.keys(patch).length > 0, '至少更新一个角色字段');

const profileSchema = z.object({
  markdown: z.string().min(100).max(100_000),
});

function mergeDraft(draft: CharacterDraft, patch: CharacterDraftPatch): CharacterDraft {
  const nextDraft = { ...draft };
  for (const field of CHARACTER_DRAFT_FIELDS) {
    const value = patch[field];
    if (typeof value === 'string') {
      nextDraft[field] = value.trim();
    }
  }
  return nextDraft;
}

const PERSONA = `你是一个角色共创 Agent。你的目标是与用户共同形成一份具体、一致、可继续创作的角色档案。`;

const RULES = `工作规则：
1. 用户提供或确认角色事实后，先调用 updateCharacterDraft，把事实写入结构化草稿，再继续回复。
2. 不要擅自把你的建议当成用户已经确认的设定。可以提出少量候选方案，等用户选择后再写入。
3. 每次最多追问一个最重要的问题。问题要具体，避免一次列出问卷。
4. 当前信息足够，或用户明确要求完成稿时，调用 completeCharacterProfile 生成 Markdown 预览。
5. 不要声称已经保存最终文件。最终保存只能由用户在界面中确认。
6. 不要输出或描述隐藏思维过程。只说明结论、建议和下一步问题。
7. 使用简洁自然的中文，不使用客服腔。
8. 角色共创只讨论这个人是谁：核心概念、性格、动机、经历、关系、说话和行为方式。不要追问或设计画风、发型、五官、体型、服装、配饰、颜色等视觉方案，这些由角色视觉、画风管理和后续造型管理负责。
9. 用户主动提供视觉想法时，可以简短确认，但不要写入角色草稿；提醒用户后续在角色视觉或造型管理中处理。
10. 完成稿只整理人物身份与内在设定，不得生成“外形”“视觉方向”“画风”“服装”或“配饰”章节。`;

function formatDraftState(draft: CharacterDraft): string {
  return `当前草稿：\n${JSON.stringify(draft, null, 2)}`;
}

export function createCharacterAgent(options: {
  apiKey: string;
  draft: CharacterDraft;
  model: string;
}) {
  let currentDraft = options.draft;
  let draftUpdateQueue = Promise.resolve();
  const deepSeek = createDeepSeek({ apiKey: options.apiKey });

  async function updateDraft(patch: CharacterDraftPatch) {
    const operation = draftUpdateQueue.then(async () => {
      currentDraft = mergeDraft(currentDraft, patch);
      await saveCharacterDraft(currentDraft);
      const progress = getCharacterDraftProgress(currentDraft);
      return {
        ...progress,
        draft: currentDraft,
        updatedFields: CHARACTER_DRAFT_FIELDS.filter(field => field in patch),
      };
    });
    draftUpdateQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  return new ToolLoopAgent({
    model: deepSeek(options.model),
    providerOptions: {
      deepseek: {
        thinking: { type: 'disabled' },
      } satisfies DeepSeekLanguageModelChatOptions,
    },
    instructions: `${PERSONA}\n\n${RULES}\n\n${formatDraftState(currentDraft)}`,
    stopWhen: isStepCount(4),
    tools: {
      updateCharacterDraft: tool({
        description: '将用户已经提供或明确确认的角色事实更新到结构化草稿中。',
        inputSchema: draftPatchSchema,
        execute: updateDraft,
      }),
      completeCharacterProfile: tool({
        description: '当角色信息已经足够或用户要求完成稿时，生成完整的 Markdown 角色档案预览。',
        inputSchema: profileSchema,
        execute: async ({ markdown }) => {
          await draftUpdateQueue;
          const progress = getCharacterDraftProgress(currentDraft);
          return {
            draft: currentDraft,
            markdown: markdown.trim(),
            ready: isCharacterDraftReady(currentDraft),
            missingFields: progress.missingFields,
          };
        },
      }),
    },
  });
}
