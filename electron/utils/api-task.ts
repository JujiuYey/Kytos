// apimart 任务接口：task_id 解析 + 任务状态字段解析
import { isPlainObject } from 'es-toolkit';
import { ID_PATTERN } from '../constants/text';

export interface ApiTaskImage {
  url: string[];
}

export interface ApiTaskData {
  error?: { message?: string };
  progress?: number;
  result?: { images?: ApiTaskImage[] };
  status?: string;
}

// 从提交响应里取出首个任务 ID
export function getSubmittedTaskId(payload: unknown): string {
  if (!isPlainObject(payload) || !Array.isArray(payload.data)) {
    throw new Error('图片生成服务未返回任务编号');
  }
  const firstItem = payload.data[0];
  if (!isPlainObject(firstItem) || typeof firstItem.task_id !== 'string') {
    throw new Error('图片生成服务未返回任务编号');
  }
  if (!ID_PATTERN.test(firstItem.task_id)) {
    throw new Error('图片生成服务返回了无效的任务编号');
  }
  return firstItem.task_id;
}

// 把轮询响应里的 data 部分规整为 ApiTaskData
export function parseTaskData(payload: unknown): ApiTaskData {
  if (!isPlainObject(payload) || !isPlainObject(payload.data)) {
    throw new Error('图片生成服务返回了无效的任务状态');
  }
  const data = payload.data;
  const resultImages =
    isPlainObject(data.result) && Array.isArray(data.result.images)
      ? data.result.images.filter(isPlainObject).map(image => ({
          url: Array.isArray(image.url)
            ? image.url.filter((url): url is string => typeof url === 'string')
            : [],
        }))
      : undefined;
  return {
    error: isPlainObject(data.error)
      ? { message: typeof data.error.message === 'string' ? data.error.message : undefined }
      : undefined,
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    result: resultImages ? { images: resultImages } : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
  };
}
