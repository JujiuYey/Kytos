// story 模块本地常量：与 story 业务强绑定的字段、目录名、状态判断
import { STORY_SHOT_LIMITS } from '../../../shared/story';
import type { StoryDraft, StoryShotContent } from '../../../shared/story';
import { MAX_TEXT_LENGTH, MAX_TITLE_LENGTH } from '../../constants';
import { isActiveTaskStatus } from '../../utils';

// 故事 JSON 文件名
export const STORE_FILE_NAME = 'stories.json';
// 故事分镜图片在工作区下的子目录名（与 shared/workspace 资产目录约定不同，专属故事）
export const ASSET_DIRECTORY = 'story-frames';

export { STORY_SHOT_LIMITS };

// 重新导出，让 story 子模块仍能从 './constants' 拿到这些字段长度限制
export { MAX_TEXT_LENGTH, MAX_TITLE_LENGTH };

// 故事草稿编辑字段
export const DRAFT_FIELDS: (keyof StoryDraft)[] = [
  'conflict',
  'ending',
  'goal',
  'premise',
  'setting',
  'summary',
  'tone',
  'turningPoint',
];

// 故事分镜内容编辑字段
export const SHOT_FIELDS: (keyof StoryShotContent)[] = [
  'action',
  'composition',
  'continuity',
  'emotion',
  'finalPrompt',
  'narration',
  'purpose',
  'scene',
  'title',
];

// 触发 imageStale 标记的视觉相关字段
export const VISUAL_SHOT_FIELDS: (keyof StoryShotContent)[] = [
  'action',
  'composition',
  'continuity',
  'emotion',
  'finalPrompt',
  'scene',
];

// 任务状态是否仍处于生成中
export function isActiveGenerationStatus(status: string): boolean {
  return isActiveTaskStatus(status);
}
