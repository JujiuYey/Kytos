// 任务状态类型守卫 + 镜像文件扩展名推断
import path from 'node:path';
import { ACCEPTED_IMAGE_EXTENSIONS, MIME_EXTENSIONS } from '../constants/media';

export const TASK_STATUS_VALUES = [
  'submitted',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['submitted', 'pending', 'processing'];

// 镜像生成服务的任务状态白名单
export function isTaskStatus(value: unknown): value is TaskStatus {
  return (TASK_STATUS_VALUES as readonly string[]).includes(String(value));
}

// 任务仍处于"生成中"（未完成未失败未取消）
export function isActiveTaskStatus(value: string): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(value);
}

// 由 MIME / URL 后缀推断图片扩展名
export function getImageExtension(mimeType: string, imageUrl: string): string {
  const normalizedMimeType = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (normalizedMimeType && MIME_EXTENSIONS[normalizedMimeType]) {
    return MIME_EXTENSIONS[normalizedMimeType];
  }
  const urlExtension = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.includes(urlExtension) ? urlExtension : '.png';
}
