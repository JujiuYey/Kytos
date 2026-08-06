<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExportFormat } from './types';

defineProps<{
  exportFormat: ExportFormat;
}>();

const emit = defineEmits<{
  (event: 'update:exportFormat', value: ExportFormat): void;
}>();
</script>

<template>
  <div class="space-y-3 border-t pt-5">
    <div class="text-sm font-medium">格式</div>
    <div class="space-y-1">
      <Select
        :model-value="exportFormat"
        @update:model-value="emit('update:exportFormat', $event as ExportFormat)"
      >
        <SelectTrigger id="export-format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="png">PNG · 无损导出</SelectItem>
          <SelectItem value="jpeg">JPEG · 体积更小</SelectItem>
          <SelectItem value="webp">WebP · 推荐</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
