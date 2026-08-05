<script setup lang="ts">
import { computed } from 'vue';
import { Check, Sparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { CharacterVisualImage } from '@/types';
import {
  CHARACTER_DRAFT_PRESETS,
  CORE_DRAFT_FIELDS,
  type CharacterPromptDraft,
  type CoreDraftField,
} from '../workflow-data';

const props = defineProps<{
  candidates: CharacterVisualImage[];
  candidateExpectedCount: number;
  draft: CharacterPromptDraft;
  isGenerating: boolean;
  selectedCandidate: CharacterVisualImage | null;
  styleName: string;
}>();

const emit = defineEmits<{
  (event: 'generate'): void;
  (event: 'selectCandidate', image: CharacterVisualImage): void;
  (event: 'update:draft', value: CharacterPromptDraft): void;
}>();

const selectableFields = computed(() =>
  CORE_DRAFT_FIELDS.filter(
    (field): field is Exclude<CoreDraftField, 'overallStyleKeywords'> =>
      field !== 'overallStyleKeywords',
  ),
);

const fieldLabels: Record<Exclude<CoreDraftField, 'overallStyleKeywords'>, string> = {
  gender: '性别气质',
  age: '年龄段',
  hairstyle: '发型',
  hairColor: '发色',
  clothingStyle: '上装风格',
  bottomsStyle: '下装风格',
  characterMood: '角色气质',
  primaryColor: '主色',
};

function updateField(field: keyof CharacterPromptDraft, value: string): void {
  emit('update:draft', { ...props.draft, [field]: value });
}
</script>

<template>
  <section class="w-full space-y-7" aria-labelledby="prompt-heading">
    <div class="flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-end">
      <div>
        <p class="text-xs font-medium text-muted-foreground">当前画法：{{ styleName }}</p>
        <h3 id="prompt-heading" class="mt-1 text-lg font-semibold">选择人物的大方向</h3>
        <p class="mt-1 text-sm text-muted-foreground">未选择的细节会由系统补全，不需要逐项填写。</p>
      </div>
      <span class="text-xs text-muted-foreground">一次生成 4 张候选</span>
    </div>

    <div class="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      <div v-for="field in selectableFields" :key="field" class="space-y-2.5">
        <Label class="text-sm">{{ fieldLabels[field] }}</Label>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="option in CHARACTER_DRAFT_PRESETS[field]"
            :key="option.value"
            type="button"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 rounded-md px-2.5"
            :class="draft[field] === option.value && 'border-primary bg-primary/5 text-primary'"
            :aria-pressed="draft[field] === option.value"
            @click="updateField(field, draft[field] === option.value ? '' : option.value)"
          >
            <span
              v-if="option.color"
              class="size-3 rounded-full border border-black/10"
              :style="{ backgroundColor: option.color }"
              aria-hidden="true"
            />
            {{ option.label }}
          </Button>
        </div>
      </div>

      <div class="space-y-2.5 lg:col-span-2">
        <Label for="character-style-detail" class="text-sm"
          >一句话补充 <span class="text-muted-foreground">（可选）</span></Label
        >
        <Input
          id="character-style-detail"
          :model-value="draft.overallStyleKeywords"
          maxlength="200"
          placeholder="例如：戴圆框眼镜，整体更有书卷气"
          @update:model-value="updateField('overallStyleKeywords', String($event))"
        />
      </div>
    </div>

    <div class="flex justify-end border-t pt-5">
      <Button class="min-w-36 gap-2" :disabled="isGenerating" @click="emit('generate')">
        <Sparkles class="size-4" :class="isGenerating && 'animate-spin'" />
        {{ isGenerating ? '正在生成候选' : '生成 4 张候选' }}
      </Button>
    </div>

    <section
      v-if="isGenerating || candidates.length"
      class="border-t pt-7"
      aria-labelledby="candidate-heading"
    >
      <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="candidate-heading" class="text-base font-semibold">选择一张作为基底</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            {{
              isGenerating
                ? `已生成 ${candidates.length} / ${candidateExpectedCount} 张，后续结果会自动补齐。`
                : '选中后进入精修定稿。'
            }}
          </p>
        </div>
        <span
          v-if="selectedCandidate"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          <Check class="size-3.5" /> 已选基底
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton
          v-for="index in isGenerating
            ? Math.max(0, candidateExpectedCount - candidates.length)
            : 0"
          :key="`loading-${index}`"
          class="aspect-[3/4] w-full"
        />
        <Button
          v-for="(image, index) in candidates"
          :key="image.fileName"
          type="button"
          variant="outline"
          class="group h-auto min-h-0 w-full overflow-hidden rounded-md p-0 text-left"
          :class="
            selectedCandidate?.fileName === image.fileName &&
            'border-primary ring-2 ring-primary/20'
          "
          :aria-pressed="selectedCandidate?.fileName === image.fileName"
          :aria-label="`选择第 ${index + 1} 张候选图作为精修基底`"
          @click="emit('selectCandidate', image)"
        >
          <span class="relative block aspect-[3/4] w-full bg-muted/20">
            <img :src="image.url" :alt="`角色候选图 ${index + 1}`" class="size-full object-cover" />
            <span
              v-if="selectedCandidate?.fileName === image.fileName"
              class="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check class="size-3.5" />
            </span>
          </span>
        </Button>
      </div>
    </section>
  </section>
</template>
