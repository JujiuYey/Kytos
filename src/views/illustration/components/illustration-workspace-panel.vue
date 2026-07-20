<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ChevronDown,
  ImagePlus,
  Images,
  Image as ImageIcon,
  Palette,
  PencilLine,
  Sparkles,
  Trash2,
} from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GenerationPollingStatus,
  type GenerationPollingStateMap,
} from '@/components/sag/generation-polling-status';
import { ImageViewer } from '@/components/sag/image-viewer';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import type {
  CharacterPortraitResolution,
  CharacterPortraitImage,
  ArtStyle,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
} from '@/types';
import { ILLUSTRATION_SIZES } from '@/types';

interface IllustrationCharacterReferencePreview {
  image: CharacterPortraitImage;
  label: string;
}

const props = defineProps<{
  apimartConfigured: boolean;
  artStyle: ArtStyle | null;
  artStyles: ArtStyle[];
  busy: boolean;
  characterReferences: IllustrationCharacterReferencePreview[];
  pollingStates: GenerationPollingStateMap;
  prompt: string;
  referencesReady: boolean;
  resolution: CharacterPortraitResolution;
  size: IllustrationSize;
  styleReference: CharacterPortraitImage | null;
  topic: IllustrationTopic;
}>();

const emit = defineEmits<{
  (event: 'delete-version', version: IllustrationVersion): void;
  (event: 'generate'): void;
  (event: 'manage-style'): void;
  (event: 'open-reference-picker'): void;
  (event: 'rename', title: string): void;
  (event: 'revise', version: IllustrationVersion): void;
  (event: 'update:prompt', value: string): void;
  (event: 'update:artStyleId', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: IllustrationSize): void;
  (event: 'update:useCharacter', value: boolean): void;
}>();

const promptOpen = ref(false);
const referenceAssets = computed(() => [
  ...(props.topic.useCharacter ? props.characterReferences : []),
  ...(props.artStyle ? [{ image: props.styleReference, label: props.artStyle.name }] : []),
]);
const activeStatuses = ['submitted', 'pending', 'processing'];
const planFields = computed(() => [
  { label: '主体', value: props.topic.brief.subject },
  { label: '动作', value: props.topic.brief.action },
  { label: '环境', value: props.topic.brief.environment },
  { label: '构图', value: props.topic.brief.composition },
  { label: '氛围', value: props.topic.brief.mood },
  { label: '风格', value: props.topic.brief.style },
  { label: '细节', value: props.topic.brief.details },
]);
const generateDisabled = computed(
  () =>
    props.busy ||
    !props.topic.ready ||
    !props.prompt.trim() ||
    !props.apimartConfigured ||
    !props.artStyle ||
    (props.topic.useCharacter && !props.referencesReady),
);

function isActive(version: IllustrationVersion): boolean {
  return activeStatuses.includes(version.status);
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
  if (title && title !== props.topic.title) {
    emit('rename', title);
  }
}
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="插画画面方案和版本">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-medium">画面方案</h2>
        <SagStatusBadge :tone="topic.ready ? 'success' : 'info'">
          {{ topic.ready ? '可生成' : '对话整理中' }}
        </SagStatusBadge>
      </div>
      <Badge variant="outline">{{ topic.versions.length }} 个版本</Badge>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <section class="space-y-4" aria-labelledby="illustration-topic-heading">
          <div class="space-y-2">
            <Label id="illustration-topic-heading" for="illustration-topic-title">主题名称</Label>
            <Input
              id="illustration-topic-title"
              :model-value="topic.title"
              maxlength="100"
              @change="handleTitleChange"
            />
          </div>

          <div class="space-y-2">
            <Label for="illustration-art-style">画风</Label>
            <Select
              :model-value="topic.artStyleId ?? undefined"
              :disabled="busy"
              @update:model-value="emit('update:artStyleId', String($event))"
            >
              <SelectTrigger id="illustration-art-style" class="w-full">
                <SelectValue placeholder="选择画风" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="style in artStyles" :key="style.id" :value="style.id">
                  {{ style.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            class="flex items-center justify-between gap-4 rounded-md border px-3 py-3 md:hidden"
          >
            <div>
              <Label for="illustration-mobile-use-character">使用当前角色</Label>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ referencesReady ? '正式角色视觉已就绪' : '需要先准备正式角色视觉' }}
              </p>
            </div>
            <Switch
              id="illustration-mobile-use-character"
              :model-value="topic.useCharacter"
              :disabled="busy"
              @update:model-value="emit('update:useCharacter', Boolean($event))"
            />
          </div>
        </section>

        <section aria-labelledby="illustration-references-heading">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 id="illustration-references-heading" class="text-sm font-medium">正式参考</h3>
            <SagStatusBadge :tone="artStyle ? 'success' : 'info'">
              {{ artStyle?.name || '未选择画风' }}
            </SagStatusBadge>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div
              v-for="asset in referenceAssets"
              :key="asset.label"
              class="min-w-0 overflow-hidden rounded-md border bg-muted/20"
            >
              <ImageViewer
                v-if="asset.image"
                :alt="asset.label"
                :src="asset.image.url"
                :title="asset.label"
                description="查看正式参考图"
              >
                <Button
                  variant="ghost"
                  class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                  :aria-label="`查看${asset.label}`"
                >
                  <AiImage
                    :alt="asset.label"
                    :src="asset.image.url"
                    class="aspect-[4/3] w-full rounded-none bg-background object-contain"
                  />
                </Button>
              </ImageViewer>
              <div
                v-else
                class="flex aspect-[4/3] items-center justify-center bg-background text-muted-foreground"
              >
                <ImageIcon class="size-4" />
              </div>
              <p class="truncate border-t px-2 py-1.5 text-center text-xs">{{ asset.label }}</p>
            </div>
          </div>
          <div :class="['mt-3 grid gap-2', topic.useCharacter && 'sm:grid-cols-2']">
            <Button
              v-if="topic.useCharacter"
              variant="outline"
              size="sm"
              @click="emit('open-reference-picker')"
            >
              <Images class="size-4" />
              {{ characterReferences.length ? '更换角色参考' : '选择角色参考' }}
            </Button>
            <Button variant="outline" size="sm" @click="emit('manage-style')">
              <Palette class="size-4" />
              管理画风
            </Button>
          </div>
          <p class="mt-2 text-xs leading-5 text-muted-foreground">
            {{
              topic.useCharacter
                ? '生成时使用已选角色参考和这张卡片选择的画风；已有版本可单独继续修改。'
                : '生成时使用这张卡片选择的画风；已有版本可单独继续修改。'
            }}
          </p>
        </section>

        <section aria-labelledby="illustration-plan-heading">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 id="illustration-plan-heading" class="text-sm font-medium">结构化方案</h3>
            <span class="text-xs text-muted-foreground">由对话自动整理</span>
          </div>
          <dl class="divide-y border-y text-sm">
            <div
              v-for="field in planFields"
              :key="field.label"
              class="grid grid-cols-[52px_minmax(0,1fr)] gap-3 py-3"
            >
              <dt class="text-muted-foreground">{{ field.label }}</dt>
              <dd class="whitespace-pre-wrap break-words">
                {{ field.value || '尚未确定' }}
              </dd>
            </div>
          </dl>
        </section>

        <Collapsible v-model:open="promptOpen">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="w-full justify-between px-0 hover:bg-transparent">
              <span class="text-sm font-medium">最终提示词</span>
              <ChevronDown :class="['size-4 transition-transform', promptOpen && 'rotate-180']" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="pt-2">
            <Textarea
              :model-value="prompt"
              class="min-h-52 resize-y text-sm leading-6"
              maxlength="20000"
              placeholder="画面方案完成后会在这里生成最终提示词"
              @update:model-value="emit('update:prompt', String($event))"
            />
            <p class="mt-2 text-right text-xs tabular-nums text-muted-foreground">
              {{ prompt.length }} / 20000
            </p>
          </CollapsibleContent>
        </Collapsible>

        <ImageOutputSettings
          id-prefix="illustration"
          :disabled="busy"
          :resolution="resolution"
          :size="size"
          :size-options="ILLUSTRATION_SIZES"
          @update:resolution="emit('update:resolution', $event)"
          @update:size="emit('update:size', $event as IllustrationSize)"
        />

        <section aria-labelledby="illustration-versions-heading">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 id="illustration-versions-heading" class="text-sm font-medium">生成版本</h3>
            <Images class="size-4 text-muted-foreground" />
          </div>

          <div v-if="topic.versions.length" class="space-y-5">
            <article
              v-for="version in topic.versions"
              :key="version.id"
              class="overflow-hidden rounded-md border"
            >
              <div class="flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="font-medium">V{{ version.versionNumber }}</span>
                  <span v-if="version.baseVersion" class="truncate text-muted-foreground">
                    基于 V{{
                      topic.versions.find(item => item.id === version.baseVersion?.versionId)
                        ?.versionNumber
                    }}
                  </span>
                  <span v-if="version.artStyleName" class="truncate text-muted-foreground">
                    {{ version.artStyleName }}
                  </span>
                </div>
                <SagStatusBadge
                  :tone="
                    isActive(version)
                      ? 'info'
                      : version.status === 'completed'
                        ? 'success'
                        : 'error'
                  "
                >
                  {{
                    isActive(version)
                      ? '生成中'
                      : version.status === 'completed'
                        ? '已完成'
                        : '未完成'
                  }}
                </SagStatusBadge>
              </div>

              <div v-if="isActive(version)" class="p-4">
                <p class="text-sm">GPT-Image-2 正在绘制</p>
                <GenerationPollingStatus
                  class="mt-3"
                  compact
                  :attempt="pollingStates[version.id]?.attempt ?? 0"
                  :phase="pollingStates[version.id]?.phase ?? 'waiting'"
                />
              </div>

              <div
                v-else-if="version.status === 'failed' || version.status === 'cancelled'"
                class="p-4"
              >
                <p class="text-sm text-destructive">
                  {{ version.errorMessage || '插画生成任务未完成' }}
                </p>
                <div class="mt-3 flex justify-end">
                  <Button size="sm" variant="ghost" @click="emit('delete-version', version)">
                    <Trash2 class="size-4" />
                    删除记录
                  </Button>
                </div>
              </div>

              <div v-else>
                <div v-for="image in version.images" :key="image.fileName">
                  <ImageViewer
                    :alt="`${topic.title} V${version.versionNumber}`"
                    :src="image.url"
                    :title="`${topic.title} V${version.versionNumber}`"
                    description="查看插画大图，可缩放和拖拽"
                  >
                    <Button
                      variant="ghost"
                      class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                    >
                      <AiImage
                        :alt="`${topic.title} V${version.versionNumber}`"
                        :src="image.url"
                        :class="[
                          getAspectClass(version.size),
                          'w-full rounded-none bg-muted/30 object-contain',
                        ]"
                      />
                    </Button>
                  </ImageViewer>
                  <div class="flex items-center justify-between gap-2 border-t px-3 py-2">
                    <span class="text-xs text-muted-foreground">
                      {{ version.size }} · {{ version.resolution.toUpperCase() }}
                    </span>
                    <div class="flex items-center gap-1">
                      <Button size="sm" variant="ghost" @click="emit('revise', version)">
                        <PencilLine class="size-4" />
                        基于此修改
                      </Button>
                      <TooltipProvider :delay-duration="300">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              size="icon"
                              variant="ghost"
                              class="size-8 text-muted-foreground hover:text-destructive"
                              aria-label="删除这个插画版本"
                              @click="emit('delete-version', version)"
                            >
                              <Trash2 class="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>删除版本</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="rounded-md border border-dashed px-5 py-8 text-center">
            <ImagePlus class="mx-auto size-5 text-muted-foreground" />
            <p class="mt-3 text-sm font-medium">还没有生成版本</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              先通过左侧对话完成画面方案，再明确点击生成。
            </p>
          </div>
        </section>
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button class="w-full" :disabled="generateDisabled" @click="emit('generate')">
        <Sparkles class="size-4" />
        {{ busy ? '正在生成插画' : '生成插画' }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        使用 GPT-Image-2，点击后将产生实际费用
      </p>
    </footer>
  </section>
</template>
