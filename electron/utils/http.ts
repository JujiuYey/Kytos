// 通用 HTTP 客户端：60s 超时、统一错误信息解析
import { net } from 'electron';
import { isPlainObject } from 'es-toolkit';
import { REQUEST_TIMEOUT_MS } from '../constants/api';

// Chromium 网络错误码 → 可读文案；未识别的错误保留原始信息
const NETWORK_ERROR_TEXT: Record<string, string> = {
  'net::ERR_ABORTED': '请求超时或被中止',
  'net::ERR_CONNECTION_REFUSED': '连接被拒绝',
  'net::ERR_CONNECTION_TIMED_OUT': '连接超时',
  'net::ERR_INTERNET_DISCONNECTED': '网络未连接',
  'net::ERR_NAME_NOT_RESOLVED': '域名解析失败，请检查网络或代理设置',
  'net::ERR_PROXY_CONNECTION_FAILED': '无法连接系统代理，请检查代理设置',
  'net::ERR_TIMED_OUT': '请求超时',
  'net::ERR_TUNNEL_CONNECTION_FAILED': '无法通过代理建立连接，请检查代理设置',
};

export function describeNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_TEXT[message] ?? message;
}

// fetch 包装：走 Chromium 网络栈（自动跟随系统代理），60s 超时；非 2xx 抛出提取过的中文错误；JSON 解析失败抛出对应错误
export async function requestApi(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await net.fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new Error(`无法连接图片生成服务：${describeNetworkError(error)}`);
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
