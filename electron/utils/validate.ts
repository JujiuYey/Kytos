// services 层共享的请求体校验：parseRequest 把 ZodError 折成统一中文消息
import path from 'node:path';
import { z } from 'zod';
import { ID_PATTERN } from '../constants';

export const idSchema = z.string().regex(ID_PATTERN);

export const safeFileNameSchema = z.string().refine(value => path.basename(value) === value, {
  error: '包含非法路径',
});

export function nameSchema(max: number) {
  return z.string().trim().min(1, '不能为空').max(max, `长度不能超过 ${max}`);
}

export function parseRequest<S extends z.ZodTypeAny>(value: unknown, schema: S): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join('.') || '请求体';
    const detail = issue?.message || '无效';
    throw new Error(`请求参数 ${field} ${detail}`);
  }
  return result.data;
}
