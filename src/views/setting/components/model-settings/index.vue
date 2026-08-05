<script setup lang="ts">
import { computed } from 'vue';
import { Cpu, Image as ImageIcon, Zap } from '@lucide/vue';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { SagStatusBadge } from '@/components/sag/status-badge';
import { useAppStore } from '@/stores/app';
import {
  CHAT_MODELS,
  CHAT_MODEL_DEFINITIONS,
  IMAGE_MODELS,
  isChatModel,
  isDeepSeekModel,
  isImageModel,
} from '@/types';
import type { ImageModel } from '@/types';

const appStore = useAppStore();

const imageModelLabels: Record<ImageModel, string> = {
  'gpt-image-2': 'GPT-Image-2',
};

const imageModel = computed({
  get: () => appStore.settings.imageModel,
  set: (value: string | number) => {
    if (isImageModel(value)) {
      appStore.updateSettings({ imageModel: value });
    }
  },
});

const generalModel = computed({
  get: () => appStore.settings.generalModel,
  set: (value: string | number) => {
    if (isChatModel(value)) {
      appStore.updateSettings({ generalModel: value });
      if (isDeepSeekModel(value)) {
        appStore.updateSettings({ deepseekModel: value });
      }
    }
  },
});

const fastModel = computed({
  get: () => appStore.settings.fastModel,
  set: (value: string | number) => {
    if (isChatModel(value)) {
      appStore.updateSettings({ fastModel: value });
    }
  },
});

const generalModelDefinition = computed(() => CHAT_MODEL_DEFINITIONS[generalModel.value]);
const fastModelDefinition = computed(() => CHAT_MODEL_DEFINITIONS[fastModel.value]);
</script>

<template>
  <section aria-labelledby="models-heading">
    <div class="mb-4">
      <h2 id="models-heading" class="text-base font-semibold">默认模型</h2>
      <p class="mt-1 text-sm text-muted-foreground">为不同任务选择默认模型。</p>
    </div>
    <div class="divide-y rounded-md border">
      <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <ImageIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 class="text-sm font-medium">生图模型</h3>
            <p class="mt-1.5 text-sm leading-5 text-muted-foreground">
              用于角色视觉、表情和插画生成。
            </p>
          </div>
        </div>
        <div class="w-full shrink-0 space-y-2 sm:w-64">
          <Label for="image-model">模型</Label>
          <Select v-model="imageModel">
            <SelectTrigger id="image-model" class="w-full">
              <span class="truncate">{{ imageModelLabels[imageModel] }}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="model in IMAGE_MODELS" :key="model" :value="model">
                {{ imageModelLabels[model] }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <Cpu class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 class="text-sm font-medium">通用模型</h3>
            <p class="mt-1.5 text-sm leading-5 text-muted-foreground">
              用于角色创建、故事和插画共创等主要对话任务。
            </p>
          </div>
        </div>
        <div class="w-full shrink-0 space-y-2 sm:w-64">
          <Label for="general-model">模型</Label>
          <Select v-model="generalModel">
            <SelectTrigger id="general-model" class="w-full">
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate">{{ generalModelDefinition.label }}</span>
                <SagStatusBadge v-if="generalModelDefinition.supportsImageInput" tone="info">
                  支持图片
                </SagStatusBadge>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="model in CHAT_MODELS" :key="model" :value="model">
                <span class="flex items-center gap-2">
                  <span>{{ CHAT_MODEL_DEFINITIONS[model].label }}</span>
                  <SagStatusBadge
                    v-if="CHAT_MODEL_DEFINITIONS[model].supportsImageInput"
                    tone="info"
                  >
                    支持图片
                  </SagStatusBadge>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <Zap class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 class="text-sm font-medium">快速模型</h3>
            <p class="mt-1.5 text-sm leading-5 text-muted-foreground">
              用于动作、表情等短提示词生成，优先响应速度。
            </p>
          </div>
        </div>
        <div class="w-full shrink-0 space-y-2 sm:w-64">
          <Label for="fast-model">模型</Label>
          <Select v-model="fastModel">
            <SelectTrigger id="fast-model" class="w-full">
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate">{{ fastModelDefinition.label }}</span>
                <SagStatusBadge v-if="fastModelDefinition.supportsImageInput" tone="info">
                  支持图片
                </SagStatusBadge>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="model in CHAT_MODELS" :key="model" :value="model">
                <span class="flex items-center gap-2">
                  <span>{{ CHAT_MODEL_DEFINITIONS[model].label }}</span>
                  <SagStatusBadge
                    v-if="CHAT_MODEL_DEFINITIONS[model].supportsImageInput"
                    tone="info"
                  >
                    支持图片
                  </SagStatusBadge>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  </section>
</template>
