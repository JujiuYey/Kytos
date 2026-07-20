import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import type { CharacterDraft, CharacterDraftPatch } from '../../shared/character';
import { CHARACTER_DRAFT_FIELDS, getCharacterDraftProgress } from '../../shared/character';
import { saveCharacterDraft } from '../services/character-workspace';
import {
  createDeepSeekCompatibleProvider,
  DEEPSEEK_PROVIDER_OPTIONS,
} from '../services/deepseek-provider';

const draftPatchSchema = z
  .object({
    ageAndBuild: z.string().max(2_000).optional(),
    backgroundRules: z.string().max(2_000).optional(),
    characterPalette: z.string().max(2_000).optional(),
    characterSeed: z.string().max(1_000).optional(),
    colorRules: z.string().max(2_000).optional(),
    defaultOutfit: z.string().max(3_000).optional(),
    detailDensity: z.string().max(2_000).optional(),
    exclusions: z.string().max(3_000).optional(),
    faceAnchor: z.string().max(3_000).optional(),
    hairAnchor: z.string().max(3_000).optional(),
    lineAndShape: z.string().max(2_000).optional(),
    name: z.string().max(100).optional(),
    signatureItems: z.string().max(2_000).optional(),
    silhouetteMarkers: z.string().max(2_000).optional(),
    textRules: z.string().max(2_000).optional(),
    visualMedium: z.string().max(2_000).optional(),
    visualSummary: z.string().max(4_000).optional(),
  })
  .refine(patch => Object.keys(patch).length > 0, '至少更新一个角色字段');

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
4. 结构化草稿是角色档案的唯一事实来源，不要另外生成完成稿、总结稿或 Markdown 档案。
5. 不要输出或描述隐藏思维过程。只说明结论、建议和下一步问题。
6. 使用简洁自然的中文，不使用客服腔。
7. 结构化草稿分为三组：人物种子、形象锚点和视觉表现。除了一句简短的人物种子，不再保存性格、动机、背景、关系、说话方式或其他文学人物资料。
8. 人物种子只有 name 和 characterSeed，用一句话说明人物大概是谁，为视觉探索提供最少上下文，但不能直接当作生图描述。
9. 形象锚点包括 visualSummary、ageAndBuild、faceAnchor、hairAnchor、defaultOutfit、characterPalette、signatureItems 和 silhouetteMarkers，用于保证每次画出来仍是同一个人。
10. 视觉表现包括 visualMedium、lineAndShape、colorRules、detailDensity、backgroundRules、textRules 和可选的 exclusions。exclusions 只记录用户明确排除的视觉特征。
11. 不要要求用户填写“必须保持”“允许变化”或“参考形象说明”。已确认的形象锚点默认必须保持，本次允许变化的内容由具体创作场景决定，参考图片由系统直接管理。
12. 用户可以在对话中抽取视觉卡。视觉卡是可撤回的完整形象方向，只有用户明确选择或确认的内容才能写入结构化草稿。
13. 用户发送人物照片、角色图或其他参考图片时，必须实际观察图片并结合用户文字回应，不能只复述用户的文字。
14. 分析参考图片时，区分稳定的人物识别特征、可变化的姿态表情与服装，以及图片自身的线条、色彩、背景和构图表现。
15. 图片内容默认是待讨论的参考，不是已经确认的角色事实。先说明你观察到的具体可见特征，再确认用户想保留、排除或继续探索哪些部分。
16. 只描述图片中可见且与角色创作有关的信息，不推断真实人物身份、族裔、健康状况、性格或其他无法从画面可靠确认的信息。
17. 用户要调整视觉卡时，先问下一张需要保留什么、调整什么。用户回答后不要继续追问，简短复述本轮保留项和调整项，并提示可以再次点击“抽卡”。这些要求只用于下一次抽卡，除非用户明确说要固定成角色设定，否则不要写入结构化草稿。`;

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
        description: '将用户已经提供或明确确认的人物种子、形象锚点或视觉表现更新到结构化草稿中。',
        inputSchema: draftPatchSchema,
        execute: updateDraft,
      }),
    },
  });
}
