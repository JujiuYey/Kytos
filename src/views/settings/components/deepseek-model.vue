<script setup lang="ts">
import { computed } from 'vue';
import { Cpu } from '@lucide/vue';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/stores/app';
import { DEEPSEEK_MODELS, isDeepSeekModel } from '@/types';
import type { DeepSeekModel } from '@/types';

const appStore = useAppStore();

const modelLabels: Record<DeepSeekModel, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

const deepseekModel = computed({
  get: () => appStore.settings.deepseekModel,
  set: (value: string | number) => {
    if (isDeepSeekModel(value)) {
      appStore.updateSettings({ deepseekModel: value });
    }
  },
});
</script>

<template>
  <div class="p-5">
    <div class="flex items-center gap-2">
      <Cpu class="size-4 text-muted-foreground" />
      <h3 class="text-sm font-medium">DeepSeek 模型</h3>
    </div>
    <p class="mt-1.5 text-sm text-muted-foreground">选择应用进行文本生成时使用的模型。</p>
    <div class="mt-4 max-w-md space-y-2">
      <Label for="deepseek-model">模型</Label>
      <Select v-model="deepseekModel">
        <SelectTrigger id="deepseek-model" class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="model in DEEPSEEK_MODELS" :key="model" :value="model">
            {{ modelLabels[model] }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
