<script setup lang="ts">
import { computed } from 'vue';
import { Input } from '@/components/ui/input';
import { Search, Box } from 'lucide-vue-next';
import type { BridgeType } from '../../types';

const props = withDefaults(defineProps<{
  list?: BridgeType[];
  selectedType?: string;
}>(), {
  list: () => [],
  selectedType: '',
});

const emit = defineEmits<{
  (e: 'select', typeId: string): void;
}>();

const searchQuery = ref('');

// 过滤桥梁类型
const filteredList = computed(() => {
  if (!searchQuery.value) {
    return props.list;
  }
  const query = searchQuery.value.toLowerCase();
  return props.list.filter((type: BridgeType) =>
    type.name.toLowerCase().includes(query),
  );
});

function handleSelect(typeId: string) {
  emit('select', typeId);
}
</script>

<template>
  <div class="w-64 border-r p-2 flex flex-col">
    <div class="mb-4">
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          type="search"
          placeholder="搜索桥梁类型..."
          class="w-full pl-8"
        />
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div
        v-for="type of filteredList"
        :key="type.id"
        class="flex items-center p-2 rounded-md hover:bg-accent cursor-pointer mb-1"
        :class="{ 'bg-accent': selectedType === type.id }"
        @click="handleSelect(type.id)"
      >
        <Box class="h-4 w-4 mr-2 text-muted-foreground" />
        <span>{{ type.name }}</span>
      </div>
    </div>
  </div>
</template>
