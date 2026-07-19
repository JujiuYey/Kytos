<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, Images } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES } from '@/types';
import type { ExpressionReferenceOption, ExpressionReferenceSource } from '../expression-reference';

type ReferenceFilter = 'all' | ExpressionReferenceSource;

const props = defineProps<{
  busy: boolean;
  open: boolean;
  options: ExpressionReferenceOption[];
  selectedKeys: string[];
}>();

const emit = defineEmits<{
  (event: 'confirm', options: ExpressionReferenceOption[]): void;
  (event: 'update:open', value: boolean): void;
}>();

const filter = ref<ReferenceFilter>('all');
const draftKeys = ref<string[]>([]);
const filteredOptions = computed(() =>
  filter.value === 'all'
    ? props.options
    : props.options.filter(option => option.source === filter.value),
);
const visualCount = computed(
  () => props.options.filter(option => option.source === 'visual').length,
);
const expressionCount = computed(
  () => props.options.filter(option => option.source === 'expression').length,
);

function toggleOption(option: ExpressionReferenceOption): void {
  if (draftKeys.value.includes(option.key)) {
    draftKeys.value = draftKeys.value.filter(key => key !== option.key);
    return;
  }
  if (draftKeys.value.length >= MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES) {
    return;
  }
  draftKeys.value = [...draftKeys.value, option.key];
}

function confirmSelection(): void {
  const selectedKeySet = new Set(draftKeys.value);
  emit(
    'confirm',
    props.options.filter(option => selectedKeySet.has(option.key)),
  );
  emit('update:open', false);
}

watch(
  () => props.open,
  open => {
    if (open) {
      draftKeys.value = [...props.selectedKeys];
      filter.value = 'all';
    }
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex h-[76vh] max-h-[820px] max-w-4xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader class="shrink-0 border-b px-5 py-4">
        <div class="flex items-center gap-2">
          <DialogTitle>选择角色参考</DialogTitle>
          <Badge variant="secondary">
            {{ draftKeys.length }} / {{ MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES }}
          </Badge>
        </div>
        <DialogDescription>
          可以混选当前角色的视觉资产和已有表情，生成时只使用这里确认的图片。
        </DialogDescription>
      </DialogHeader>

      <div class="flex shrink-0 border-b px-5 py-3">
        <Tabs :model-value="filter" @update:model-value="filter = $event as ReferenceFilter">
          <TabsList>
            <TabsTrigger value="all">全部 {{ options.length }}</TabsTrigger>
            <TabsTrigger value="visual">视觉资产 {{ visualCount }}</TabsTrigger>
            <TabsTrigger value="expression">已有表情 {{ expressionCount }}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea class="min-h-0 flex-1">
        <div
          v-if="filteredOptions.length"
          class="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4"
        >
          <article v-for="option in filteredOptions" :key="option.key" class="min-w-0">
            <Button
              variant="outline"
              :aria-label="`${draftKeys.includes(option.key) ? '取消选择' : '选择'}${option.label}`"
              :aria-pressed="draftKeys.includes(option.key)"
              :disabled="
                busy ||
                (!draftKeys.includes(option.key) &&
                  draftKeys.length >= MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES)
              "
              :class="[
                'relative block h-auto w-full overflow-hidden rounded-md p-0 focus-visible:ring-inset',
                draftKeys.includes(option.key) && 'border-primary ring-2 ring-primary/20',
              ]"
              @click="toggleOption(option)"
            >
              <AiImage
                :alt="option.label"
                :src="option.image.url"
                class="aspect-square w-full rounded-md bg-muted/30 object-contain"
              />
              <span
                v-if="draftKeys.includes(option.key)"
                class="absolute right-2 top-2 flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-sm"
              >
                <Check class="size-3.5" />
              </span>
            </Button>
            <h3 class="mt-2 truncate text-sm font-medium">{{ option.label }}</h3>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ option.detail }}</p>
          </article>
        </div>

        <div v-else class="flex min-h-64 items-center justify-center px-6 py-12">
          <div class="max-w-sm text-center">
            <Images class="mx-auto size-6 text-muted-foreground" />
            <h3 class="mt-3 text-sm font-medium">没有可选参考</h3>
            <p class="mt-1 text-sm text-muted-foreground">当前分类中还没有已完成的图片。</p>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="shrink-0 border-t px-5 py-4">
        <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="busy" @click="confirmSelection"> 确认选择 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
