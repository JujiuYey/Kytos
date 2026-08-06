<script setup lang="ts">
import { Crop } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CropRatio, CropRect } from './types';

defineProps<{
  crop: CropRect;
  cropRatio: CropRatio;
}>();

const emit = defineEmits<{
  (event: 'cropWidthInput', value: number): void;
  (event: 'cropHeightInput', value: number): void;
  (event: 'update:cropRatio', value: CropRatio): void;
}>();
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 text-sm font-medium">
      <Crop class="size-4 text-muted-foreground" />
      裁剪
    </div>
    <div class="grid grid-cols-2 gap-2">
      <Label class="col-span-2 text-xs text-muted-foreground">裁剪比例</Label>
      <Select
        :model-value="cropRatio"
        @update:model-value="emit('update:cropRatio', $event as CropRatio)"
      >
        <SelectTrigger class="col-span-2" aria-label="裁剪比例">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">自由裁剪</SelectItem>
          <SelectItem value="1:1">1 : 1</SelectItem>
          <SelectItem value="3:4">3 : 4</SelectItem>
          <SelectItem value="4:5">4 : 5</SelectItem>
          <SelectItem value="16:9">16 : 9</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="space-y-1">
        <Label for="crop-width">宽度</Label>
        <Input
          id="crop-width"
          :model-value="Math.round(crop.width)"
          type="number"
          min="1"
          @update:model-value="emit('cropWidthInput', Number($event))"
        />
      </div>
      <div class="space-y-1">
        <Label for="crop-height">高度</Label>
        <Input
          id="crop-height"
          :model-value="Math.round(crop.height)"
          type="number"
          min="1"
          @update:model-value="emit('cropHeightInput', Number($event))"
        />
      </div>
    </div>
    <p class="text-xs text-muted-foreground">拖动裁剪框移动，右下角控制点调整范围。</p>
  </div>
</template>
