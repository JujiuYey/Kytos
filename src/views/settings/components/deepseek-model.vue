<script setup lang="ts">
import { computed } from 'vue';
import { Cpu } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app';

const app = useAppStore();

const deepseekModel = computed({
  get: () => app.settings.deepseekModel,
  set: v => app.updateSettings({ deepseekModel: v }),
});
</script>

<template>
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
</template>
