import { defineStore } from 'pinia';
import { ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type {
  DrawProgress,
  DrawRequest,
  DrawResult,
  LogEntry,
  Project,
  PromptDetail,
  PromptSummary,
} from '@/types/gacha';
import {
  readPrompt as readPromptCommand,
  scanProject as scanProjectCommand,
  setBaseline as setBaselineCommand,
  writePrompt as writePromptCommand,
} from '@/lib/tauri/project';
import { draw as drawCommand, fetchTask as fetchTaskCommand } from '@/lib/tauri/generation';

interface SelectedPrompt {
  categoryName: string;
  prompt: PromptSummary;
}

export const useGachaStore = defineStore('gacha', () => {
  const projectRoot = ref<string>('');
  const project = ref<Project | null>(null);
  const selectedPrompt = ref<SelectedPrompt | null>(null);
  const promptDetail = ref<PromptDetail | null>(null);
  const logs = ref<LogEntry[]>([]);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isDrawing = ref(false);
  const lastDrawResult = ref<DrawResult | null>(null);
  const lastTaskId = ref<string>('');

  function pushLog(level: LogEntry['level'], message: string) {
    logs.value.push({ timestamp: Date.now(), level, message });
    if (logs.value.length > 500) {
      logs.value.splice(0, logs.value.length - 500);
    }
  }

  async function scanProject() {
    if (!projectRoot.value) {
      project.value = null;
      return;
    }
    isLoading.value = true;
    pushLog('info', `扫描 ${projectRoot.value}`);
    try {
      project.value = await scanProjectCommand(projectRoot.value);
      pushLog('info', `扫到 ${project.value.categories.length} 个类目`);
      // If the previously selected prompt is gone, clear it.
      if (selectedPrompt.value) {
        const cat = project.value.categories.find(c => c.name === selectedPrompt.value!.categoryName);
        const prompt = cat?.prompts.find(p => p.name === selectedPrompt.value!.prompt.name);
        if (!prompt) {
          selectedPrompt.value = null;
          promptDetail.value = null;
        }
      }
    } catch (e) {
      pushLog('error', String(e));
      project.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function selectPrompt(categoryName: string, prompt: PromptSummary) {
    selectedPrompt.value = { categoryName, prompt };
    isLoading.value = true;
    try {
      promptDetail.value = await readPromptCommand(prompt.md_path);
    } catch (e) {
      pushLog('error', String(e));
      promptDetail.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function savePrompt(raw: string): Promise<boolean> {
    if (!selectedPrompt.value) {
      return false;
    }
    isSaving.value = true;
    try {
      await writePromptCommand(selectedPrompt.value.prompt.md_path, raw);
      pushLog('info', `已保存 ${selectedPrompt.value.prompt.name}`);
      return true;
    } catch (e) {
      pushLog('error', `保存失败: ${e}`);
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  async function setBaseline(imagePath: string, target: string) {
    if (!projectRoot.value) {
      return;
    }
    try {
      await setBaselineCommand(projectRoot.value, imagePath, target);
      pushLog('info', `已把 ${imagePath} 设为 ${target}`);
      await scanProject();
    } catch (e) {
      pushLog('error', `设置基准失败: ${e}`);
    }
  }

  async function draw(req: DrawRequest, onProgress?: (p: DrawProgress) => void): Promise<DrawResult | null> {
    isDrawing.value = true;
    let unlisten: UnlistenFn | undefined;
    if (onProgress) {
      unlisten = await listen<DrawProgress>('draw://progress', event => {
        onProgress(event.payload);
        pushLog(event.payload.stage === 'failed' ? 'error' : 'info', event.payload.message);
      });
    }
    try {
      const result = await drawCommand(req);
      lastDrawResult.value = result;
      lastTaskId.value = result.task_id;
      pushLog('info', `抽卡完成: task=${result.task_id}, saved=${result.saved.length}/${result.urls.length}`);
      return result;
    } catch (e) {
      pushLog('error', `抽卡失败: ${e}`);
      return null;
    } finally {
      isDrawing.value = false;
      unlisten?.();
      await scanProject();
    }
  }

  async function fetchTask(taskId: string): Promise<DrawResult | null> {
    if (!projectRoot.value || !selectedPrompt.value) {
      return null;
    }
    isDrawing.value = true;
    try {
      const result = await fetchTaskCommand(projectRoot.value, selectedPrompt.value.prompt.md_path, taskId);
      lastDrawResult.value = result;
      pushLog('info', `取回完成: task=${result.task_id}, saved=${result.saved.length}/${result.urls.length}`);
      return result;
    } catch (e) {
      pushLog('error', `取回失败: ${e}`);
      return null;
    } finally {
      isDrawing.value = false;
      await scanProject();
    }
  }

  function clearLogs() {
    logs.value = [];
  }

  return {
    projectRoot,
    project,
    selectedPrompt,
    promptDetail,
    logs,
    isLoading,
    isSaving,
    isDrawing,
    lastDrawResult,
    lastTaskId,
    scanProject,
    selectPrompt,
    savePrompt,
    setBaseline,
    draw,
    fetchTask,
    clearLogs,
    pushLog,
  };
}, {
  persist: {
    key: 'gacha',
    storage: localStorage,
    pick: ['projectRoot'],
  },
});
