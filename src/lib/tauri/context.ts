import { invoke } from '@tauri-apps/api/core';
import type { Context, ContextKind } from '@/types/writer';

export function readContext(root: string): Promise<Context> {
  return invoke<Context>('read_context', { root });
}

export function writeContext(root: string, kind: ContextKind, content: string): Promise<void> {
  return invoke<void>('write_context', { root, kind, content });
}
