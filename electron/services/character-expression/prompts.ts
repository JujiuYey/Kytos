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
    '[TASK] 单帧静态表情图，与参考图同一角色、同一画风、同一身份。',
    `[TARGET EMOTION] ${request.name.trim()}`,
    `[EXPRESSION DETAILS] ${request.description.trim()}`,
    '',
    '[CANVAS] 头肩像或半身像，主体居中，构图以清楚展示表情为主，背景干净简单，轮廓完整。',
    '[SUBJECT IDENTITY] 脸型、五官、发型、肤色、年龄感、服装、配饰、配色、画风与参考图严格保持一致。',
    '[PRESERVE LIST] 修改仅限 eyebrows、eyelids、gaze direction、mouth shape、cheek tension、head tilt 与少量支撑表情的上半身姿态；其他一切保持。',
    '[LIGHTING] 柔和正面光。',
    '',
    '[CONSTRAINTS]',
    '- 单帧静态图，非漫画分格、非对话框、非剧情插画。',
    '- 不重新设计角色外形、服装、画风、色调。',
    '- 不输出文字、Logo、水印、边框、重复五官、额外人物或多格排版。',
  ].join('\n');
}
