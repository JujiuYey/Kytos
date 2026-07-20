<script setup lang="ts">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CharacterPortraitResolution } from '@/types';
import type { ImageOutputSize } from './types';

const props = withDefaults(
  defineProps<{
    count?: number;
    countOptions?: readonly number[];
    disabled?: boolean;
    fixedSize?: ImageOutputSize;
    idPrefix: string;
    resolution: CharacterPortraitResolution;
    size?: ImageOutputSize;
    sizeOptions?: readonly ImageOutputSize[];
    title?: string | null;
  }>(),
  {
    count: undefined,
    countOptions: () => [1, 2, 3, 4],
    disabled: false,
    fixedSize: undefined,
    size: undefined,
    sizeOptions: () => [],
    title: '输出规格',
  },
);

const emit = defineEmits<{
  (event: 'update:count', value: number): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: ImageOutputSize): void;
}>();

const columnsClass = computed(() => (props.count === undefined ? 'grid-cols-2' : 'grid-cols-3'));
</script>

<template>
  <section
    :aria-label="title ? undefined : '输出规格'"
    :aria-labelledby="title ? `${idPrefix}-heading` : undefined"
  >
    <h3 v-if="title" :id="`${idPrefix}-heading`" class="mb-3 text-sm font-medium">{{ title }}</h3>
    <div :class="['grid gap-3', columnsClass]">
      <div class="min-w-0 space-y-2">
        <Label :for="fixedSize ? undefined : `${idPrefix}-size`">比例</Label>
        <div
          v-if="fixedSize"
          class="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm"
        >
          {{ fixedSize }}
        </div>
        <Select
          v-else
          :model-value="size"
          :disabled="disabled"
          @update:model-value="emit('update:size', $event as ImageOutputSize)"
        >
          <SelectTrigger :id="`${idPrefix}-size`" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in sizeOptions" :key="option" :value="option">
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="min-w-0 space-y-2">
        <Label :for="`${idPrefix}-resolution`">清晰度</Label>
        <Select
          :model-value="resolution"
          :disabled="disabled"
          @update:model-value="emit('update:resolution', $event as CharacterPortraitResolution)"
        >
          <SelectTrigger :id="`${idPrefix}-resolution`" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1k">1K</SelectItem>
            <SelectItem value="2k">2K</SelectItem>
            <SelectItem value="4k">4K</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="count !== undefined" class="min-w-0 space-y-2">
        <Label :for="`${idPrefix}-count`">张数</Label>
        <Select
          :model-value="String(count)"
          :disabled="disabled"
          @update:model-value="emit('update:count', Number($event))"
        >
          <SelectTrigger :id="`${idPrefix}-count`" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in countOptions" :key="option" :value="String(option)">
              {{ option }} 张
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </section>
</template>
