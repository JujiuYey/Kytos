<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Handle, Position, type Edge, type Node } from '@vue-flow/core';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Images,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from '@lucide/vue';
import { Canvas } from '@/components/ai-elements/canvas';
import { Image as AiImage } from '@/components/ai-elements/image';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import {
  GenerationPollingStatus,
  type GenerationPollingStateMap,
} from '@/components/sag/generation-polling-status';
import type { ImageReferencePickerOption } from '@/components/sag/image-reference-picker-dialog';
import { SagStatusBadge } from '@/components/sag/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type {
  CharacterVisualResolution,
  IllustrationReference,
  IllustrationSize,
  StoryProject,
  StoryShot,
  StoryShotVersion,
  StoryVersionReference,
} from '@/types';
import { ILLUSTRATION_SIZES, MAX_ILLUSTRATION_REFERENCE_IMAGES, STORY_SHOT_LIMITS } from '@/types';

interface StoryReferenceOption extends ImageReferencePickerOption {
  reference: IllustrationReference;
}

const props = defineProps<{
  apimartConfigured: boolean;
  assetsReady: boolean;
  busy: boolean;
  pollingStates: GenerationPollingStateMap;
  referenceOptions: StoryReferenceOption[];
  story: StoryProject;
  submittingShotIds: string[];
}>();

const emit = defineEmits<{
  (event: 'add-shot'): void;
  (event: 'configure-service'): void;
  (event: 'confirm-storyboard'): void;
  (event: 'delete-shot', shot: StoryShot): void;
  (event: 'delete-version', payload: { shot: StoryShot; version: StoryShotVersion }): void;
  (event: 'edit-shot', shot: StoryShot): void;
  (event: 'generate-remaining'): void;
  (event: 'generate-shot', shot: StoryShot): void;
  (event: 'manage-assets'): void;
  (event: 'move-shot', payload: { direction: -1 | 1; shot: StoryShot }): void;
  (event: 'open-references', shot: StoryShot): void;
  (event: 'select-version', payload: { shot: StoryShot; version: StoryShotVersion }): void;
  (event: 'set-base', payload: { reference: StoryVersionReference; shot: StoryShot }): void;
  (event: 'set-key-shot', shot: StoryShot): void;
  (event: 'update:resolution', value: CharacterVisualResolution): void;
  (event: 'update:size', value: IllustrationSize): void;
}>();

const activeShotId = ref('');
const draftPrompt = ref('');
const activeShot = computed(
  () =>
    props.story.shots.find(shot => shot.id === activeShotId.value) ?? props.story.shots[0] ?? null,
);
const activeIndex = computed(() =>
  activeShot.value ? props.story.shots.findIndex(shot => shot.id === activeShot.value?.id) : -1,
);
const activeReferences = computed(() =>
  activeShot.value?.references.length ? activeShot.value.references : props.story.references,
);
const referenceOptionMap = computed(
  () => new Map(props.referenceOptions.map(option => [referenceKey(option.reference), option])),
);
const referencePreviews = computed(() =>
  activeReferences.value.flatMap(reference => {
    const option = referenceOptionMap.value.get(referenceKey(reference));
    return option ? [option] : [];
  }),
);
const previousShot = computed(() =>
  props.story.shots.find(shot => shot.order === (activeShot.value?.order ?? 0) - 1),
);
const continuityImage = computed(() => {
  const shot = previousShot.value;
  const version = shot?.versions.find(item => item.id === shot.selectedVersionId);
  return version?.images[0] ?? null;
});
const selectedVersion = computed(() => {
  const shot = activeShot.value;
  return (
    shot?.versions.find(version => version.id === shot.selectedVersionId) ??
    shot?.versions[0] ??
    null
  );
});
const keyShotSelected = computed(() =>
  Boolean(props.story.shots.find(shot => shot.id === props.story.keyShotId)?.selectedVersionId),
);
const remainingShots = computed(() =>
  props.story.shots.filter(
    shot => !shot.selectedVersionId && !shot.versions.some(version => isActive(version)),
  ),
);
const structureLocked = computed(
  () =>
    props.busy || props.story.shots.some(shot => shot.versions.some(version => isActive(version))),
);
const canGenerateRemaining = computed(
  () =>
    props.apimartConfigured &&
    props.assetsReady &&
    props.story.storyboardReady &&
    !props.story.storyboardStale &&
    keyShotSelected.value &&
    remainingShots.value.length > 0 &&
    !props.busy,
);
const canGenerate = computed(() => {
  const shot = activeShot.value;
  if (!shot) return false;
  const keyReady =
    shot.id === props.story.keyShotId ||
    Boolean(props.story.shots.find(item => item.id === props.story.keyShotId)?.selectedVersionId);
  return (
    props.apimartConfigured &&
    props.assetsReady &&
    props.story.storyboardReady &&
    !props.story.storyboardStale &&
    Boolean(draftPrompt.value.trim()) &&
    keyReady &&
    !props.busy &&
    !props.submittingShotIds.includes(shot.id) &&
    !shot.versions.some(version => isActive(version))
  );
});
const nodes = computed<Node[]>(() => {
  const result: Node[] = referencePreviews.value.map((option, index) => ({
    id: `reference-${option.key}`,
    type: 'reference',
    position: { x: 40, y: 40 + index * 132 },
    data: option,
    draggable: false,
  }));
  if (continuityImage.value) {
    result.push({
      id: 'continuity',
      type: 'continuity',
      position: { x: 330, y: 28 },
      data: { image: continuityImage.value, title: `第 ${previousShot.value?.order} 镜正式画面` },
      draggable: false,
    });
  }
  result.push({
    id: 'generator',
    type: 'generator',
    position: { x: 350, y: continuityImage.value ? 230 : 120 },
    data: {},
    draggable: false,
  });
  result.push({
    id: 'result',
    type: 'result',
    position: { x: 690, y: 120 },
    data: {},
    draggable: false,
  });
  return result;
});
const edges = computed<Edge[]>(() => {
  const result = referencePreviews.value.map(option => ({
    id: `reference-${option.key}-generator`,
    source: `reference-${option.key}`,
    target: 'generator',
  }));
  if (continuityImage.value)
    result.push({ id: 'continuity-generator', source: 'continuity', target: 'generator' });
  result.push({ id: 'generator-result', source: 'generator', target: 'result' });
  return result;
});

watch(
  () => [props.story.id, props.story.shots.map(shot => shot.id).join(',')] as const,
  () => {
    if (!props.story.shots.some(shot => shot.id === activeShotId.value)) {
      activeShotId.value = props.story.shots[0]?.id ?? '';
    }
  },
  { immediate: true },
);
watch(
  activeShot,
  shot => {
    draftPrompt.value = shot?.finalPrompt ?? '';
  },
  { immediate: true },
);

function referenceKey(reference: IllustrationReference): string {
  return reference.kind === 'illustration'
    ? `illustration:${reference.source}:${reference.uploadId ?? ''}:${reference.topicId ?? ''}:${reference.versionId ?? ''}:${reference.fileName}`
    : `${reference.kind}:${reference.characterId}:${reference.taskId}:${reference.fileName}`;
}

function isActive(version: StoryShotVersion): boolean {
  return ['submitted', 'pending', 'processing'].includes(version.status);
}

function moveSelection(direction: -1 | 1): void {
  const target = props.story.shots[activeIndex.value + direction];
  if (target) activeShotId.value = target.id;
}

function generate(): void {
  if (!activeShot.value || !canGenerate.value) return;
  emit('generate-shot', { ...activeShot.value, finalPrompt: draftPrompt.value.trim() });
}

function setBase(version: StoryShotVersion): void {
  const shot = activeShot.value;
  const image = version.images[0];
  if (!shot || !image) return;
  emit('set-base', {
    reference: { fileName: image.fileName, shotId: shot.id, versionId: version.id },
    shot,
  });
}
</script>

<template>
  <div
    v-if="story.shots.length"
    class="relative grid min-h-0 flex-1 grid-rows-[44px_minmax(0,1fr)_108px]"
  >
    <header class="flex min-w-0 items-center justify-between gap-3 border-b px-3">
      <div class="flex min-w-0 items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          class="size-7"
          :disabled="activeIndex <= 0"
          aria-label="上一镜"
          @click="moveSelection(-1)"
        >
          <ChevronLeft class="size-4" />
        </Button>
        <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
          {{ activeIndex + 1 }} / {{ story.shots.length }}
        </span>
        <h3 class="truncate text-sm font-medium">{{ activeShot?.title || '未命名分镜' }}</h3>
        <SagStatusBadge v-if="activeShot?.id === story.keyShotId" tone="info">
          <Star class="size-3" />关键帧
        </SagStatusBadge>
        <Button
          size="icon"
          variant="ghost"
          class="size-7"
          :disabled="activeIndex >= story.shots.length - 1"
          aria-label="下一镜"
          @click="moveSelection(1)"
        >
          <ChevronRight class="size-4" />
        </Button>
        <DropdownMenu v-if="activeShot">
          <DropdownMenuTrigger as-child>
            <Button
              size="icon"
              variant="ghost"
              class="size-8"
              :disabled="structureLocked"
              aria-label="更多分镜操作"
            >
              <MoreHorizontal class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              :disabled="activeShot.order === 1"
              @select="emit('move-shot', { direction: -1, shot: activeShot })"
            >
              <ArrowLeft class="size-4" />向前移动
            </DropdownMenuItem>
            <DropdownMenuItem
              :disabled="activeShot.order === story.shots.length"
              @select="emit('move-shot', { direction: 1, shot: activeShot })"
            >
              <ArrowRight class="size-4" />向后移动
            </DropdownMenuItem>
            <DropdownMenuItem
              :disabled="activeShot.id === story.keyShotId"
              @select="emit('set-key-shot', activeShot)"
            >
              <Star class="size-4" />设为关键帧
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              @select="emit('delete-shot', activeShot)"
            >
              <Trash2 class="size-4" />删除分镜
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          :disabled="!activeShot || busy"
          @click="activeShot && emit('open-references', activeShot)"
        >
          <Images class="size-4" />
          参考图 {{ activeReferences.length }}/{{ MAX_ILLUSTRATION_REFERENCE_IMAGES }}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="size-8"
          :disabled="!activeShot || busy"
          aria-label="编辑当前分镜"
          @click="activeShot && emit('edit-shot', activeShot)"
        >
          <Pencil class="size-4" />
        </Button>
      </div>
    </header>

    <div class="grid min-h-0 grid-cols-[minmax(0,1fr)_300px]">
      <div class="relative min-h-0 border-r bg-muted/10">
        <Canvas
          class="h-full"
          :nodes="nodes"
          :edges="edges"
          :min-zoom="0.55"
          :max-zoom="1.2"
          :nodes-connectable="false"
          :elements-selectable="false"
        >
          <template #node-reference="{ data }">
            <article class="w-40 overflow-hidden rounded-md border bg-background shadow-sm">
              <Handle type="source" :position="Position.Right" />
              <AiImage
                :src="data.image.url"
                :alt="data.label"
                class="h-20 w-full rounded-none bg-muted/20 object-contain"
              />
              <div class="border-t px-2 py-1.5">
                <p class="truncate text-xs font-medium">{{ data.label }}</p>
                <p class="truncate text-[10px] text-muted-foreground">{{ data.detail }}</p>
              </div>
            </article>
          </template>
          <template #node-continuity="{ data }">
            <article
              class="w-44 overflow-hidden rounded-md border border-dashed bg-background shadow-sm"
            >
              <Handle type="source" :position="Position.Bottom" />
              <AiImage
                :src="data.image.url"
                :alt="data.title"
                class="h-20 w-full rounded-none bg-muted/20 object-contain"
              />
              <p class="truncate border-t px-2 py-1.5 text-xs">连续性 · {{ data.title }}</p>
            </article>
          </template>
          <template #node-generator>
            <article class="w-60 rounded-md border bg-background p-3 shadow-sm">
              <Handle type="target" :position="Position.Left" />
              <Handle type="source" :position="Position.Right" />
              <div class="flex items-center gap-2">
                <Sparkles class="size-4" />
                <p class="text-sm font-medium">第 {{ activeShot?.order }} 镜生成器</p>
              </div>
              <p class="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                {{ draftPrompt || '请先完善当前镜头提示词' }}
              </p>
              <div class="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{{ story.size }}</span
                ><span>{{ story.resolution.toUpperCase() }}</span>
              </div>
            </article>
          </template>
          <template #node-result>
            <article class="w-56 overflow-hidden rounded-md border bg-background shadow-sm">
              <Handle type="target" :position="Position.Left" />
              <div
                v-if="selectedVersion && isActive(selectedVersion)"
                class="flex h-44 items-center bg-muted/20 px-4"
              >
                <GenerationPollingStatus
                  compact
                  :phase="pollingStates[selectedVersion.id]?.phase ?? 'waiting'"
                  :progress="selectedVersion.progress"
                  :status="selectedVersion.status"
                />
              </div>
              <template v-else-if="selectedVersion?.images[0]">
                <AiImage
                  :src="selectedVersion.images[0].url"
                  :alt="activeShot?.title || '当前分镜结果'"
                  class="h-40 w-full rounded-none bg-muted/20 object-contain"
                />
                <div class="flex items-center justify-between border-t px-2 py-1.5 text-xs">
                  <span>V{{ selectedVersion.versionNumber }}</span>
                  <SagStatusBadge
                    :tone="
                      activeShot?.selectedVersionId === selectedVersion.id ? 'success' : 'neutral'
                    "
                  >
                    {{
                      activeShot?.selectedVersionId === selectedVersion.id ? '正式画面' : '最新版本'
                    }}
                  </SagStatusBadge>
                </div>
              </template>
              <div
                v-else
                class="flex h-44 flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                <ImageIcon class="size-5" /><span class="text-xs">等待生成结果</span>
              </div>
            </article>
          </template>
        </Canvas>
      </div>

      <ScrollArea class="min-h-0">
        <aside class="space-y-5 p-4" aria-label="当前分镜属性">
          <section
            v-if="story.storyboardStale"
            class="rounded-md border border-destructive/40 bg-destructive/5 p-3"
          >
            <p class="text-sm font-medium text-destructive">当前分镜需要重新确认</p>
            <Button
              class="mt-3 w-full"
              size="sm"
              variant="outline"
              :disabled="structureLocked || !story.storyReady || !story.storyboardReady"
              @click="emit('confirm-storyboard')"
            >
              <Check class="size-4" />确认当前分镜
            </Button>
          </section>
          <section>
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-sm font-medium">镜头参考</h4>
              <span class="text-xs text-muted-foreground">{{
                activeShot?.references.length ? '单镜覆盖' : '继承故事'
              }}</span>
            </div>
            <div v-if="referencePreviews.length" class="mt-3 grid grid-cols-3 gap-1.5">
              <AiImage
                v-for="option in referencePreviews.slice(0, 6)"
                :key="option.key"
                :src="option.image.url"
                :alt="option.label"
                class="aspect-square w-full rounded-sm border bg-muted/20 object-contain"
              />
            </div>
            <Button
              class="mt-3 w-full"
              size="sm"
              variant="outline"
              :disabled="!activeShot || busy"
              @click="activeShot && emit('open-references', activeShot)"
            >
              <Images class="size-4" />管理本镜参考
            </Button>
          </section>
          <section class="space-y-2">
            <label class="text-sm font-medium" for="story-canvas-prompt">最终提示词</label>
            <Textarea
              id="story-canvas-prompt"
              v-model="draftPrompt"
              class="min-h-36 resize-none text-xs leading-5"
              maxlength="20000"
            />
          </section>
          <ImageOutputSettings
            id-prefix="story-canvas"
            :disabled="busy"
            :resolution="story.resolution"
            :size="story.size"
            :size-options="ILLUSTRATION_SIZES"
            @update:resolution="emit('update:resolution', $event)"
            @update:size="emit('update:size', $event as IllustrationSize)"
          />
          <Button
            v-if="!assetsReady"
            class="w-full"
            size="sm"
            variant="outline"
            @click="emit('manage-assets')"
          >
            <Images class="size-4" />准备角色锚点
          </Button>
          <Button
            v-if="!apimartConfigured"
            class="w-full"
            size="sm"
            variant="outline"
            @click="emit('configure-service')"
          >
            配置图片生成服务
          </Button>
          <Button class="w-full" :disabled="!canGenerate" @click="generate">
            <Sparkles class="size-4" />{{
              activeShot?.versions.length ? '生成新版本' : '生成这一镜'
            }}
          </Button>
          <section v-if="activeShot?.versions.length">
            <h4 class="mb-2 text-sm font-medium">版本</h4>
            <div class="space-y-2">
              <div
                v-for="version in activeShot.versions"
                :key="version.id"
                class="flex items-center gap-1"
              >
                <Button
                  variant="outline"
                  class="h-9 min-w-0 flex-1 justify-between px-3"
                  :disabled="version.status !== 'completed'"
                  @click="emit('select-version', { shot: activeShot, version })"
                >
                  <span>V{{ version.versionNumber }}</span>
                  <Check v-if="activeShot.selectedVersionId === version.id" class="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-9"
                  :disabled="version.status !== 'completed' || !version.images[0] || busy"
                  aria-label="基于此版本继续"
                  @click="setBase(version)"
                >
                  <Link2 class="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-9 text-muted-foreground hover:text-destructive"
                  :disabled="isActive(version) || busy"
                  aria-label="删除此版本"
                  @click="emit('delete-version', { shot: activeShot, version })"
                >
                  <Trash2 class="size-4" />
                </Button>
              </div>
            </div>
          </section>
        </aside>
      </ScrollArea>
    </div>

    <div class="border-t px-3 py-2">
      <ScrollArea class="w-full">
        <div class="flex w-max gap-2 pb-2">
          <Button
            v-for="shot in story.shots"
            :key="shot.id"
            :variant="activeShot?.id === shot.id ? 'secondary' : 'outline'"
            class="h-[76px] w-36 shrink-0 items-stretch justify-start gap-2 overflow-hidden px-2 py-2 text-left"
            @click="activeShotId = shot.id"
          >
            <AiImage
              v-if="shot.versions.find(v => v.id === shot.selectedVersionId)?.images[0]"
              :src="shot.versions.find(v => v.id === shot.selectedVersionId)?.images[0]?.url || ''"
              :alt="shot.title"
              class="aspect-square h-full rounded-sm bg-muted/20 object-cover"
            />
            <div
              v-else
              class="flex aspect-square h-full items-center justify-center rounded-sm bg-muted/30"
            >
              <ImageIcon class="size-4 text-muted-foreground" />
            </div>
            <span class="min-w-0"
              ><span class="block text-xs">第 {{ shot.order }} 镜</span
              ><span class="mt-1 block truncate text-[11px] text-muted-foreground">{{
                shot.title
              }}</span></span
            >
          </Button>
          <Button
            variant="outline"
            class="h-[76px] w-24 shrink-0 flex-col"
            :disabled="busy || story.shots.length >= STORY_SHOT_LIMITS.max"
            @click="emit('add-shot')"
            ><Plus class="size-4" />新增</Button
          >
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
    <div v-if="remainingShots.length" class="pointer-events-none absolute bottom-28 right-4">
      <Button
        class="pointer-events-auto shadow-sm"
        :disabled="!canGenerateRemaining"
        @click="emit('generate-remaining')"
      >
        <Images class="size-4" />生成剩余 {{ remainingShots.length }} 镜
      </Button>
    </div>
  </div>

  <div v-else class="flex min-h-0 flex-1 items-center justify-center p-6 text-center">
    <div class="max-w-sm">
      <ImageIcon class="mx-auto size-6 text-muted-foreground" />
      <h3 class="mt-3 text-sm font-medium">还没有文字分镜</h3>
      <p class="mt-1 text-sm leading-6 text-muted-foreground">
        先在故事对话中完成内容并拆分镜，也可以手动新增第一镜。
      </p>
      <Button class="mt-4" variant="outline" :disabled="busy" @click="emit('add-shot')">
        <Plus class="size-4" />新增分镜
      </Button>
    </div>
  </div>
</template>
