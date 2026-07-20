<script setup lang="ts">
import { computed } from 'vue';
import { Image as ImageIcon, Images, Trash2, WandSparkles } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import {
  Node as AiNode,
  NodeAction,
  NodeContent,
  NodeDescription,
  NodeFooter,
  NodeHeader,
  NodeTitle,
} from '@/components/ai-elements/node';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { MAX_CHARACTER_SHEET_REFERENCE_IMAGES } from '@/types';
import type { WorkflowNodeData, WorkflowRunStatus } from '../workflow-types';

const props = defineProps<{
  data: WorkflowNodeData;
  deletable?: boolean;
  generateDisabled?: boolean;
  referenceCount?: number;
  selected: boolean;
}>();

const emit = defineEmits<{
  (event: 'delete'): void;
  (event: 'generate'): void;
  (event: 'update-prompt', value: string): void;
}>();

const icon = computed(() => {
  if (props.data.kind === 'asset') {
    return Images;
  }
  if (props.data.kind === 'generator') {
    return WandSparkles;
  }
  return ImageIcon;
});

function statusLabel(status: WorkflowRunStatus): string {
  if (status === 'submitted' || status === 'pending') {
    return '等待处理';
  }
  if (status === 'processing') {
    return '生成中';
  }
  if (status === 'completed') {
    return '已完成';
  }
  if (status === 'failed' || status === 'cancelled') {
    return '未完成';
  }
  return '待运行';
}
</script>

<template>
  <AiNode
    :handles="{
      source: data.kind === 'asset' || data.kind === 'generator',
      sourceConnectableEnd: false,
      sourceConnectableStart: data.kind === 'asset',
      target: data.kind === 'generator' || data.kind === 'result',
      targetConnectableEnd: data.kind === 'generator',
      targetConnectableStart: false,
    }"
    :class="[
      'w-72 shadow-sm transition-[border-color,box-shadow] [&_.vue-flow__handle]:z-10 [&_.vue-flow__handle]:size-3 [&_.vue-flow__handle]:border-2 [&_.vue-flow__handle]:border-background [&_.vue-flow__handle]:bg-foreground',
      selected && 'border-primary ring-2 ring-primary/15',
    ]"
  >
    <NodeHeader class="bg-muted/60">
      <div class="flex min-w-0 items-center gap-2">
        <div
          class="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background"
        >
          <component :is="icon" class="size-3.5" />
        </div>
        <div class="min-w-0">
          <NodeTitle class="truncate text-sm">{{ data.label }}</NodeTitle>
          <NodeDescription>
            {{
              data.kind === 'asset'
                ? '参考图 · 正式资产'
                : data.kind === 'generator'
                  ? 'GPT-Image-2'
                  : '生成结果'
            }}
          </NodeDescription>
        </div>
      </div>
      <NodeAction v-if="deletable">
        <Button
          size="icon"
          variant="ghost"
          class="nodrag nowheel size-7"
          aria-label="删除参考图节点"
          @click.stop="emit('delete')"
        >
          <Trash2 class="size-3.5" />
        </Button>
      </NodeAction>
    </NodeHeader>

    <NodeContent v-if="data.kind === 'asset'" class="p-3">
      <AiImage
        :alt="data.label"
        :src="data.image.url"
        class="aspect-[4/3] w-full bg-muted/30 object-contain"
      />
      <p class="mt-2 truncate text-xs text-muted-foreground">{{ data.image.name || data.label }}</p>
    </NodeContent>

    <NodeContent v-else-if="data.kind === 'generator'" class="space-y-3 p-3">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="truncate font-medium">{{ data.name }}</span>
        <div class="flex items-center gap-1.5">
          <Badge variant="secondary">
            参考图 {{ referenceCount || 0 }} / {{ MAX_CHARACTER_SHEET_REFERENCE_IMAGES }}
          </Badge>
          <Badge variant="outline">{{ data.resolution.toUpperCase() }} · 16:9</Badge>
        </div>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>图片提示词</span>
          <span class="tabular-nums">{{ data.prompt.length }} / 20000</span>
        </div>
        <Textarea
          :model-value="data.prompt"
          class="nodrag nowheel min-h-24 resize-none text-xs leading-5"
          maxlength="20000"
          @click.stop
          @update:model-value="emit('update-prompt', String($event))"
        />
      </div>
      <div v-if="data.status !== 'idle'" class="space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>{{ statusLabel(data.status) }}</span>
          <span class="tabular-nums">{{ data.progress }}%</span>
        </div>
        <Progress :model-value="data.progress" class="h-1.5" />
      </div>
      <p v-if="data.errorMessage" class="text-xs leading-5 text-destructive">
        {{ data.errorMessage }}
      </p>
    </NodeContent>

    <NodeFooter v-if="data.kind === 'generator'" class="p-2.5!">
      <Button
        size="sm"
        class="nodrag nowheel w-full"
        :disabled="generateDisabled"
        @click.stop="emit('generate')"
      >
        <WandSparkles class="size-4" />
        {{
          data.status === 'submitted' || data.status === 'pending' || data.status === 'processing'
            ? '正在生成'
            : '运行生成节点'
        }}
      </Button>
    </NodeFooter>

    <NodeContent v-if="data.kind === 'result'" class="p-3">
      <AiImage
        v-if="data.image"
        :alt="data.label"
        :src="data.image.url"
        class="aspect-video w-full bg-muted/30 object-contain"
      />
      <div
        v-else
        class="flex aspect-video items-center justify-center rounded-md border border-dashed bg-muted/20"
      >
        <Badge variant="outline">{{ statusLabel(data.status) }}</Badge>
      </div>
      <p v-if="data.errorMessage" class="mt-2 text-xs leading-5 text-destructive">
        {{ data.errorMessage }}
      </p>
    </NodeContent>
  </AiNode>
</template>
