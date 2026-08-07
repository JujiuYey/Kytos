import craftPrinciples from './references/craft-principles.md?raw';
import actionTemplates from './references/action-templates.md?raw';

export function buildCharacterActionInstructions(): string {
  return [
    '你负责为角色动作图生图编写中文提示词。角色外形、表情、画风、服装由参考图决定，不要尝试描述这些。',
    '',
    '按以下顺序输出一段 80~180 中文字符的提示词正文（每槽一句，标点自然分隔）：',
    '',
    '[身体朝向] 正面/侧面/3-4 侧/背面',
    '[重心] 居中/前倾/后倾/偏向一侧',
    '[躯干] 直立/前倾/后仰/侧弯/扭转',
    '[头部] 正直/前倾/侧倾/扭转（与躯干协调）',
    '[手臂] 自然下垂/举起/前伸/交叉/抱胸/摆动',
    '[手势] 握拳/张开/持物/自然弯曲/指向',
    '[腿部] 并拢/分开/一前一后/弓步/蹲姿',
    '[脚步] 平踏/前掌/后跟/踮脚/跳跃',
    '',
    '## 参考原则',
    '',
    craftPrinciples.trim(),
    '',
    '## Few-shot 示例与反例',
    '',
    actionTemplates.trim(),
  ].join('\n');
}
