// 工作区下 JSON 文件的原子读写
// 底层走 fs-extra：readJson 在文件不存在时返回 null，outputJson 走 atomic rename + 0o600 权限
import { readJson, outputJson } from 'fs-extra';

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function readJsonFile<T = unknown>(filePath: string): Promise<T | null> {
  return readJson(filePath, { throws: false }) as Promise<T | null>;
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await outputJson(filePath, value, { spaces: 2, mode: 0o600 });
}
