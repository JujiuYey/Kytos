<script setup lang="ts">
import { computed } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Image as ImageIcon,
  Images,
  Link2,
  Palette,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Star,
  Trash2,
} from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import {
  GenerationPollingStatus,
  type GenerationPollingStateMap,
} from '@/components/sag/generation-polling-status';
import { ImageViewer } from '@/components/sag/image-viewer';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import SagStatusBadge from '@/components/sag/status-badge.vue';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  ArtStyle,
  CharacterPortraitResolution,
  IllustrationSize,
  StoryProject,
  StoryShot,
  StoryShotVersion,
  StoryVersionReference,
} from '@/types';
import { ILLUSTRATION_SIZES, STORY_SHOT_LIMITS } from '@/types';

const props = defineProps<{
  apimartConfigured: boolean;
  artStyles: ArtStyle[];
  assetsReady: boolean;
  busy: boolean;
  characterAssetsReady: boolean;
  pollingStates: GenerationPollingStateMap;
  story: StoryProject;
  submittingShotIds: string[];
  tab: 'story' | 'storyboard' | 'final';
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
  (event: 'manage-style'): void;
  (event: 'move-shot', payload: { direction: -1 | 1; shot: StoryShot }): void;
  (event: 'rename', title: string): void;
  (event: 'select-version', payload: { shot: StoryShot; version: StoryShotVersion }): void;
  (event: 'set-base', payload: { reference: StoryVersionReference; shot: StoryShot }): void;
  (event: 'set-key-shot', shot: StoryShot): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:artStyleId', value: string): void;
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
const keyShot = computed(() => props.story.shots.find(shot => shot.id === props.story.keyShotId));
const keyShotSelected = computed(() => Boolean(keyShot.value?.selectedVersionId));
const remainingShots = computed(() =>
  props.story.shots.filter(
    shot => !shot.selectedVersionId && !shot.versions.some(version => isActive(version)),
  ),
);
const finalShotCount = computed(() =>
  props.story.storyboardStale
    ? 0
    : props.story.shots.filter(shot => shot.selectedVersionId && !shot.imageStale).length,
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

function isActive(version: StoryShotVersion): boolean {
  return ['submitted', 'pending', 'processing'].includes(version.status);
}

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

function canGenerateShot(shot: StoryShot): boolean {
  const keyReady = shot.id === props.story.keyShotId || keyShotSelected.value;
  return (
    props.apimartConfigured &&
    props.assetsReady &&
    props.story.storyboardReady &&
    !props.story.storyboardStale &&
    Boolean(shot.finalPrompt.trim()) &&
    keyReady &&
    !props.busy &&
    !props.submittingShotIds.includes(shot.id) &&
    !shot.versions.some(version => isActive(version))
  );
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
        <ScrollArea class="min-h-0 flex-1">
          <div class="space-y-5 px-5 py-5">
            <section aria-labelledby="story-output-heading">
              <div class="mb-3 flex items-center justify-between gap-3">
                <h3 id="story-output-heading" class="text-sm font-medium">统一输出</h3>
                <SagStatusBadge :tone="apimartConfigured && assetsReady ? 'success' : 'error'">
                  {{
                    !apimartConfigured
                      ? '缺少 API Key'
                      : !characterAssetsReady
                        ? '缺少角色参考'
                        : !story.artStyleId
                          ? '未选择画风'
                          : '参考就绪'
                  }}
                </SagStatusBadge>
              </div>
              <div class="mb-3 space-y-2">
                <Label for="story-art-style">画风</Label>
                <div class="flex gap-2">
                  <Select
                    :model-value="story.artStyleId ?? undefined"
                    :disabled="structureLocked"
                    @update:model-value="emit('update:artStyleId', String($event))"
                  >
                    <SelectTrigger id="story-art-style" class="min-w-0 flex-1">
                      <SelectValue placeholder="选择画风" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="style in artStyles" :key="style.id" :value="style.id">
                        {{ style.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="管理画风"
                    @click="emit('manage-style')"
                  >
                    <Palette class="size-4" />
                  </Button>
                </div>
              </div>
              <ImageOutputSettings
                id-prefix="story"
                :disabled="structureLocked"
                :resolution="story.resolution"
                :size="story.size"
                :size-options="ILLUSTRATION_SIZES"
                @update:resolution="emit('update:resolution', $event)"
                @update:size="emit('update:size', $event as IllustrationSize)"
              />
              <Button
                v-if="!characterAssetsReady"
                variant="outline"
                size="sm"
                class="mt-3 w-full"
                @click="emit('manage-assets')"
              >
                <Palette class="size-4" />
                准备角色视觉
              </Button>
              <Button
                v-if="!apimartConfigured"
                variant="outline"
                size="sm"
                class="mt-3 w-full"
                @click="emit('configure-service')"
              >
                <Settings2 class="size-4" />
                配置图片生成服务
              </Button>
            </section>

            <div
              v-if="story.storyboardStale"
              class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3"
            >
              <p class="text-sm font-medium text-destructive">故事已经变化，当前分镜需要重新检查</p>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                在左侧对话中让 Agent 根据新故事逐镜调整，确认前不会允许继续生图。
              </p>
              <Button
                size="sm"
                variant="outline"
                class="mt-3 w-full"
                :disabled="structureLocked || !story.storyReady || !story.storyboardReady"
                @click="emit('confirm-storyboard')"
              >
                <Check class="size-4" />
                确认当前分镜
              </Button>
            </div>

            <div v-if="story.shots.length" class="space-y-4">
              <article
                v-for="shot in story.shots"
                :key="shot.id"
                class="overflow-hidden rounded-md border"
              >
                <header class="flex items-center justify-between gap-3 border-b px-3 py-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="text-xs font-medium tabular-nums">{{ shot.order }}</span>
                    <h3 class="truncate text-sm font-medium">{{ shot.title || '未命名分镜' }}</h3>
                    <SagStatusBadge v-if="shot.id === story.keyShotId" tone="info">
                      <Star class="size-3" />
                      关键帧
                    </SagStatusBadge>
                    <SagStatusBadge v-if="shot.imageStale" tone="warning">
                      画面待更新
                    </SagStatusBadge>
                  </div>
                  <div class="flex shrink-0 items-center gap-0.5">
                    <TooltipProvider :delay-duration="300">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="size-7"
                            :disabled="shot.order === 1 || structureLocked"
                            aria-label="向前移动分镜"
                            @click="emit('move-shot', { direction: -1, shot })"
                          >
                            <ArrowUp class="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>向前移动</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="size-7"
                            :disabled="shot.order === story.shots.length || structureLocked"
                            aria-label="向后移动分镜"
                            @click="emit('move-shot', { direction: 1, shot })"
                          >
                            <ArrowDown class="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>向后移动</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="size-7"
                            :disabled="shot.id === story.keyShotId || structureLocked"
                            aria-label="设为关键帧"
                            @click="emit('set-key-shot', shot)"
                          >
                            <Star class="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>设为关键帧</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="size-7"
                            :disabled="structureLocked"
                            aria-label="编辑分镜"
                            @click="emit('edit-shot', shot)"
                          >
                            <Pencil class="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>编辑分镜</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="size-7 text-muted-foreground hover:text-destructive"
                            :disabled="structureLocked"
                            aria-label="删除分镜"
                            @click="emit('delete-shot', shot)"
                          >
                            <Trash2 class="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>删除分镜</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </header>

                <div class="space-y-3 px-3 py-3 text-sm">
                  <p class="leading-6">{{ shot.scene || '场景尚未确定' }}</p>
                  <dl class="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt class="text-muted-foreground">叙事作用</dt>
                      <dd class="mt-1 leading-5">{{ shot.purpose || '尚未确定' }}</dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">动作与情绪</dt>
                      <dd class="mt-1 leading-5">
                        {{ [shot.action, shot.emotion].filter(Boolean).join('，') || '尚未确定' }}
                      </dd>
                    </div>
                  </dl>
                  <p
                    v-if="shot.narration"
                    class="border-l-2 pl-3 text-xs italic leading-5 text-muted-foreground"
                  >
                    {{ shot.narration }}
                  </p>
                </div>

                <div v-if="shot.versions.length" class="border-t px-3 py-3">
                  <div class="mb-2 flex items-center justify-between gap-3">
                    <span class="text-xs text-muted-foreground">生成版本</span>
                    <span class="text-xs tabular-nums text-muted-foreground">
                      {{ shot.versions.length }} 个
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div
                      v-for="version in shot.versions"
                      :key="version.id"
                      class="min-w-0 overflow-hidden rounded-md border"
                    >
                      <div
                        v-if="isActive(version)"
                        class="flex aspect-video items-center bg-muted/30 px-3"
                      >
                        <GenerationPollingStatus
                          compact
                          :attempt="pollingStates[version.id]?.attempt ?? 0"
                          :phase="pollingStates[version.id]?.phase ?? 'waiting'"
                        />
                      </div>
                      <div
                        v-else-if="version.status === 'failed' || version.status === 'cancelled'"
                        class="flex aspect-video flex-col items-center justify-center px-3 text-center"
                      >
                        <span class="text-xs text-destructive">生成未完成</span>
                      </div>
                      <ImageViewer
                        v-else-if="version.images[0]"
                        :alt="`${shot.title} V${version.versionNumber}`"
                        :src="version.images[0].url"
                        :title="`${shot.title} V${version.versionNumber}`"
                        description="查看分镜大图，可缩放和拖拽"
                      >
                        <Button
                          variant="ghost"
                          class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                          :aria-label="`查看${shot.title} V${version.versionNumber}`"
                        >
                          <AiImage
                            :alt="`${shot.title} V${version.versionNumber}`"
                            :src="version.images[0].url"
                            :class="[
                              getAspectClass(version.size),
                              'w-full rounded-none bg-muted/20 object-contain',
                            ]"
                          />
                        </Button>
                      </ImageViewer>
                      <div class="flex items-center justify-between gap-1 border-t px-2 py-1.5">
                        <SagStatusBadge
                          :tone="shot.selectedVersionId === version.id ? 'success' : 'neutral'"
                        >
                          V{{ version.versionNumber }}
                          <Check v-if="shot.selectedVersionId === version.id" class="size-3" />
                        </SagStatusBadge>
                        <div class="flex items-center gap-0.5">
                          <TooltipProvider :delay-duration="300">
                            <Tooltip v-if="version.status === 'completed' && version.images[0]">
                              <TooltipTrigger as-child>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  class="size-7"
                                  :disabled="structureLocked"
                                  aria-label="设为正式画面"
                                  @click="emit('select-version', { shot, version })"
                                >
                                  <Check class="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>设为正式画面</TooltipContent>
                            </Tooltip>
                            <Tooltip v-if="version.status === 'completed' && version.images[0]">
                              <TooltipTrigger as-child>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  class="size-7"
                                  :disabled="busy"
                                  aria-label="基于这个版本继续"
                                  @click="
                                    emit('set-base', {
                                      reference: {
                                        fileName: version.images[0].fileName,
                                        shotId: shot.id,
                                        versionId: version.id,
                                      },
                                      shot,
                                    })
                                  "
                                >
                                  <Link2 class="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>以此继续</TooltipContent>
                            </Tooltip>
                            <Tooltip v-if="!isActive(version)">
                              <TooltipTrigger as-child>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  class="size-7 text-muted-foreground hover:text-destructive"
                                  :disabled="structureLocked"
                                  aria-label="删除分镜版本"
                                  @click="emit('delete-version', { shot, version })"
                                >
                                  <Trash2 class="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>删除版本</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <footer
                  class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2"
                >
                  <span class="text-xs text-muted-foreground">
                    {{
                      shot.id !== story.keyShotId && !keyShotSelected
                        ? '请先确认关键帧'
                        : shot.selectedVersionId
                          ? '已选正式画面'
                          : '尚未选定画面'
                    }}
                  </span>
                  <Button
                    size="sm"
                    :variant="shot.selectedVersionId ? 'outline' : 'default'"
                    :disabled="!canGenerateShot(shot)"
                    @click="emit('generate-shot', shot)"
                  >
                    <Sparkles class="size-4" />
                    {{ shot.versions.length ? '生成新版本' : '生成这一镜' }}
                  </Button>
                </footer>
              </article>
            </div>

            <div v-else class="rounded-md border border-dashed px-5 py-10 text-center">
              <Clapperboard class="mx-auto size-5 text-muted-foreground" />
              <p class="mt-3 text-sm font-medium">还没有文字分镜</p>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                先确认故事，再在左侧让 Agent 将它拆成 3 至 6 个连续画面。
              </p>
            </div>

            <Button
              variant="outline"
              class="w-full"
              :disabled="structureLocked || story.shots.length >= STORY_SHOT_LIMITS.max"
              @click="emit('add-shot')"
            >
              <Plus class="size-4" />
              新增分镜
            </Button>
          </div>
        </ScrollArea>

        <footer v-if="story.shots.length" class="shrink-0 border-t bg-background px-5 py-4">
          <Button
            class="w-full"
            :disabled="!canGenerateRemaining"
            @click="emit('generate-remaining')"
          >
            <Images class="size-4" />
            {{
              keyShotSelected
                ? `生成剩余 ${remainingShots.length} 镜`
                : `先生成关键帧「${keyShot?.title || '第 1 镜'}」`
            }}
          </Button>
          <p class="mt-2 text-center text-xs text-muted-foreground">
            使用 GPT-Image-2，每个分镜都会产生一次实际费用
          </p>
        </footer>
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
