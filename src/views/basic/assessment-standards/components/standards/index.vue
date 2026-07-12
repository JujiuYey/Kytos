<script setup lang="ts">
import { ClipboardList, BarChart3 } from 'lucide-vue-next';
import type { AssessmentStandard } from '../../types';

const props = defineProps<{
  list: AssessmentStandard[];
}>();

const sortedStandards = ref<AssessmentStandard[]>([]);

function initStandards() {
  if (!props.list || props.list.length === 0) {
    sortedStandards.value = [];
    return;
  }

  sortedStandards.value = [...props.list].sort((a, b) => a.scale - b.scale);
}

watch(() => props.list, () => {
  initStandards();
}, { immediate: true, deep: true });
</script>

<template>
  <ScrollArea class="flex-1 h-full">
    <div class="p-6 space-y-4">
      <!-- 显示等级信息 -->
      <div class="space-y-4">
        <div
          v-for="(item, index) of sortedStandards"
          :key="item.id"
          class="p-4 rounded-md border border-border bg-card transition-all hover:shadow-md"
          :class="{
            'border-l-4 border-l-blue-500': item.scale === 1,
            'border-l-4 border-l-green-500': item.scale === 2,
            'border-l-4 border-l-yellow-500': item.scale === 3,
            'border-l-4 border-l-orange-500': item.scale === 4,
            'border-l-4 border-l-red-500': item.scale === 5,
            'mb-4': index < sortedStandards.length - 1,
          }"
        >
          <div class="space-y-3">
            <div class="flex items-center">
              <span
                class="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-semibold mr-2"
                :class="{
                  'bg-blue-100 text-blue-800': item.scale === 1,
                  'bg-green-100 text-green-800': item.scale === 2,
                  'bg-yellow-100 text-yellow-800': item.scale === 3,
                  'bg-orange-100 text-orange-800': item.scale === 4,
                  'bg-red-100 text-red-800': item.scale === 5,
                }"
              >
                {{ item.scale }}
              </span>
              <h4 class="font-bold text-base">
                标度 {{ item.scale }}
              </h4>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-1 text-base font-medium text-muted-foreground">
                <ClipboardList class="h-4 w-4" />
                <span>定性描述</span>
              </div>
              <div class="text-base">
                {{ item.qualitative || '-' }}
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-1 text-base font-medium text-muted-foreground">
                <BarChart3 class="h-4 w-4" />
                <span>定量描述</span>
              </div>
              <div class="text-base">
                {{ item.quantifier || '-' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="sortedStandards.length === 0"
        class="p-6 text-center text-muted-foreground border border-dashed rounded-md"
      >
        <div class="flex flex-col items-center justify-center space-y-2">
          <span class="text-sm">暂无评估标准数据</span>
        </div>
      </div>
    </div>
  </ScrollArea>
</template>
