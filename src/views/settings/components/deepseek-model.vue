<script setup lang="ts">
import { computed } from 'vue';
import { Cpu } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const deepseekModel = computed({
  get: () => appStore.settings.deepseekModel,
  set: (value: string | number) => {
    appStore.updateSettings({ deepseekModel: String(value).trim() });
  },
});
</script>

<template>
  <div class="p-5">
    <div class="flex items-center gap-2">
      <Cpu class="size-4 text-muted-foreground" />
      <h3 class="text-sm font-medium">DeepSeek 模型</h3>
    </div>
    <p class="mt-1.5 text-sm text-muted-foreground">
      留空时由应用使用默认模型；需要固定版本时再填写。
    </p>
    <div class="mt-4 max-w-md space-y-2">
      <Label for="deepseek-model">模型标识</Label>
      <Input
        id="deepseek-model"
        v-model="deepseekModel"
        class="font-mono"
        placeholder="例如 deepseek-v4-flash"
      />
    </div>
  </div>
</template>
