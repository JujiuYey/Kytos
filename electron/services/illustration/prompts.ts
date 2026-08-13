// illustration 模块：提示词构造与生成请求校验
import { isPlainObject } from 'es-toolkit';
import { MAX_ILLUSTRATION_REFERENCE_IMAGES } from '../../../shared/illustration';
import type {
  GenerateIllustrationRequest,
  IllustrationReference,
} from '../../../shared/illustration';
import { MAX_TEXT_LENGTH } from '../../constants';
import {
  isResolution,
  isSize,
  parseIllustrationReference,
  parseIllustrationRevisionReference,
} from './parsers';

export function buildIllustrationPrompt(
  prompt: string,
  references: IllustrationReference[],
  revisionPrompt: string,
): string {
  const lines: string[] = [];
  const hasCharacterReferences = references.some(reference =>
    reference.kind.startsWith('character-'),
  );
  const hasStyleReferences = references.some(
    reference =>
      (reference.purpose ??
        (reference.kind === 'illustration' && reference.source === 'generated'
          ? 'style'
          : 'content')) === 'style',
  );
  const hasContentReferences = references.some(
    reference =>
      reference.kind === 'illustration' && (reference.purpose ?? 'content') === 'content',
  );
  if (hasCharacterReferences) {
    lines.push(
      '参考图中的角色是本次插画中的同一个角色。综合所有已选角色参考确认脸部、表情、服装、完整造型和结构。',
      revisionPrompt
        ? '除本次修改要求明确指定的项目外，必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致。'
        : '必须保持角色身份、脸型、五官、发型、身材比例、服装、鞋履、配饰和颜色一致，不要重新设计或美化角色。',
    );
    if (references.some(reference => reference.kind === 'character-action')) {
      lines.push(
        '角色动作参考图用于锁定姿势、肢体关系和动作节奏；复用动作信息，但不要改变角色身份。',
      );
    }
    if (references.some(reference => reference.kind === 'character-expression')) {
      lines.push(
        '角色表情参考图用于锁定眉眼、视线、嘴型和面部情绪；只复用表情信息，不要替换角色外观。',
      );
    }
  }
  if (hasStyleReferences) {
    lines.push(
      '风格参考图是本次画面的风格基准。严格保持其媒介、线条、笔触、背景留白、色彩数量和整体美学，不要把画面改成写实摄影或高饱和全彩风格。',
    );
  }
  if (hasContentReferences) {
    lines.push(
      '内容参考图只用于理解主体、物件、空间关系或构图。不要继承内容参考图的摄影质感、光照、颜色和背景风格。',
    );
  }
  lines.push(prompt.trim());
  if (revisionPrompt) {
    lines.push(
      '请以旧插画参考图为修改底稿，严格保留修改要求未提及的主体、构图、环境、色彩和细节，只调整明确指定的内容。',
      `本次修改要求：${revisionPrompt}`,
    );
  }
  if (!revisionPrompt && !hasStyleReferences) {
    lines.push('旧插画参考图只用于延续其构图、环境或情境。');
  }
  lines.push(
    '如果参考图之间发生冲突，优先级为角色身份 > 风格基准 > 内容参考。',
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
    (request.revisionPrompt !== null && request.revisionBase === null) ||
    !isSize(request.size) ||
    !isResolution(request.resolution) ||
    !Array.isArray(request.references) ||
    request.references.length > MAX_ILLUSTRATION_REFERENCE_IMAGES ||
    request.references.some(reference => !parseIllustrationReference(reference)) ||
    (request.revisionBase !== null && !parseIllustrationRevisionReference(request.revisionBase))
  ) {
    throw new Error('插画生成参数无效');
  }
}
