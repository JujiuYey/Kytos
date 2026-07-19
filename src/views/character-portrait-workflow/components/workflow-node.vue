<script setup lang="ts">
import { computed } from 'vue';
import { FileText, Image as ImageIcon, Images, WandSparkles } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import {
  Node as AiNode,
  NodeContent,
  NodeDescription,
  NodeFooter,
  NodeHeader,
  NodeTitle,
} from '@/components/ai-elements/node';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { WorkflowNodeData, WorkflowRunStatus } from '../workflow-types';

const props = defineProps<{
  data: WorkflowNodeData;
  generateDisabled?: boolean;
  selected: boolean;
}>();

const emit = defineEmits<{
  (event: 'generate'): void;
}>();

const icon = computed(() => {
  if (props.data.kind === 'asset') {
    return Images;
  }
  if (props.data.kind === 'prompt') {
    return FileText;
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
      source: data.kind !== 'result',
      target: data.kind === 'generator' || data.kind === 'result',
    }"
    :class="[
      'w-72 overflow-hidden shadow-sm transition-[border-color,box-shadow]',
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
                ? '正式资产'
                : data.kind === 'prompt'
                  ? '生成描述'
                  : data.kind === 'generator'
                    ? 'GPT-Image-2'
                    : '生成结果'
            }}
          </NodeDescription>
        </div>
      </div>
    </NodeHeader>

    <NodeContent v-if="data.kind === 'asset'" class="p-3">
      <AiImage
        :alt="data.label"
        :src="data.image.url"
        class="aspect-[4/3] w-full bg-muted/30 object-contain"
      />
      <p class="mt-2 truncate text-xs text-muted-foreground">{{ data.image.name || data.label }}</p>
    </NodeContent>

    <NodeContent v-else-if="data.kind === 'prompt'" class="p-3">
      <p class="line-clamp-5 text-xs leading-5 text-muted-foreground">
        {{ data.prompt }}
      </p>
    </NodeContent>

    <NodeContent v-else-if="data.kind === 'generator'" class="space-y-3 p-3">
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="truncate font-medium">{{ data.name }}</span>
        <Badge variant="outline">{{ data.resolution.toUpperCase() }} · 16:9</Badge>
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
