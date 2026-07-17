<script setup lang="ts">
import { computed } from 'vue';
import { CircleDashed } from 'lucide-vue-next';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CharacterDraft, CharacterDraftField } from '@/types';
import { getCharacterDraftProgress } from '@/types';

const props = defineProps<{
  draft: CharacterDraft;
}>();

const fieldDefinitions: Array<{
  field: CharacterDraftField;
  label: string;
  placeholder: string;
}> = [
  { field: 'name', label: '姓名', placeholder: '尚未命名' },
  { field: 'concept', label: '核心概念', placeholder: '角色最鲜明的一句话定义' },
  { field: 'personality', label: '性格', placeholder: '性格特征、矛盾与弱点' },
  { field: 'motivation', label: '动机', placeholder: '真正想要什么，以及为什么' },
  { field: 'background', label: '背景', placeholder: '塑造角色的经历与环境' },
  { field: 'appearance', label: '外形', placeholder: '辨识度、服饰与身体特征' },
  { field: 'relationships', label: '关系', placeholder: '重要人物与关系张力' },
  { field: 'speechStyle', label: '说话方式', placeholder: '语气、用词和表达习惯' },
  { field: 'visualDirection', label: '视觉方向', placeholder: '画面风格与视觉关键词' },
];

const progress = computed(() => getCharacterDraftProgress(props.draft));
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b px-5 py-4">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-medium">资料完整度</span>
        <span class="tabular-nums text-muted-foreground">{{ progress.completion }}%</span>
      </div>
      <Progress :model-value="progress.completion" class="mt-2 h-1.5" />
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <dl class="divide-y">
        <div v-for="item in fieldDefinitions" :key="item.field" class="px-5 py-4">
          <dt class="mb-1.5 text-xs font-medium text-muted-foreground">{{ item.label }}</dt>
          <dd v-if="draft[item.field]" class="whitespace-pre-wrap break-words text-sm leading-6">
            {{ draft[item.field] }}
          </dd>
          <dd v-else class="flex items-center gap-2 text-sm text-muted-foreground/70">
            <CircleDashed class="size-3.5 shrink-0" />
            {{ item.placeholder }}
          </dd>
        </div>
      </dl>
    </ScrollArea>
  </div>
</template>
