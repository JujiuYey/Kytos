<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, Save, Loader2, Key, Cpu } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';
import { useAppStore } from '@/stores/app';

const store = useGachaStore();
const app = useAppStore();

const apiKeyInput = ref('');
const apiKeyMasked = ref('');
const apiKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');
const isSavingApimart = ref(false);

const deepseekKeyInput = ref('');
const deepseekKeyMasked = ref('');
const deepseekKeyStatus = ref<'unknown' | 'set' | 'unset'>('unknown');
const isSavingDeepseek = ref(false);

const deepseekModel = computed({
  get: () => app.settings.deepseekModel,
  set: v => app.updateSettings({ deepseekModel: v }),
});

async function refreshApimartStatus() {
  if (!store.projectRoot) {
    apiKeyStatus.value = 'unknown';
    return;
  }
  const key = await invoke<string | null>('read_api_key', { root: store.projectRoot });
  apiKeyStatus.value = key ? 'set' : 'unset';
  apiKeyMasked.value = key ? `sk-****${key.slice(-4)}` : '';
}

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

async function chooseProjectDir() {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === 'string') {
    store.projectRoot = selected;
    await store.scanProject();
    await refreshApimartStatus();
    await refreshDeepseekStatus();
  }
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

const canSaveApimart = computed(() => Boolean(store.projectRoot) && apiKeyInput.value.trim().length > 0);
const canSaveDeepseek = computed(() => Boolean(store.projectRoot) && deepseekKeyInput.value.trim().length > 0);

watch(
  () => store.projectRoot,
  async () => {
    await refreshApimartStatus();
    await refreshDeepseekStatus();
  },
  { immediate: true },
);
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
        </div>
        <p class="text-xs text-muted-foreground flex items-center gap-1">
          <Key class="size-3" />
          写入同一份 <code>.env</code>（<code>DEEPSEEK_API_KEY</code>），画图 key 不动。
        </p>
      </template>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium text-muted-foreground">
        DeepSeek 模型
      </h2>
      <Select v-model="deepseekModel">
        <SelectTrigger class="font-mono text-sm">
          <Cpu class="size-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="deepseek-chat">
            deepseek-chat（快，几分钱一张）
          </SelectItem>
          <SelectItem value="deepseek-reasoner">
            deepseek-reasoner（慢，但更稳）
          </SelectItem>
        </SelectContent>
      </Select>
    </section>
  </div>
</template>
