import { invoke } from '@tauri-apps/api/core';

export function readApiKey(root: string): Promise<string | null> {
  return invoke<string | null>('read_api_key', { root });
}

export function writeApiKey(root: string, key: string): Promise<void> {
  return invoke<void>('write_api_key', { root, key });
}

export function deleteApiKey(root: string): Promise<void> {
  return invoke<void>('delete_api_key', { root });
}

export function readEnvKey(root: string, name: string): Promise<string | null> {
  return invoke<string | null>('read_env_key', { root, name });
}

export function writeEnvKey(root: string, name: string, value: string): Promise<void> {
  return invoke<void>('write_env_key', { root, name, value });
}

export function deleteEnvKey(root: string, name: string): Promise<void> {
  return invoke<void>('delete_env_key', { root, name });
}
