// illustration 模块：提示词构造与生成请求校验
import { isPlainObject } from 'es-toolkit';
import { MAX_ILLUSTRATION_REFERENCE_IMAGES } from '../../../shared/illustration';
import type { GenerateIllustrationRequest } from '../../../shared/illustration';
import { MAX_TEXT_LENGTH } from '../../constants';
import { isResolution, isSize, parseIllustrationReference, parseVersionReference } from './parsers';

export function buildIllustrationPrompt(
  prompt: string,
  hasCharacterReferences: boolean,
  revisionPrompt: string,
): string {
  const lines: string[] = [];
  if (hasCharacterReferences) {
    lines.push(
      '参考图中的角色是本次插画中的同一个角色。综合所有已选角色参考确认脸部、表情、服装、完整造型和结构。',
      revisionPrompt
        ? '除本次修改要求明确指定的项目外，必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致。'
        : '必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致，不要重新设计或美化角色。',
    );
  }
  lines.push(prompt.trim());
  if (revisionPrompt) {
    lines.push(
      '请以旧插画参考图为修改底稿，严格保留修改要求未提及的主体、构图、环境、色彩和细节，只调整明确指定的内容。',
      `本次修改要求：${revisionPrompt}`,
    );
  }
  if (!revisionPrompt) {
    lines.push('旧插画参考图只用于延续其构图、环境或情境。');
  }
  lines.push(
    '如果旧插画与正式角色资产冲突，以正式角色资产为准。',
    '除少量风格化手写批注外，不要添加标题、大段文字、边框、Logo、水印、多格排版、重复人物或重复肢体。',
  );
  return lines.join('\n');
}

export function validateGenerateRequest(request: GenerateIllustrationRequest): void {
  if (
    !isPlainObject(request) ||
    typeof request.topicId !== 'string' ||
    typeof request.prompt !== 'string' ||
    !request.prompt.trim() ||
    request.prompt.length > MAX_TEXT_LENGTH ||
    (request.revisionPrompt !== null &&
      (typeof request.revisionPrompt !== 'string' ||
        !request.revisionPrompt.trim() ||
        request.revisionPrompt.length > MAX_TEXT_LENGTH)) ||
    (request.revisionPrompt !== null && request.baseVersion === null) ||
    !isSize(request.size) ||
    !isResolution(request.resolution) ||
    !Array.isArray(request.references) ||
    request.references.length > MAX_ILLUSTRATION_REFERENCE_IMAGES ||
    request.references.some(reference => !parseIllustrationReference(reference)) ||
    (request.baseVersion !== null && !parseVersionReference(request.baseVersion))
  ) {
    throw new Error('插画生成参数无效');
  }
}
