<script setup lang="ts">
import { Sparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

defineProps<{
  busy: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  (event: 'generate'): void;
  (event: 'update:open', value: boolean): void;
}>();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>抽取角色视觉卡</DialogTitle>
        <DialogDescription>
          系统会根据当前人物种子、形象锚点和视觉表现，生成 3 个具体视觉方向。
        </DialogDescription>
      </DialogHeader>

      <p class="py-2 text-sm leading-6 text-muted-foreground">
        本轮风格以草稿中的视觉表现为准。视觉卡不会自动进入正式角色资产，生成 3
        张图片会产生实际费用。
      </p>

      <DialogFooter>
        <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="busy" @click="emit('generate')">
          <Sparkles class="size-4" />
          {{ busy ? '正在准备视觉简报' : '抽 3 张视觉卡' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
