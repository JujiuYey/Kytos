// character-visual 角色动作提示词与聊天模型解析
import { isChatModel } from '../../../shared/chat-model';
import type { ChatModel } from '../../../shared/chat-model';
import { MAX_CHARACTER_ACTION_LENGTH } from '../../../shared/character-visual';

export function buildCharacterActionPrompt(action: string): string {
  return [
    '[TASK] 单帧静态全身动作图，与参考图同一角色、同一画风、同一身份。',
    `[TARGET ACTION] ${action.trim()}`,
    '',
    '[CANVAS] 全身完整入镜，单一角色，主体居中，背景干净简单，轮廓完整。',
    '[SUBJECT IDENTITY] 脸部特征、面部表情、发型、身材比例、服装、鞋子、配色、配饰、画风、线条、材质、细节密度严格保持与参考图一致。',
    '[PRESERVE LIST] 修改仅限 body orientation、center of mass、torso angle、head tilt、arm position、hand gesture、leg stance、foot placement；其他一切保持。',
    '[LIGHTING] 与参考图一致。',
    '',
    '[CONSTRAINTS]',
    '- 单帧静态图，非漫画分格、非对话框、非剧情插画。',
    '- 不重新设计角色外形、表情、服装、画风。',
    '- 不新增道具、场景、其他人物、文字、Logo、水印、边框或拼贴排版。',
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
