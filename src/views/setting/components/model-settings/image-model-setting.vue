<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { ChevronDown, Image as ImageIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SagStatusBadge } from '@/components/sag/status-badge';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app';
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_DEFINITIONS, IMAGE_MODELS, isImageModel } from '@/types';
import type { ImageModel } from '@/types';
import ImageModelComparison from './image-model-comparison.vue';
import { getImageModelBadges } from './image-model-display';

const appStore = useAppStore();

const imageModel = computed(() => appStore.settings.imageModel);

function selectImageModel(value: string) {
  if (isImageModel(value)) {
    appStore.updateSettings({ imageModel: value });
  }
}

// 对比表默认收起，想逐项比较时再展开
const comparisonOpen = shallowRef(false);

// 整行是一个 label，点哪里都能选中；键盘聚焦到行内的单选项时，整行显示聚焦环
const rowClass =
  'flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-transparent p-3 transition-colors cursor-pointer hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';
const selectedRowClass = 'border-primary bg-accent/50';

const radioId = (model: ImageModel) => `image-model-option-${model}`;
</script>

<template>
  <div class="p-5">
    <div class="flex min-w-0 items-start gap-3">
      <ImageIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <h3 id="image-model-heading" class="text-sm font-medium">生图模型</h3>
        <p class="mt-1.5 text-sm leading-5 text-muted-foreground">
          用于角色锚点、表情和插画生成。黄色标签表示比其他模型更严的限制。
        </p>
      </div>
    </div>

    <RadioGroup
      class="mt-4 gap-1.5"
      :model-value="imageModel"
      aria-labelledby="image-model-heading"
      @update:model-value="selectImageModel"
    >
      <Label
        v-for="model in IMAGE_MODELS"
        :key="model"
        :for="radioId(model)"
        :class="cn(rowClass, model === imageModel && selectedRowClass)"
      >
        <RadioGroupItem :id="radioId(model)" :value="model" class="mt-0.5" />
        <span class="min-w-0 flex-1 basis-60">
          <span class="flex flex-wrap items-center gap-x-2 leading-5">
            <span>{{ IMAGE_MODEL_DEFINITIONS[model].label }}</span>
            <SagStatusBadge v-if="model === DEFAULT_IMAGE_MODEL" tone="info">默认</SagStatusBadge>
          </span>
          <span class="mt-1 block font-normal leading-5 text-muted-foreground">
            {{ IMAGE_MODEL_DEFINITIONS[model].summary }}
          </span>
        </span>
        <span class="flex flex-wrap items-center gap-1.5">
          <SagStatusBadge
            v-for="badge in getImageModelBadges(model)"
            :key="badge.label"
            :tone="badge.stricter ? 'warning' : 'neutral'"
          >
            {{ badge.label }}
          </SagStatusBadge>
        </span>
      </Label>
    </RadioGroup>

    <Collapsible v-model:open="comparisonOpen" class="mt-2">
      <CollapsibleTrigger as-child>
        <Button variant="ghost" size="sm" class="-ml-2 text-muted-foreground">
          {{ comparisonOpen ? '收起全部对比' : '展开全部对比' }}
          <ChevronDown :class="cn('transition-transform', comparisonOpen && 'rotate-180')" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent class="pt-2">
        <ImageModelComparison :selected="imageModel" />
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
