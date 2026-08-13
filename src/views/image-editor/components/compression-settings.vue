<script setup lang="ts">
import { ref, watch } from 'vue';
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

const props = defineProps<{
  compressionMode: CompressionMode;
  quality: number;
  targetSizeKb: number;
}>();

const emit = defineEmits<{
  (event: 'update:compressionMode', value: CompressionMode): void;
  (event: 'qualityInput', value: number): void;
  (event: 'targetSizeInput', value: number): void;
}>();

const qualityText = ref(String(props.quality));
const targetSizeText = ref(String(props.targetSizeKb));
let syncingQuality = false;
let syncingTargetSize = false;

watch(
  () => props.quality,
  value => {
    if (syncingQuality) {
      syncingQuality = false;
      return;
    }
    qualityText.value = String(value);
  },
);

watch(
  () => props.targetSizeKb,
  value => {
    if (syncingTargetSize) {
      syncingTargetSize = false;
      return;
    }
    targetSizeText.value = String(value);
  },
);

function parseStrictNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function handleQualityInput(value: string | number): void {
  const text = String(value);
  qualityText.value = text;
  const parsed = parseStrictNumber(text);
  if (parsed === null) return;
  syncingQuality = true;
  emit('qualityInput', parsed);
}

function handleTargetSizeInput(value: string | number): void {
  const text = String(value);
  targetSizeText.value = text;
  const parsed = parseStrictNumber(text);
  if (parsed === null) return;
  syncingTargetSize = true;
  emit('targetSizeInput', parsed);
}
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
            :model-value="qualityText"
            type="number"
            min="10"
            max="100"
            @update:model-value="handleQualityInput"
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
              :model-value="targetSizeText"
              type="number"
              min="10"
              max="102400"
              @update:model-value="handleTargetSizeInput"
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
