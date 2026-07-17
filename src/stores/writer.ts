import { defineStore } from 'pinia';
import { ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { DeepSeekDelta, GenerateRequest, GenerateResult } from '@/types/writer';
import { createPrompt } from '@/lib/tauri/project';
import { generatePrompt } from '@/lib/tauri/generation';
import { useGachaStore } from '@/stores/gacha';
import { useContextStore } from '@/stores/context';
import { useAppStore } from '@/stores/app';

const SIZE_OPTIONS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'] as const;
const RESOLUTION_OPTIONS = ['1k', '2k'] as const;

export const useWriterStore = defineStore('writer', () => {
  const category = ref<string>('');
  const name = ref<string>('');
  const size = ref<string>('16:9');
  const resolution = ref<string>('1k');
  const intent = ref<string>('');

  const draft = ref<string>('');
  const reasoning = ref<string>('');
  const isGenerating = ref(false);
  const lastError = ref<string>('');

  const gacha = useGachaStore();
  const context = useContextStore();
  const app = useAppStore();

  function setCategory(newCategory: string) {
    category.value = newCategory;
    // Spec: 表情 类目默认 1:1，其他默认 16:9. 改类目时切换，但保留用户已选的分辨率。
    size.value = newCategory === '表情' ? '1:1' : '16:9';
  }

  function ensureContextLoaded(root: string) {
    if (root && !context.ipPath && !context.agentsPath && !context.isLoading) {
      context.load(root);
    }
  }

  function reset() {
    draft.value = '';
    reasoning.value = '';
    lastError.value = '';
  }

  /**
   * Listen window — emits deepseek://delta chunks into `draft` /
   * `reasoning`, then awaits `generate_prompt` which only resolves once
   * the model emits [DONE] and we have full text returned.
   */
  async function generate(): Promise<GenerateResult | null> {
    if (!gacha.projectRoot) {
      lastError.value = '先设置项目目录';
      return null;
    }
    if (!category.value || !name.value.trim()) {
      lastError.value = '类目和卡名不能空';
      return null;
    }
    if (!intent.value.trim()) {
      lastError.value = '意图不能空';
      return null;
    }
    if (!gacha.project?.has_deepseek_key) {
      lastError.value = '还没配 DeepSeek key，去「设置」里加';
      return null;
    }

    reset();
    isGenerating.value = true;
    lastError.value = '';

    const unlisten: UnlistenFn | undefined = await listen<DeepSeekDelta>('deepseek://delta', event => {
      if (event.payload.content) {
        draft.value += event.payload.content;
      }
      if (event.payload.reasoning) {
        reasoning.value += event.payload.reasoning;
      }
    });
    const errorUnlisten: UnlistenFn | undefined = await listen<{ message: string }>('deepseek://error', event => {
      lastError.value = event.payload.message;
    });

    try {
      const req: GenerateRequest = {
        root: gacha.projectRoot,
        category: category.value,
        name: name.value.trim(),
        intent: intent.value,
        model: app.settings.deepseekModel,
      };
      const result = await generatePrompt(req);
      // Even though we streamed into draft, prefer the canonical server-returned
      // text in case the stream missed something (reconnect etc).
      if (result.md && result.md.length >= draft.value.length) {
        draft.value = result.md;
      }
      return result;
    } catch (e) {
      lastError.value = String(e);
      return null;
    } finally {
      isGenerating.value = false;
      unlisten?.();
      errorUnlisten?.();
    }
  }

  /**
   * Save the current draft as a new prompt md, refresh the project tree,
   * select the new card, and navigate to /gacha. Errors on collision
   * (spec rule 8: never overwrite an existing card).
   */
  async function saveAndGo(navigate: (path: string) => void): Promise<{ ok: boolean; error?: string }> {
    if (!gacha.projectRoot) {
      return { ok: false, error: '还没设项目目录' };
    }
    if (!category.value || !name.value.trim()) {
      return { ok: false, error: '类目和卡名不能空' };
    }
    if (!draft.value.trim()) {
      return { ok: false, error: '草稿是空的' };
    }
    const sizeLine = `<!-- size: ${size.value} -->`;
    const resolutionLine = `<!-- resolution: ${resolution.value} -->`;
    const raw = `${sizeLine}\n${resolutionLine}\n\n${draft.value.trim()}`;

    try {
      await createPrompt(gacha.projectRoot, category.value, name.value.trim(), raw);
      await gacha.scanProject();
      const cat = gacha.project?.categories.find(c => c.name === category.value);
      const prompt = cat?.prompts.find(p => p.name === name.value.trim());
      if (prompt) {
        await gacha.selectPrompt(category.value, prompt);
      }
      navigate('/gacha');
      return { ok: true };
    } catch (e) {
      const err = String(e);
      lastError.value = err;
      return { ok: false, error: err };
    }
  }

  return {
    category,
    name,
    size,
    resolution,
    intent,
    draft,
    reasoning,
    isGenerating,
    lastError,
    setCategory,
    ensureContextLoaded,
    reset,
    generate,
    saveAndGo,
    SIZE_OPTIONS: SIZE_OPTIONS as unknown as string[],
    RESOLUTION_OPTIONS: RESOLUTION_OPTIONS as unknown as string[],
  };
});
