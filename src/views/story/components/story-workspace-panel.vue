<script setup lang="ts">
import { computed } from 'vue';
import { Clapperboard, Image as ImageIcon, Images } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagStatusBadge } from '@/components/sag/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  CharacterVisualResolution,
  IllustrationSize,
  StoryProject,
  StoryShot,
  StoryShotVersion,
  StoryVersionReference,
  IllustrationReference,
} from '@/types';
import type { ImageReferencePickerOption } from '@/components/sag/image-reference-picker-dialog';
import StoryStoryboardCanvas from './story-storyboard-canvas.vue';

const props = defineProps<{
  apimartConfigured: boolean;
  assetsReady: boolean;
  busy: boolean;
  pollingStates: GenerationPollingStateMap;
  story: StoryProject;
  submittingShotIds: string[];
  tab: 'story' | 'storyboard' | 'final';
  referenceOptions: Array<ImageReferencePickerOption & { reference: IllustrationReference }>;
  characterNames: string[];
}>();

const emit = defineEmits<{
  (event: 'add-shot'): void;
  (event: 'confirm-storyboard'): void;
  (event: 'configure-service'): void;
  (event: 'delete-shot', shot: StoryShot): void;
  (event: 'delete-version', payload: { shot: StoryShot; version: StoryShotVersion }): void;
  (event: 'edit-shot', shot: StoryShot): void;
  (event: 'generate-remaining'): void;
  (event: 'generate-shot', shot: StoryShot): void;
  (event: 'manage-assets'): void;
  (event: 'manage-characters'): void;
  (event: 'open-references', shot: StoryShot | null): void;
  (event: 'move-shot', payload: { direction: -1 | 1; shot: StoryShot }): void;
  (event: 'rename', title: string): void;
  (event: 'select-version', payload: { shot: StoryShot; version: StoryShotVersion }): void;
  (event: 'set-base', payload: { reference: StoryVersionReference; shot: StoryShot }): void;
  (event: 'set-key-shot', shot: StoryShot): void;
  (event: 'update:resolution', value: CharacterVisualResolution): void;
  (event: 'update:size', value: IllustrationSize): void;
  (event: 'update:tab', value: 'story' | 'storyboard' | 'final'): void;
}>();

const draftFields = computed(() => [
  { label: '故事前提', value: props.story.draft.premise },
  { label: '发生地点', value: props.story.draft.setting },
  { label: '主角目标', value: props.story.draft.goal },
  { label: '变化冲突', value: props.story.draft.conflict },
  { label: '关键转折', value: props.story.draft.turningPoint },
  { label: '故事结尾', value: props.story.draft.ending },
  { label: '情绪基调', value: props.story.draft.tone },
]);
const finalShotCount = computed(() =>
  props.story.storyboardStale
    ? 0
    : props.story.shots.filter(shot => shot.selectedVersionId && !shot.imageStale).length,
);
const structureLocked = computed(
  () =>
    props.busy ||
    props.story.shots.some(shot =>
      shot.versions.some(version =>
        ['submitted', 'pending', 'processing'].includes(version.status),
      ),
    ),
);
function getSelectedVersion(shot: StoryShot): StoryShotVersion | null {
  return shot.versions.find(version => version.id === shot.selectedVersionId) ?? null;
}

function getSelectedImageUrl(shot: StoryShot): string {
  return getSelectedVersion(shot)?.images[0]?.url ?? '';
}

function getSelectedSize(shot: StoryShot): IllustrationSize {
  return getSelectedVersion(shot)?.size ?? props.story.size;
}

function getAspectClass(size: IllustrationSize): string {
  return {
    '1:1': 'aspect-square',
    '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16]',
  }[size];
}

function handleTitleChange(event: Event): void {
  const title = (event.target as HTMLInputElement).value.trim();
  if (title && title !== props.story.title) {
    emit('rename', title);
  }
}
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="故事、分镜和正式画面">
    <Tabs
      :model-value="tab"
      class="min-h-0 flex-1 gap-0"
      @update:model-value="emit('update:tab', $event as 'story' | 'storyboard' | 'final')"
    >
      <div class="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
        <TabsList class="h-8">
          <TabsTrigger value="story">故事</TabsTrigger>
          <TabsTrigger value="storyboard">分镜 {{ story.shots.length }}</TabsTrigger>
          <TabsTrigger value="final"
            >成片 {{ finalShotCount }}/{{ story.shots.length }}</TabsTrigger
          >
        </TabsList>
        <SagStatusBadge
          :tone="story.storyboardStale ? 'warning' : story.storyboardReady ? 'success' : 'info'"
        >
          {{
            story.storyboardStale
              ? '分镜待检查'
              : story.storyboardReady
                ? '可生成'
                : story.storyReady
                  ? '等待分镜'
                  : '故事整理中'
          }}
        </SagStatusBadge>
      </div>

      <TabsContent value="story" class="mt-0 min-h-0 overflow-hidden">
        <ScrollArea class="h-full">
          <div class="space-y-7 px-5 py-5">
            <section class="space-y-2" aria-labelledby="story-title-heading">
              <Label id="story-title-heading" for="story-title">故事名称</Label>
              <Input
                id="story-title"
                :model-value="story.title"
                :disabled="structureLocked"
                maxlength="100"
                @change="handleTitleChange"
              />
            </section>

            <section class="border-y py-4" aria-labelledby="story-reference-heading">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 id="story-reference-heading" class="text-sm font-medium">故事默认参考</h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    新镜头默认继承；可在分镜画布里单独覆盖。
                  </p>
                </div>
                <SagStatusBadge :tone="story.references.length ? 'success' : 'info'">
                  {{ story.references.length ? `${story.references.length} 张` : '使用角色锚点' }}
                </SagStatusBadge>
              </div>
              <Button
                class="mt-3 w-full"
                variant="outline"
                size="sm"
                @click="emit('open-references', null)"
              >
                <Images class="size-4" />
                {{ story.references.length ? '管理默认参考' : '添加默认参考' }}
              </Button>
            </section>

            <section class="border-b pb-4" aria-labelledby="story-characters-heading">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <h3 id="story-characters-heading" class="text-sm font-medium">参演角色</h3>
                  <p class="mt-1 truncate text-xs text-muted-foreground">
                    {{ characterNames.length ? characterNames.join('、') : '尚未选择角色' }}
                  </p>
                </div>
                <Button size="sm" variant="outline" @click="emit('manage-characters')">
                  管理
                </Button>
              </div>
            </section>

            <section aria-labelledby="story-summary-heading">
              <div class="mb-3 flex items-center justify-between gap-3">
                <h3 id="story-summary-heading" class="text-sm font-medium">故事定稿</h3>
                <SagStatusBadge :tone="story.storyReady ? 'success' : 'info'">
                  {{ story.storyReady ? '已确认' : '对话整理中' }}
                </SagStatusBadge>
              </div>
              <p class="whitespace-pre-wrap text-sm leading-6">
                {{ story.draft.summary || '故事信息足够后，Agent 会在这里整理完整短篇。' }}
              </p>
            </section>

            <section aria-labelledby="story-structure-heading">
              <div class="mb-3 flex items-center justify-between gap-3">
                <h3 id="story-structure-heading" class="text-sm font-medium">故事结构</h3>
                <span class="text-xs text-muted-foreground">由对话自动整理</span>
              </div>
              <dl class="divide-y border-y text-sm">
                <div
                  v-for="field in draftFields"
                  :key="field.label"
                  class="grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-3"
                >
                  <dt class="text-muted-foreground">{{ field.label }}</dt>
                  <dd class="whitespace-pre-wrap break-words">{{ field.value || '尚未确定' }}</dd>
                </div>
              </dl>
            </section>

            <section class="border-t pt-5" aria-labelledby="story-next-heading">
              <h3 id="story-next-heading" class="text-sm font-medium">下一步</h3>
              <p class="mt-2 text-xs leading-5 text-muted-foreground">
                故事确认后，在左侧告诉 Agent“拆成分镜”，它会整理 3 至 6 个连续画面。
              </p>
              <Button
                class="mt-3 w-full"
                variant="outline"
                :disabled="!story.storyReady"
                @click="emit('update:tab', 'storyboard')"
              >
                <Clapperboard class="size-4" />
                查看文字分镜
              </Button>
            </section>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent
        value="storyboard"
        class="mt-0 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
      >
        <StoryStoryboardCanvas
          :apimart-configured="apimartConfigured"
          :assets-ready="assetsReady"
          :busy="busy"
          :polling-states="pollingStates"
          :reference-options="referenceOptions"
          :story="story"
          :submitting-shot-ids="submittingShotIds"
          @add-shot="emit('add-shot')"
          @configure-service="emit('configure-service')"
          @confirm-storyboard="emit('confirm-storyboard')"
          @delete-shot="emit('delete-shot', $event)"
          @delete-version="emit('delete-version', $event)"
          @edit-shot="emit('edit-shot', $event)"
          @generate-remaining="emit('generate-remaining')"
          @generate-shot="emit('generate-shot', $event)"
          @manage-assets="emit('manage-assets')"
          @move-shot="emit('move-shot', $event)"
          @open-references="emit('open-references', $event)"
          @select-version="emit('select-version', $event)"
          @set-base="emit('set-base', $event)"
          @set-key-shot="emit('set-key-shot', $event)"
          @update:resolution="emit('update:resolution', $event)"
          @update:size="emit('update:size', $event)"
        />
      </TabsContent>

      <TabsContent value="final" class="mt-0 min-h-0 overflow-hidden">
        <ScrollArea class="h-full">
          <div class="space-y-5 px-5 py-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-medium">连续成片</h3>
                <p class="mt-1 text-xs text-muted-foreground">按分镜顺序展示已确认的正式画面</p>
              </div>
              <Badge variant="outline">{{ finalShotCount }}/{{ story.shots.length }}</Badge>
            </div>

            <article
              v-for="shot in story.shots"
              :key="shot.id"
              class="overflow-hidden rounded-md border"
            >
              <div class="flex items-center justify-between gap-3 border-b px-3 py-2">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="text-xs tabular-nums text-muted-foreground">{{ shot.order }}</span>
                  <h4 class="truncate text-sm font-medium">{{ shot.title }}</h4>
                </div>
                <SagStatusBadge v-if="story.storyboardStale || shot.imageStale" tone="warning">
                  待更新
                </SagStatusBadge>
              </div>
              <template v-if="getSelectedImageUrl(shot)">
                <ImageViewer
                  :alt="shot.title"
                  :src="getSelectedImageUrl(shot)"
                  :title="shot.title"
                  description="查看正式分镜大图"
                >
                  <Button variant="ghost" class="block h-auto w-full rounded-none p-0">
                    <AiImage
                      :alt="shot.title"
                      :src="getSelectedImageUrl(shot)"
                      :class="[
                        getAspectClass(getSelectedSize(shot)),
                        'w-full rounded-none bg-muted/20 object-contain',
                      ]"
                    />
                  </Button>
                </ImageViewer>
              </template>
              <div
                v-else
                class="flex aspect-video flex-col items-center justify-center gap-2 bg-muted/20 px-4 text-center"
              >
                <ImageIcon class="size-5 text-muted-foreground" />
                <p class="text-xs text-muted-foreground">这一镜还没有正式画面</p>
              </div>
              <p v-if="shot.narration" class="border-t px-3 py-3 text-sm leading-6">
                {{ shot.narration }}
              </p>
            </article>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </section>
</template>
