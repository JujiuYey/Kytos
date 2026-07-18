<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { StoryShot, StoryShotContent } from '@/types';
import { createEmptyStoryShotContent } from '@/types';

const props = defineProps<{
  busy: boolean;
  open: boolean;
  shot: StoryShot | null;
}>();

const emit = defineEmits<{
  (event: 'save', value: StoryShotContent): void;
  (event: 'update:open', value: boolean): void;
}>();

const draft = ref<StoryShotContent>(createEmptyStoryShotContent());
const canSave = computed(() =>
  Boolean(draft.value.title.trim() && draft.value.scene.trim() && draft.value.finalPrompt.trim()),
);

watch(
  () => [props.open, props.shot] as const,
  ([open, shot]) => {
    if (!open) {
      return;
    }
    draft.value = shot
      ? {
          action: shot.action,
          composition: shot.composition,
          continuity: shot.continuity,
          emotion: shot.emotion,
          finalPrompt: shot.finalPrompt,
          narration: shot.narration,
          purpose: shot.purpose,
          scene: shot.scene,
          title: shot.title,
        }
      : createEmptyStoryShotContent();
  },
  { immediate: true },
);

function save(): void {
  if (!canSave.value || props.busy) {
    return;
  }
  emit('save', {
    ...draft.value,
    action: draft.value.action.trim(),
    composition: draft.value.composition.trim(),
    continuity: draft.value.continuity.trim(),
    emotion: draft.value.emotion.trim(),
    finalPrompt: draft.value.finalPrompt.trim(),
    narration: draft.value.narration.trim(),
    purpose: draft.value.purpose.trim(),
    scene: draft.value.scene.trim(),
    title: draft.value.title.trim(),
  });
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex h-[82vh] max-h-[860px] max-w-4xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader class="shrink-0 border-b px-6 py-5">
        <DialogTitle>{{ shot ? `编辑第 ${shot.order} 镜` : '新增分镜' }}</DialogTitle>
        <DialogDescription>调整画面叙事和最终生图依据，不会自动产生费用。</DialogDescription>
      </DialogHeader>

      <ScrollArea class="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div class="grid gap-5 px-6 py-5 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <Label for="story-shot-title">分镜标题</Label>
            <Input id="story-shot-title" v-model="draft.title" maxlength="100" />
          </div>
          <div class="space-y-2">
            <Label for="story-shot-purpose">叙事作用</Label>
            <Textarea
              id="story-shot-purpose"
              v-model="draft.purpose"
              class="min-h-24 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2">
            <Label for="story-shot-scene">场景</Label>
            <Textarea
              id="story-shot-scene"
              v-model="draft.scene"
              class="min-h-24 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2">
            <Label for="story-shot-action">动作</Label>
            <Textarea
              id="story-shot-action"
              v-model="draft.action"
              class="min-h-24 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2">
            <Label for="story-shot-emotion">情绪</Label>
            <Textarea
              id="story-shot-emotion"
              v-model="draft.emotion"
              class="min-h-24 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="story-shot-composition">镜头与构图</Label>
            <Textarea
              id="story-shot-composition"
              v-model="draft.composition"
              class="min-h-24 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="story-shot-continuity">连续性</Label>
            <Textarea
              id="story-shot-continuity"
              v-model="draft.continuity"
              class="min-h-24 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="story-shot-narration">旁白</Label>
            <Textarea
              id="story-shot-narration"
              v-model="draft.narration"
              class="min-h-20 resize-y"
              maxlength="20000"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <Label for="story-shot-prompt">最终提示词</Label>
            <Textarea
              id="story-shot-prompt"
              v-model="draft.finalPrompt"
              class="min-h-44 resize-y text-sm leading-6"
              maxlength="20000"
            />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="relative z-10 shrink-0 border-t bg-background px-6 py-4">
        <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="busy || !canSave" @click="save">
          {{ busy ? '正在保存' : '保存分镜' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
