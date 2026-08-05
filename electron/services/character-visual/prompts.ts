// character-visual 角色动作提示词与聊天模型解析
import { isChatModel } from '../../../shared/chat-model';
import type { ChatModel } from '../../../shared/chat-model';
import { MAX_CHARACTER_ACTION_LENGTH } from '../../../shared/character-visual';

export function buildCharacterActionPrompt(action: string): string {
  return [
    '以参考图中的角色为唯一身份与视觉依据，生成同一个角色的全身动作视觉资产。',
    `本次唯一允许改变的是角色姿势与肢体动作：${action.trim()}`,
    '必须严格保持参考图中的脸部特征、面部表情、发型、身材比例、服装、鞋子、配色、配饰、绘制风格、线条、材质和细节密度完全一致。',
    '保持单一角色、全身完整入镜和干净背景。根据动作调整身体朝向与四肢位置，但不要重新设计角色。',
    '禁止改变外貌、表情、服装或画风；禁止新增道具、场景、其他人物、文字、Logo、水印或拼贴排版。',
  ].join('\n');
}

export function resolveChatModel(value: unknown): ChatModel {
  if (!isChatModel(value)) {
    throw new Error('聊天模型无效');
  }
  return value;
}

// 重新导出，保持门面一致
export { MAX_CHARACTER_ACTION_LENGTH };
