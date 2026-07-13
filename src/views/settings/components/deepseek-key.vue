<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { ExternalLink, Loader2, Save, Trash2 } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';

const store = useGachaStore();

const deepseekKeyInput = ref('');
const deepseekKeyMasked = ref('');
const deepseekKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');
const isSavingDeepseek = ref(false);
const isClearingDeepseek = ref(false);
const isConfirmOpen = ref(false);

async function refreshDeepseekStatus() {
  if (!store.projectRoot) {
    deepseekKeyStatus.value = 'unknown';
    return;
  }
  const key = await invoke<string | null>('read_env_key', {
    root: store.projectRoot,
    name: 'DEEPSEEK_API_KEY',
  });
  deepseekKeyStatus.value = key ? 'set' : 'unset';
  deepseekKeyMasked.value = key ? `sk-****${key.slice(-4)}` : '';
}

async function saveDeepseekKey() {
  if (!store.projectRoot || !deepseekKeyInput.value.trim()) {
    return;
  }
  isSavingDeepseek.value = true;
  try {
    await invoke('write_env_key', {
      root: store.projectRoot,
      name: 'DEEPSEEK_API_KEY',
      value: deepseekKeyInput.value.trim(),
    });
    deepseekKeyInput.value = '';
    await refreshDeepseekStatus();
    await store.scanProject();
  } finally {
    isSavingDeepseek.value = false;
  }
}

async function clearDeepseekKey() {
  if (!store.projectRoot || deepseekKeyStatus.value !== 'set') {
    return;
  }
  isConfirmOpen.value = true;
}

async function confirmClearDeepseek() {
  if (!store.projectRoot) {
    return;
  }
  isClearingDeepseek.value = true;
  try {
    await invoke('delete_env_key', {
      root: store.projectRoot,
      name: 'DEEPSEEK_API_KEY',
    });
    await refreshDeepseekStatus();
    await store.scanProject();
  } finally {
    isClearingDeepseek.value = false;
    isConfirmOpen.value = false;
  }
}

const canSaveDeepseek = computed(() => Boolean(store.projectRoot) && deepseekKeyInput.value.trim().length > 0);

async function openDeepseekLink() {
  try {
    await open('https://platform.deepseek.com/');
  } catch (err) {
    console.error('打开链接失败', err);
  }
}

watch(
  () => store.projectRoot,
  async () => {
    await refreshDeepseekStatus();
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      DeepSeek key（写卡用）
    </h2>
    <p v-if="!store.projectRoot" class="text-xs text-muted-foreground">
      先设置项目目录。
    </p>
    <template v-else>
      <div class="text-xs">
        <span class="text-muted-foreground">当前：</span>
        <span v-if="deepseekKeyStatus === 'set'" class="font-mono">{{ deepseekKeyMasked }}</span>
        <span v-else-if="deepseekKeyStatus === 'unset'" class="text-red-600">未配置</span>
        <span v-else class="text-muted-foreground">读取中…</span>
        <button
          type="button"
          class="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
          @click="openDeepseekLink"
        >
          查看完整 key
          <ExternalLink class="size-3" />
        </button>
      </div>
      <div class="flex gap-2">
        <Input
          v-model="deepseekKeyInput"
          type="password"
          placeholder="sk-..."
          class="flex-1 font-mono text-sm"
        />
        <Button :disabled="!canSaveDeepseek || isSavingDeepseek" @click="saveDeepseekKey">
          <Loader2 v-if="isSavingDeepseek" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </Button>
        <Button
          v-if="deepseekKeyStatus === 'set'"
          variant="outline"
          :disabled="isClearingDeepseek"
          @click="clearDeepseekKey"
        >
          <Loader2 v-if="isClearingDeepseek" class="size-4 animate-spin" />
          <Trash2 v-else class="size-4" />
          清空
        </Button>
      </div>
    </template>
    <SagConfirmDialog
      v-model:open="isConfirmOpen"
      title="清空 DeepSeek key？"
      description="将从项目 .env 删除该行。"
      confirm-text="清空"
      :loading="isClearingDeepseek"
      @confirm="confirmClearDeepseek"
    />
  </section>
</template>
