// illustration 模块本地常量
import type { IllustrationBrief } from '../../../shared/illustration';

// 插画图片在工作区下的子目录名
export const ASSET_DIRECTORY = 'illustrations';

// 角色表情图片在工作区下的子目录名（从 character-expression 复用）
export const EXPRESSION_ASSET_DIRECTORY = 'character-expressions';

// 插画 brief 字段白名单（用于解析、保存、对话更新）
export const BRIEF_FIELDS: (keyof IllustrationBrief)[] = [
  'action',
  'composition',
  'details',
  'environment',
  'finalPrompt',
  'mood',
  'style',
  'subject',
];
