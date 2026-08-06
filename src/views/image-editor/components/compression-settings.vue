<script setup lang="ts">
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CompressionMode } from './types';

defineProps<{
  compressionMode: CompressionMode;
  quality: number;
  targetSizeKb: number;
}>();

const emit = defineEmits<{
  (event: 'update:compressionMode', value: CompressionMode): void;
  (event: 'qualityInput', value: number): void;
  (event: 'targetSizeInput', value: number): void;
}>();
</script>

<template>
  <div class="space-y-3 border-t pt-5">
    <div class="text-sm font-medium">压缩</div>
    <Tabs
      :model-value="compressionMode"
      @update:model-value="emit('update:compressionMode', $event as CompressionMode)"
    >
      <TabsList class="w-full">
        <TabsTrigger value="quality">按质量</TabsTrigger>
        <TabsTrigger value="target-size">限制大小</TabsTrigger>
      </TabsList>

      <TabsContent value="quality" class="mt-1 space-y-3">
        <div class="space-y-1">
          <Label for="export-quality">质量（{{ quality }}%）</Label>
          <Input
            id="export-quality"
            :model-value="quality"
            type="number"
            min="10"
            max="100"
            @update:model-value="emit('qualityInput', Number($event))"
          />
        </div>
        <p class="text-xs leading-5 text-muted-foreground">
          质量只影响 JPEG 和 WebP；PNG 会无损导出。
        </p>
      </TabsContent>

      <TabsContent value="target-size" class="mt-1 space-y-3">
        <div class="space-y-1">
          <Label for="target-file-size">最大文件大小</Label>
          <InputGroup>
            <InputGroupInput
              id="target-file-size"
              :model-value="targetSizeKb"
              type="number"
              min="10"
              max="102400"
              @update:model-value="emit('targetSizeInput', Number($event))"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>KB</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
        <p class="text-xs leading-5 text-muted-foreground">
          JPEG 和 WebP 会先自动调整质量，仍超出目标时等比例缩小尺寸；PNG 仅缩小尺寸。
        </p>
      </TabsContent>
    </Tabs>
  </div>
</template>
