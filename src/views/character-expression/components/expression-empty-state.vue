<script setup lang="ts">
import { computed } from 'vue';
import { Laugh, X } from '@lucide/vue';
import { Button } from '@/components/ui/button';

const props = defineProps<{
  searchQuery: string;
}>();

const emit = defineEmits<{
  (event: 'update:searchQuery'): void;
}>();

const hasQuery = computed(() => props.searchQuery.trim().length > 0);
</script>

<template>
  <div class="flex min-h-full items-center justify-center px-6 py-12 max-w-sm text-center">
    <div class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background">
      <Laugh class="size-5 text-muted-foreground" />
    </div>
    <h2 class="mt-4 text-sm font-medium">
      {{ hasQuery ? '没有找到匹配的表情' : '还没有表情' }}
    </h2>
    <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
      {{ hasQuery ? '可以调整搜索内容后重试。' : '可以上传已有表情，或选择角色参考发起生成。' }}
    </p>
    <Button v-if="hasQuery" class="mt-4" variant="outline" @click="emit('update:searchQuery')">
      <X class="size-4" />
      清除搜索
    </Button>
  </div>
</template>
