<script setup lang="ts">
import { computed } from 'vue';
import { Lock, LockOpen } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CropRect } from './types';

const props = defineProps<{
  crop: CropRect;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  lockRatio: boolean;
}>();

const emit = defineEmits<{
  (event: 'outputWidthInput', value: number): void;
  (event: 'outputHeightInput', value: number): void;
  (event: 'update:lockRatio', value: boolean): void;
}>();

const currentSizeLabel = computed(
  () => `${Math.round(props.crop.width)} × ${Math.round(props.crop.height)} px`,
);
const originalSizeLabel = computed(() => `${props.sourceWidth} × ${props.sourceHeight} px`);
</script>

<template>
  <div class="space-y-3 border-t pt-5">
    <div>
      <div class="text-sm font-medium">输出尺寸</div>
      <p class="mt-1 text-xs text-muted-foreground">
        原图 {{ originalSizeLabel }} · 裁剪 {{ currentSizeLabel }}
      </p>
    </div>
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-end gap-2">
      <div class="space-y-1">
        <Label for="output-width">宽度</Label>
        <Input
          id="output-width"
          type="number"
          min="1"
          max="16000"
          :model-value="outputWidth"
          @update:model-value="emit('outputWidthInput', Number($event))"
        />
      </div>
      <div class="space-y-1">
        <Label for="output-height">高度</Label>
        <Input
          id="output-height"
          type="number"
          min="1"
          max="16000"
          :model-value="outputHeight"
          @update:model-value="emit('outputHeightInput', Number($event))"
        />
      </div>
      <TooltipProvider :delay-duration="300">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              class="size-9"
              size="icon"
              :variant="lockRatio ? 'secondary' : 'outline'"
              :aria-label="lockRatio ? '解除宽高比例锁定' : '锁定宽高比例'"
              @click="emit('update:lockRatio', !lockRatio)"
            >
              <Lock v-if="lockRatio" class="size-4" />
              <LockOpen v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ lockRatio ? '解除宽高比例锁定' : '锁定宽高比例' }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
