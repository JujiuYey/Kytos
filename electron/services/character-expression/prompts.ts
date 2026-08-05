// 角色表情：聊天模型解析 + 表情图生图提示词构造
import { isChatModel } from '../../../shared/chat-model';
import type { ChatModel } from '../../../shared/chat-model';
import type { GenerateCharacterExpressionRequest } from '../../../shared/character-expression';

export function resolveChatModel(value: unknown): ChatModel {
  if (!isChatModel(value)) {
    throw new Error('聊天模型无效');
  }
  return value;
}

export function buildExpressionPrompt(request: GenerateCharacterExpressionRequest): string {
  return [
    '参考图中的角色是唯一要画的人，综合所有已选参考确认角色身份、造型、表情语言和整体画风。',
    `目标表情：${request.name.trim()}`,
    `表情描述：${request.description.trim()}`,
    '保持角色身份、脸型、五官、发型、服装、配饰、颜色和绘画风格与参考图一致，只改变面部表情和与情绪相符的轻微姿态。',
    '构图以清楚展示表情为主，使用头肩像或半身像，主体居中，轮廓完整，背景干净简单。',
    '不要添加文字、对话框、边框、Logo、水印、额外人物、重复五官或多格排版。',
  ].join('\n');
}
