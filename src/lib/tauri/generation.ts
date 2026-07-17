import { invoke } from '@tauri-apps/api/core';
import type { DrawRequest, DrawResult } from '@/types/gacha';
import type { GenerateRequest, GenerateResult } from '@/types/writer';
import type { ChatRequest, ChatResult } from '@/types/chat';

export function draw(req: DrawRequest): Promise<DrawResult> {
  return invoke<DrawResult>('draw', { req });
}

export function fetchTask(root: string, mdPath: string, taskId: string): Promise<DrawResult> {
  return invoke<DrawResult>('fetch_task', {
    root,
    mdPath,
    taskId,
  });
}

export function generatePrompt(req: GenerateRequest): Promise<GenerateResult> {
  return invoke<GenerateResult>('generate_prompt', { req });
}

export function chatIp(req: ChatRequest): Promise<ChatResult> {
  return invoke<ChatResult>('chat_ip', { req });
}

export function summarizeIp(req: ChatRequest): Promise<ChatResult> {
  return invoke<ChatResult>('summarize_ip', { req });
}
