<script setup lang="ts">
import { FlipHorizontal, FlipVertical, RotateCcw, RotateCw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

defineProps<{
  flipX: boolean;
  flipY: boolean;
}>();

const emit = defineEmits<{
  (event: 'rotate', direction: 'left' | 'right'): void;
  (event: 'flip', axis: 'x' | 'y'): void;
}>();
</script>

<template>
  <div class="space-y-3 border-t pt-5">
    <div class="flex items-center gap-2 text-sm font-medium">变换</div>
    <div class="grid grid-cols-4 gap-2">
      <TooltipProvider :delay-duration="300">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon"
              variant="outline"
              aria-label="向左旋转"
              @click="emit('rotate', 'left')"
            >
              <RotateCcw class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>向左旋转 90°</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon"
              variant="outline"
              aria-label="向右旋转"
              @click="emit('rotate', 'right')"
            >
              <RotateCw class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>向右旋转 90°</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon"
              :variant="flipX ? 'default' : 'outline'"
              aria-label="水平翻转"
              @click="emit('flip', 'x')"
            >
              <FlipHorizontal class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>水平翻转</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon"
              :variant="flipY ? 'default' : 'outline'"
              aria-label="垂直翻转"
              @click="emit('flip', 'y')"
            >
              <FlipVertical class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>垂直翻转</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
