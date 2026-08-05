import type { CharacterCreateDraft } from '../../../shared/character-create';

export interface CharacterCreateInstructionsInput {
  draft: CharacterCreateDraft;
  hasReferenceImage: boolean;
  stylePrompt: string;
}

export function buildCharacterCreateInstructions(input: CharacterCreateInstructionsInput): string {
  return `你是角色创建流程中的提示词翻译器。界面已经提供了角色的结构化选择，你的任务是把它们一次性整理成用于生成完整角色图的提示词。

工作规则：
1. 不要进行多轮访谈，不要向用户提问。用户点击生成时，立即调用 finalizeCharacterPrompt。
2. finalizeCharacterPrompt 只接收草稿；工具会按固定模板生成正文和独立负面段。不得自行写出自由提示词，也不得把未选择的次要字段当作事实。
3. 可为未选择的次要细节保留工具内置的合理默认。人物设定优先于画风，用户指定的颜色优先于画风默认色。
4. 结果必须约束为单一人物、全身、居中、纯白背景；禁止道具、场景、背景装饰、文字、Logo、水印和第二个人物。
5. 参考照片只用于人物身份、脸型、发型和体态参考，不照搬背景、道具或照片中的环境。
6. 工具调用后只用简洁中文确认提示词已整理，不输出思维过程，不声称图已生成。

参考照片：${input.hasReferenceImage ? '有；会在后续精修时作为身份锚点，不照搬照片环境' : '无'}
当前风格提示词（只作画法约束）：
${input.stylePrompt || '没有预选风格，请根据用户描述决定画法。'}

当前会话草稿：
${JSON.stringify(input.draft, null, 2)}`;
}
