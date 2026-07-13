<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { Key, Loader2, Save } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const apiKeyInput = ref('');
const apiKeyMasked = ref('');
const apiKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');
const isSavingApimart = ref(false);

async function refreshApimartStatus() {
  if (!store.projectRoot) {
    apiKeyStatus.value = 'unknown';
    return;
  }
  const key = await invoke<string | null>('read_api_key', { root: store.projectRoot });
  apiKeyStatus.value = key ? 'set' : 'unset';
  apiKeyMasked.value = key ? `sk-****${key.slice(-4)}` : '';
}

async function saveApimartKey() {
  if (!store.projectRoot || !apiKeyInput.value.trim()) {
    return;
  }
  isSavingApimart.value = true;
  try {
    await invoke('write_api_key', { root: store.projectRoot, key: apiKeyInput.value.trim() });
    apiKeyInput.value = '';
    await refreshApimartStatus();
  } finally {
    isSavingApimart.value = false;
  }
}

const canSaveApimart = computed(() => Boolean(store.projectRoot) && apiKeyInput.value.trim().length > 0);

watch(
  () => store.projectRoot,
  async () => {
    await refreshApimartStatus();
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      APIMart key（画图用）
    </h2>
    <p v-if="!store.projectRoot" class="text-xs text-muted-foreground">
      先设置项目目录。
    </p>
    <template v-else>
      <div class="text-xs">
        <span class="text-muted-foreground">当前：</span>
        <span v-if="apiKeyStatus === 'set'" class="font-mono">{{ apiKeyMasked }}</span>
        <span v-else-if="apiKeyStatus === 'unset'" class="text-red-600">未配置</span>
        <span v-else class="text-muted-foreground">读取中…</span>
      </div>
      <div class="flex gap-2">
        <Input
          v-model="apiKeyInput"
          type="password"
          placeholder="sk-..."
          class="flex-1 font-mono text-sm"
        />
        <Button :disabled="!canSaveApimart || isSavingApimart" @click="saveApimartKey">
          <Loader2 v-if="isSavingApimart" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </Button>
      </div>
      <p class="text-xs text-muted-foreground flex items-center gap-1">
        <Key class="size-3" />
        写入项目根目录的 <code>.env</code>。
      </p>
    </template>
  </section>
</template>
