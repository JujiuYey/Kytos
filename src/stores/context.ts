import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Context, ContextKind } from '@/types/writer';

export const useContextStore = defineStore('context', () => {
  const ipPath = ref<string>('');
  const agentsPath = ref<string>('');
  const ip = ref<string>('');
  const agents = ref<string>('');
  const isLoading = ref(false);
  const isSaving = ref(false);
  const lastError = ref<string>('');

  async function load(root: string) {
    if (!root) {
      ip.value = '';
      agents.value = '';
      ipPath.value = '';
      agentsPath.value = '';
      return;
    }
    isLoading.value = true;
    lastError.value = '';
    try {
      const ctx = await invoke<Context>('read_context', { root });
      ip.value = ctx.ip;
      agents.value = ctx.agents;
      ipPath.value = ctx.ip_path;
      agentsPath.value = ctx.agents_path;
    } catch (e) {
      lastError.value = String(e);
      ip.value = '';
      agents.value = '';
    } finally {
      isLoading.value = false;
    }
  }

  async function save(root: string, kind: ContextKind, content: string): Promise<boolean> {
    if (!root) {
      return false;
    }
    isSaving.value = true;
    lastError.value = '';
    try {
      await invoke('write_context', { root, kind, content });
      if (kind === 'ip') {
        ip.value = content;
      } else {
        agents.value = content;
      }
      return true;
    } catch (e) {
      lastError.value = String(e);
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  function set(kind: ContextKind, content: string) {
    if (kind === 'ip') {
      ip.value = content;
    } else {
      agents.value = content;
    }
  }

  return {
    ipPath,
    agentsPath,
    ip,
    agents,
    isLoading,
    isSaving,
    lastError,
    load,
    save,
    set,
  };
});
