<script setup lang="ts">
import { SlidersHorizontal, Sparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CharacterVisualCard } from '@/types';

defineProps<{
  adjustmentCard: CharacterVisualCard | null;
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
        <DialogTitle>{{ adjustmentCard ? '按调整方向抽卡' : '抽取角色视觉卡' }}</DialogTitle>
        <DialogDescription v-if="adjustmentCard">
          根据左侧对话中对“{{ adjustmentCard.title }}”提出的调整要求生成下一张视觉卡。
        </DialogDescription>
        <DialogDescription v-else>
          根据当前人物种子、形象锚点和视觉表现生成一张视觉卡。
        </DialogDescription>
      </DialogHeader>

      <p class="py-2 text-sm leading-6 text-muted-foreground">
        {{
          adjustmentCard
            ? '本轮会继承原视觉方向，并以对话中的保留项和调整项为准。生成图片会产生实际费用。'
            : '本轮以草稿中的视觉表现为准。视觉卡不会自动进入角色视觉，生成图片会产生实际费用。'
        }}
      </p>

      <DialogFooter>
        <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="busy" @click="emit('generate')">
          <SlidersHorizontal v-if="adjustmentCard" class="size-4" />
          <Sparkles v-else class="size-4" />
          {{ busy ? '正在准备视觉简报' : adjustmentCard ? '按此方向调整' : '抽 1 张视觉卡' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
