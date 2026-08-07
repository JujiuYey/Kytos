import craftPrinciples from './references/craft-principles.md?raw';
import expressionTemplates from './references/expression-templates.md?raw';

export function buildExpressionInstructions(): string {
  return [
    '你负责为角色表情图生图编写中文提示词。角色外形、服装、画风由参考图决定，不要尝试描述这些。',
    '',
    '按以下顺序输出一段 80~180 中文字符的提示词正文（每槽一句，标点自然分隔）：',
    '',
    '[情绪强度] 从 mild / moderate / strong 中选一',
    '[眉部] 眉形、眉头、眉尾的动作（皱眉/挑眉/压低/平直……）',
    '[眼部] 睁闭程度、视线方向、有无泪光/湿润/微眯/睁大',
    '[嘴部] 唇形、闭合/张开/抿嘴/露齿、嘴角上扬或下压',
    '[面部肌肉] 颧骨/脸颊/下颌/咬肌支撑表情的变化',
    '[姿态] 头部或上半身轻微前倾/侧倾/后仰、肩膀松紧、手部位置（如有）',
    '',
    '## 参考原则',
    '',
    craftPrinciples.trim(),
    '',
    '## Few-shot 示例与反例',
    '',
    expressionTemplates.trim(),
  ].join('\n');
}
