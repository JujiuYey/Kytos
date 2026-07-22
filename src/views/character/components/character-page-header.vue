<script setup lang="ts">
import { Plus, UsersRound } from '@lucide/vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

defineProps<{
  count: number;
  busy: boolean;
}>();

defineEmits<{
  (event: 'create'): void;
}>();
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <UsersRound class="size-4" />
    </div>
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="truncate text-sm font-semibold">角色管理</h1>
        <Badge variant="secondary" class="shrink-0 tabular-nums">
          {{ count }}
        </Badge>
      </div>
      <p class="truncate text-xs text-muted-foreground">管理多个角色及其完整形象资料</p>
    </div>
  </div>
  <Button :disabled="busy" @click="$emit('create')">
    <Plus class="size-4" />
    新建角色
  </Button>
</template>
