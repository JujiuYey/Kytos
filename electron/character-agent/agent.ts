import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { CharacterDraft, CharacterDraftPatch } from '../../shared/character';
import {
  CHARACTER_DRAFT_FIELDS,
  getCharacterDraftProgress,
  isCharacterDraftReady,
} from '../../shared/character';
import { saveCharacterDraft } from '../services/character-workspace';
import {
  createDeepSeekCompatibleProvider,
  DEEPSEEK_PROVIDER_OPTIONS,
} from '../services/deepseek-provider';

const draftPatchSchema = z
  .object({
    ageAndBuild: z.string().max(2_000).optional(),
    allowedChanges: z.string().max(3_000).optional(),
    backgroundRules: z.string().max(2_000).optional(),
    behavioralContradiction: z.string().max(2_000).optional(),
    characterPalette: z.string().max(2_000).optional(),
    colorRules: z.string().max(2_000).optional(),
    dailyContext: z.string().max(3_000).optional(),
    defaultOutfit: z.string().max(3_000).optional(),
    detailDensity: z.string().max(2_000).optional(),
    faceAnchor: z.string().max(3_000).optional(),
    forbiddenElements: z.string().max(3_000).optional(),
    hairAnchor: z.string().max(3_000).optional(),
    lineAndShape: z.string().max(2_000).optional(),
    mustKeep: z.string().max(3_000).optional(),
    name: z.string().max(100).optional(),
    narrativeNotes: z.string().max(5_000).optional(),
    referenceImageNotes: z.string().max(3_000).optional(),
    rolePositioning: z.string().max(1_000).optional(),
    signatureItems: z.string().max(2_000).optional(),
    silhouetteMarkers: z.string().max(2_000).optional(),
    textRules: z.string().max(2_000).optional(),
    visualMedium: z.string().max(2_000).optional(),
    visualSummary: z.string().max(4_000).optional(),
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

const PERSONA = `你是一个角色共创 Agent。你的目标是与用户共同形成一份能够在不同图片中稳定复现的视觉角色定义。`;

const RULES = `工作规则：
1. 用户提供或确认角色事实后，先调用 updateCharacterDraft，把事实写入结构化草稿，再继续回复。
2. 不要擅自把你的建议当成用户已经确认的设定。可以提出少量候选方案，等用户选择后再写入。
3. 每次最多追问一个最重要的问题。问题要具体，避免一次列出问卷。
4. 当前信息足够，或用户明确要求完成稿时，调用 completeCharacterProfile 生成 Markdown 预览。
5. 不要声称已经保存最终文件。最终保存只能由用户在界面中确认。
6. 不要输出或描述隐藏思维过程。只说明结论、建议和下一步问题。
7. 使用简洁自然的中文，不使用客服腔。
8. 结构化草稿分为四组：角色内核、形象锚点、视觉表现和一致性规则。叙事信息不能代替视觉事实，性格和动机也不能直接当作生图描述。
9. 角色内核包括 rolePositioning、behavioralContradiction、dailyContext 和 narrativeNotes，只用于理解人物与表演依据。
10. 形象锚点包括 visualSummary、ageAndBuild、faceAnchor、hairAnchor、defaultOutfit、characterPalette、signatureItems 和 silhouetteMarkers，用于保证每次画出来仍是同一个人。
11. 视觉表现包括 visualMedium、lineAndShape、colorRules、detailDensity、backgroundRules 和 textRules，用于记录用户在构思人物时已经确认的稳定呈现方式。
12. 一致性规则包括 mustKeep、allowedChanges、forbiddenElements 和 referenceImageNotes，用于明确后续生成的变化边界。
13. 用户可以在对话中抽取视觉卡。视觉卡是可撤回的完整形象方向，只有用户明确选择或确认的内容才能写入结构化草稿。
14. 用户发送人物照片、角色图或其他参考图片时，必须实际观察图片并结合用户文字回应，不能只复述用户的文字。
15. 分析参考图片时，区分稳定的人物识别特征、可变化的姿态表情与服装，以及图片自身的线条、色彩、背景和构图表现。
16. 图片内容默认是待讨论的参考，不是已经确认的角色事实。先说明你观察到的具体可见特征，再确认用户想保留、排除或继续探索哪些部分。
17. 只描述图片中可见且与角色创作有关的信息，不推断真实人物身份、族裔、健康状况、性格或其他无法从画面可靠确认的信息。
18. 完成稿必须按“角色内核、形象锚点、视觉表现、一致性规则”组织，不要恢复旧的性格、动机、背景、关系问卷结构。`;

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
  const deepSeek = createDeepSeekCompatibleProvider(options.apiKey);

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
    providerOptions: DEEPSEEK_PROVIDER_OPTIONS,
    instructions: `${PERSONA}\n\n${RULES}\n\n${formatDraftState(currentDraft)}`,
    stopWhen: isStepCount(4),
    tools: {
      updateCharacterDraft: tool({
        description:
          '将用户已经提供或明确确认的角色内核、形象锚点、视觉表现或一致性规则更新到结构化草稿中。',
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
