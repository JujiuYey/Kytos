// apimart 任务接口：HTTP 请求封装 + 任务状态字段解析
// 文档：https://docs.apimart.ai/cn/api-reference/model/gpt-image-2/image-generation
//       https://docs.apimart.ai/cn/api-reference/model/gpt-image-2/task-status
import { isPlainObject } from 'es-toolkit';
import { API_BASE_URL } from '../constants/api';
import { ID_PATTERN } from '../constants/text';
import { requestApi } from './http';
import type { TaskStatus } from './media';

export interface ApiTaskImage {
  // 图片 URL 列表（同一张图会出多张分辨率时会有多个；通常 1 个）
  url: string[];
  // 签名 URL 过期时间，UNIX 秒
  expires_at?: number;
}

export interface ApiTaskError {
  code?: number;
  message?: string;
  type?: string;
}

export interface ApiTaskData {
  // 任务唯一 ID（与请求路径里的 task_id 一致）
  id?: string;
  status?: TaskStatus;
  progress?: number;
  // 时间戳（UNIX 秒）
  created?: number;
  completed?: number;
  // 任务耗时（秒）
  actual_time?: number;
  // 任务预计耗时（秒）
  estimated_time?: number;
  // 美元计费
  cost?: number;
  // 积分计费
  credits_cost?: number;
  result?: { images?: ApiTaskImage[] };
  error?: ApiTaskError;
}

// POST /v1/images/generations —— 提交图像生成任务
// 直接返回 task_id，把"调接口 + 解析 task_id"打包成一个调用点
export async function submitImageTask(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<string> {
  const payload = await requestApi(`${API_BASE_URL}/v1/images/generations`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  });
  return getSubmittedTaskId(payload);
}

// GET /v1/tasks/{task_id}?language=zh —— 轮询任务状态
// 直接返回解析后的 ApiTaskData（已做 unknown 校验），调用方无需再手动 parse
export async function pollImageTask(taskId: string, apiKey: string): Promise<ApiTaskData> {
  const payload = await requestApi(`${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    method: 'GET',
  });
  return parseTaskData(payload);
}

// 从提交响应（POST /v1/images/generations）里取出首个任务 ID
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
          expires_at: typeof image.expires_at === 'number' ? image.expires_at : undefined,
          url: Array.isArray(image.url)
            ? image.url.filter((url): url is string => typeof url === 'string')
            : [],
        }))
      : undefined;
  const error = isPlainObject(data.error)
    ? {
        code: typeof data.error.code === 'number' ? data.error.code : undefined,
        message: typeof data.error.message === 'string' ? data.error.message : undefined,
        type: typeof data.error.type === 'string' ? data.error.type : undefined,
      }
    : undefined;
  const numberField = (key: string): number | undefined =>
    typeof data[key] === 'number' ? (data[key] as number) : undefined;
  return {
    actual_time: numberField('actual_time'),
    completed: numberField('completed'),
    cost: numberField('cost'),
    created: numberField('created'),
    credits_cost: numberField('credits_cost'),
    error,
    estimated_time: numberField('estimated_time'),
    id: typeof data.id === 'string' ? data.id : undefined,
    progress: numberField('progress'),
    result: resultImages ? { images: resultImages } : undefined,
    status: typeof data.status === 'string' ? (data.status as TaskStatus) : undefined,
  };
}
