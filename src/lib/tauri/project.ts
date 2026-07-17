import { invoke } from '@tauri-apps/api/core';
import type { Project, PromptDetail } from '@/types/gacha';

export function scanProject(root: string): Promise<Project> {
  return invoke<Project>('scan_project', { root });
}

export function readPrompt(mdPath: string): Promise<PromptDetail> {
  return invoke<PromptDetail>('read_prompt', { mdPath });
}

export function writePrompt(mdPath: string, raw: string): Promise<void> {
  return invoke<void>('write_prompt', { mdPath, raw });
}

export function setBaseline(root: string, imagePath: string, target: string): Promise<void> {
  return invoke<void>('set_baseline', { root, imagePath, target });
}

export function createPrompt(root: string, category: string, name: string, raw: string): Promise<string> {
  return invoke<string>('create_prompt', { root, category, name, raw });
}
