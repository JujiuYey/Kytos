<script setup lang="ts">
import { Image as ImageIcon, Images, WandSparkles } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterVisualResolution } from '@/types';
import { MAX_CHARACTER_REFERENCE_IMAGES } from '@/types';
import type { WorkflowAssetOption, WorkflowNode } from '../workflow-types';

defineProps<{
  assetOptions: WorkflowAssetOption[];
  generateDisabled: boolean;
  node: WorkflowNode | null;
  referenceCount: number;
}>();

const emit = defineEmits<{
  (event: 'generate'): void;
  (event: 'update-asset', value: string): void;
  (event: 'update-name', value: string): void;
  (event: 'update-prompt', value: string): void;
  (event: 'update-resolution', value: CharacterVisualResolution): void;
}>();
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col bg-background" aria-label="节点属性">
    <div class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Images v-if="node?.data.kind === 'asset'" class="size-4" />
      <WandSparkles v-else-if="node?.data.kind === 'generator'" class="size-4" />
      <ImageIcon v-else class="size-4" />
      <h2 class="truncate text-sm font-medium">{{ node?.data.label || '未选择节点' }}</h2>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="!node" class="flex min-h-48 items-center justify-center px-6">
        <p class="text-sm text-muted-foreground">未选择节点</p>
      </div>

      <div v-else-if="node.data.kind === 'asset'" class="space-y-6 p-4">
        <div class="space-y-2">
          <Label for="workflow-asset">参考图资产</Label>
          <Select
            :model-value="node.data.assetKey"
            @update:model-value="emit('update-asset', String($event))"
          >
            <SelectTrigger id="workflow-asset" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="asset in assetOptions" :key="asset.key" :value="asset.key">
                {{ asset.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AiImage
          :alt="node.data.label"
          :src="node.data.image.url"
          class="aspect-[4/3] w-full border bg-muted/30 object-contain"
        />
        <dl class="space-y-2 text-xs">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">类型</dt>
            <dd>角色锚点</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">状态</dt>
            <dd><Badge variant="outline">正式资产</Badge></dd>
          </div>
        </dl>
      </div>

      <div v-else-if="node.data.kind === 'generator'" class="space-y-6 p-4">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">已连接参考图</span>
          <Badge variant="secondary">
            {{ referenceCount }} / {{ MAX_CHARACTER_REFERENCE_IMAGES }}
          </Badge>
        </div>
        <div class="space-y-2">
          <Label for="workflow-name">图片名称</Label>
          <Input
            id="workflow-name"
            :model-value="node.data.name"
            maxlength="80"
            @update:model-value="emit('update-name', String($event))"
          />
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <Label for="workflow-prompt">图片提示词</Label>
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ node.data.prompt.length }} / 20000
            </span>
          </div>
          <Textarea
            id="workflow-prompt"
            :model-value="node.data.prompt"
            class="min-h-64 resize-none text-sm leading-6"
            maxlength="20000"
            @update:model-value="emit('update-prompt', String($event))"
          />
        </div>
        <ImageOutputSettings
          fixed-size="16:9"
          id-prefix="workflow"
          :resolution="node.data.resolution"
          :title="null"
          @update:resolution="emit('update-resolution', $event)"
        />
      </div>

      <div v-else class="space-y-4 p-4">
        <AiImage
          v-if="node.data.image"
          :alt="node.data.label"
          :src="node.data.image.url"
          class="aspect-video w-full border bg-muted/30 object-contain"
        />
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">状态</span>
          <Badge variant="outline">
            {{ node.data.status === 'completed' ? '已保存到资产库' : '等待生成' }}
          </Badge>
        </div>
      </div>
    </ScrollArea>

    <footer v-if="node?.data.kind === 'generator'" class="shrink-0 border-t p-4">
      <Button class="w-full" :disabled="generateDisabled" @click="emit('generate')">
        <WandSparkles class="size-4" />
        {{
          node.data.status === 'submitted' ||
          node.data.status === 'pending' ||
          node.data.status === 'processing'
            ? '正在生成图片'
            : `生成“${node.data.name}”`
        }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">点击后将产生实际费用</p>
    </footer>
  </aside>
</template>
