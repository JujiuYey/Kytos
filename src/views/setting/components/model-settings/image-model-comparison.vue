<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SagStatusBadge } from '@/components/sag/status-badge';
import { cn } from '@/lib/utils';
import { IMAGE_MODEL_DEFINITIONS, IMAGE_MODELS } from '@/types';
import type { ImageModel } from '@/types';
import { getImageModelLimits } from './image-model-display';
import type { ImageModelLimit, ImageModelLimits } from './image-model-display';

interface ComparisonCell {
  // 比最宽松的模型更严的限制，在表里标成黄色
  stricter?: boolean;
  text: string;
}

interface ComparisonRow {
  cells: Record<ImageModel, ComparisonCell>;
  label: string;
}

const props = defineProps<{
  // 当前选中的模型，它在表里的那一列会高亮
  selected: ImageModel;
}>();

function cellsOf(read: (model: ImageModel) => ComparisonCell): Record<ImageModel, ComparisonCell> {
  const cells = {} as Record<ImageModel, ComparisonCell>;
  for (const model of IMAGE_MODELS) {
    cells[model] = read(model);
  }
  return cells;
}

function textRow(label: string, read: (model: ImageModel) => string): ComparisonRow {
  return { cells: cellsOf(model => ({ text: read(model) })), label };
}

function limitRow(
  label: string,
  pick: (limits: ImageModelLimits) => ImageModelLimit,
): ComparisonRow {
  return {
    cells: cellsOf(model => {
      const limit = pick(getImageModelLimits(model));
      return { stricter: limit.stricter, text: limit.detail ?? limit.label };
    }),
    label,
  };
}

// 模型按列排：加一个模型只多一列，属性的行数不变
const rows: ComparisonRow[] = [
  textRow('特点', model => IMAGE_MODEL_DEFINITIONS[model].summary),
  limitRow('单次出图', limits => limits.count),
  limitRow('参考图', limits => limits.references),
  limitRow('清晰度', limits => limits.resolution),
  textRow('参考图提交', model =>
    IMAGE_MODEL_DEFINITIONS[model].acceptsDataUriReferences ? '直接提交' : '先上传成公网链接',
  ),
  textRow('输出格式', model => IMAGE_MODEL_DEFINITIONS[model].outputFormat),
  textRow('提示词处理', model => IMAGE_MODEL_DEFINITIONS[model].promptHandling),
  textRow('计费方式', model => IMAGE_MODEL_DEFINITIONS[model].billing),
];
</script>

<template>
  <div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-28">项目</TableHead>
          <TableHead
            v-for="model in IMAGE_MODELS"
            :key="model"
            scope="col"
            :class="
              cn(
                'min-w-36 whitespace-normal',
                model === props.selected && 'bg-accent/50 text-foreground',
              )
            "
          >
            {{ IMAGE_MODEL_DEFINITIONS[model].label }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="row in rows" :key="row.label">
          <TableCell class="font-medium">{{ row.label }}</TableCell>
          <TableCell
            v-for="model in IMAGE_MODELS"
            :key="model"
            class="whitespace-normal align-top"
            :class="model === props.selected && 'bg-accent/30'"
          >
            <SagStatusBadge v-if="row.cells[model].stricter" tone="warning">
              {{ row.cells[model].text }}
            </SagStatusBadge>
            <template v-else>{{ row.cells[model].text }}</template>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <p class="mt-3 text-xs leading-5 text-muted-foreground">
      信息来自各模型的接口文档，实际出图效果和速度没有实测。
    </p>
  </div>
</template>
