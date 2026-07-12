<script setup lang="ts">
import { computed, ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, Save, Loader2, Key } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const apiKeyInput = ref('');
const apiKeyMasked = ref('');
const isSaving = ref(false);
const apiKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');

async function refreshApiKeyStatus() {
  if (!store.projectRoot) {
    apiKeyStatus.value = 'unknown';
    return;
  }
  const key = await invoke<string | null>('read_api_key', { root: store.projectRoot });
  apiKeyStatus.value = key ? 'set' : 'unset';
  apiKeyMasked.value = key ? `sk-****${key.slice(-4)}` : '';
}

async function chooseProjectDir() {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === 'string') {
    store.projectRoot = selected;
    await store.scanProject();
    await refreshApiKeyStatus();
  }
}

async function saveApiKey() {
  if (!store.projectRoot || !apiKeyInput.value.trim()) {
    return;
  }
  isSaving.value = true;
  try {
    await invoke('write_api_key', { root: store.projectRoot, key: apiKeyInput.value.trim() });
    apiKeyInput.value = '';
    await refreshApiKeyStatus();
  } finally {
    isSaving.value = false;
  }
}

const canSaveKey = computed(() => Boolean(store.projectRoot) && apiKeyInput.value.trim().length > 0);
</script>

<template>
  <div class="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold">
      设置
    </h1>

    <section class="space-y-3">
      <h2 class="text-sm font-medium text-muted-foreground">
        项目目录
      </h2>
      <div class="flex gap-2">
        <Input
          :model-value="store.projectRoot"
          placeholder="选一个项目根目录（一般是 ~/Desktop/角色抽卡）"
          readonly
          class="flex-1 font-mono text-sm"
        />
        <Button variant="outline" @click="chooseProjectDir">
          <FolderOpen class="size-4" />
          浏览
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">
        类目从目录里扫出来（含 <code>prompt/</code> 的子目录就算一个类目）。
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium text-muted-foreground">
        API key
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
          <Button :disabled="!canSaveKey || isSaving" @click="saveApiKey">
            <Loader2 v-if="isSaving" class="size-4 animate-spin" />
            <Save v-else class="size-4" />
            保存
          </Button>
        </div>
        <p class="text-xs text-muted-foreground flex items-center gap-1">
          <Key class="size-3" />
          写入项目根目录的 <code>.env</code>，脚本和 app 共用一个 key。
        </p>
      </template>
    </section>
  </div>
</template>
