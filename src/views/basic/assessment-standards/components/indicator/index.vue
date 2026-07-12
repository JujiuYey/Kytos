<script setup lang="ts">
import { computed } from 'vue';
import { Input } from '@/components/ui/input';
import { Search, Box } from 'lucide-vue-next';
import type { AssessmentIndicator } from '../../types';

const props = withDefaults(defineProps<{
  list?: AssessmentIndicator[];
  current?: string;
}>(), {
  list: () => [],
  current: '',
});

const emit = defineEmits<{
  (e: 'select', typeId: string): void;
}>();

const searchQuery = ref('');

// 过滤评估指标
const filteredList = computed(() => {
  if (!searchQuery.value) {
    return props.list;
  }
  const query = searchQuery.value.toLowerCase();
  return props.list.filter((type: AssessmentIndicator) =>
    type.name.toLowerCase().includes(query),
  );
});

function handleSelect(typeId: string) {
  emit('select', typeId);
}
</script>

<template>
  <div class="w-84 border-r p-2 flex flex-col">
    <div class="mb-4">
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="search"
          placeholder="搜索评估指标..."
          class="w-full pl-8"
        />
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div
        v-for="indicator of filteredList"
        :key="indicator.id"
        class="flex items-start p-2 rounded-md hover:bg-accent cursor-pointer mb-1 min-w-0"
        :class="{ 'bg-accent': current === indicator.id }"
        @click="handleSelect(indicator.id)"
      >
        <Box class="h-4 w-4 flex-shrink-0 mr-2 mt-0.5 text-muted-foreground" />
        <span class="whitespace-normal break-words">
          {{ indicator.sequence }}.{{ indicator.name }}
        </span>
      </div>
    </div>
  </div>
</template>
