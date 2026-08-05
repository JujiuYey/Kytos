// 通用 HTTP 客户端：60s 超时、统一错误信息解析
import { isPlainObject } from 'es-toolkit';
import { REQUEST_TIMEOUT_MS } from '../constants/api';

// fetch 包装：60s 超时；非 2xx 抛出提取过的中文错误；JSON 解析失败抛出对应错误
export async function requestApi(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? `无法连接图片生成服务：${error.message}` : '无法连接图片生成服务',
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`图片生成服务返回了无法解析的响应（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `图片生成服务请求失败（HTTP ${response.status}）`));
  }
  return payload;
}

// 从 apimart 风格 { error: { message } } payload 里取出错误描述
export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    isPlainObject(payload) &&
    isPlainObject(payload.error) &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }
  return fallback;
}
