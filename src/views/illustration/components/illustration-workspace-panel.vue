<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ChevronDown,
  ImagePlus,
  Images,
  Image as ImageIcon,
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GenerationPollingStatus,
  type GenerationPollingStateMap,
} from '@/components/sag/generation-polling-status';
import { ImageViewer } from '@/components/sag/image-viewer';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type {
  CharacterVisualResolution,
  CharacterVisualImage,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
} from '@/types';
import { ILLUSTRATION_SIZES } from '@/types';

interface IllustrationReferencePreview {
  detail: string;
  image: CharacterVisualImage;
  key: string;
  label: string;
}

const props = defineProps<{
  apimartConfigured: boolean;
  busy: boolean;
  chatBusy: boolean;
  references: IllustrationReferencePreview[];
  pollingStates: GenerationPollingStateMap;
  prompt: string;
  revisionActive: boolean;
  revisionLabel: string | null;
  revisionReady: boolean;
  revisionVersionId: string | null;
  resolution: CharacterVisualResolution;
  selectedVersionId: string | null;
  size: IllustrationSize;
  topic: IllustrationTopic;
}>();

const emit = defineEmits<{
  (event: 'delete-version', version: IllustrationVersion): void;
  (event: 'generate'): void;
  (event: 'open-reference-picker'): void;
  (event: 'rename', title: string): void;
  (event: 'revise', version: IllustrationVersion): void;
  (event: 'select-version', version: IllustrationVersion): void;
  (event: 'update:prompt', value: string): void;
  (event: 'update:resolution', value: CharacterVisualResolution): void;
  (event: 'update:size', value: IllustrationSize): void;
}>();

const promptOpen = ref(false);
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
    props.chatBusy ||
    !props.topic.ready ||
    !props.prompt.trim() ||
    !props.apimartConfigured ||
    (props.revisionActive && !props.revisionReady),
);
const selectedVersion = computed(
  () =>
    props.topic.versions.find(version => version.id === props.selectedVersionId) ??
    props.topic.versions[0] ??
    null,
);

function isActive(version: IllustrationVersion): boolean {
  return activeStatuses.includes(version.status);
}

function getBaseVersionNumber(version: IllustrationVersion): number | null {
  if (!version.baseVersion) return null;
  return (
    props.topic.versions.find(item => item.id === version.baseVersion?.versionId)?.versionNumber ??
    null
  );
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
        </section>

        <section aria-labelledby="illustration-current-version-heading">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 id="illustration-current-version-heading" class="text-sm font-medium">当前成品</h3>
            <SagStatusBadge
              v-if="selectedVersion"
              :tone="
                isActive(selectedVersion)
                  ? 'info'
                  : selectedVersion.status === 'completed'
                    ? 'success'
                    : 'error'
              "
            >
              {{
                isActive(selectedVersion)
                  ? '生成中'
                  : selectedVersion.status === 'completed'
                    ? '已完成'
                    : '未完成'
              }}
            </SagStatusBadge>
          </div>

          <div v-if="selectedVersion" class="overflow-hidden rounded-md border">
            <div class="flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
              <div class="flex min-w-0 items-center gap-2">
                <span class="font-medium">V{{ selectedVersion.versionNumber }}</span>
                <span
                  v-if="getBaseVersionNumber(selectedVersion)"
                  class="truncate text-muted-foreground"
                >
                  基于 V{{ getBaseVersionNumber(selectedVersion) }}
                </span>
              </div>
              <span class="shrink-0 text-muted-foreground">
                {{ selectedVersion.size }} · {{ selectedVersion.resolution.toUpperCase() }}
              </span>
            </div>

            <div v-if="isActive(selectedVersion)" class="p-4">
              <p class="text-sm">GPT-Image-2 正在绘制</p>
              <GenerationPollingStatus
                class="mt-3"
                compact
                :phase="pollingStates[selectedVersion.id]?.phase ?? 'waiting'"
                :progress="selectedVersion.progress"
                :status="selectedVersion.status"
              />
            </div>

            <div
              v-else-if="
                selectedVersion.status === 'failed' || selectedVersion.status === 'cancelled'
              "
              class="p-4"
            >
              <p class="text-sm text-destructive">
                {{ selectedVersion.errorMessage || '插画生成任务未完成' }}
              </p>
            </div>

            <template v-else-if="selectedVersion.images[0]">
              <ImageViewer
                :alt="`${topic.title} V${selectedVersion.versionNumber}`"
                :src="selectedVersion.images[0].url"
                :title="`${topic.title} V${selectedVersion.versionNumber}`"
                description="查看插画大图，可缩放和拖拽"
              >
                <Button
                  variant="ghost"
                  class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                >
                  <AiImage
                    :alt="`${topic.title} V${selectedVersion.versionNumber}`"
                    :src="selectedVersion.images[0].url"
                    class="h-72 w-full rounded-none bg-muted/30 object-contain"
                  />
                </Button>
              </ImageViewer>
            </template>

            <div class="flex flex-wrap items-center justify-end gap-1 border-t px-3 py-2">
              <Button
                v-if="selectedVersion.status === 'completed' && selectedVersion.images.length"
                size="sm"
                :variant="revisionVersionId === selectedVersion.id ? 'secondary' : 'ghost'"
                @click="emit('revise', selectedVersion)"
              >
                <PencilLine class="size-4" />
                {{
                  revisionVersionId === selectedVersion.id
                    ? `返回对话调整 V${selectedVersion.versionNumber}`
                    : `继续调整 V${selectedVersion.versionNumber}`
                }}
              </Button>
              <TooltipProvider v-if="!isActive(selectedVersion)" :delay-duration="300">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-8 text-muted-foreground hover:text-destructive"
                      :aria-label="`删除 V${selectedVersion.versionNumber}`"
                      @click="emit('delete-version', selectedVersion)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除版本</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div
            v-else
            class="flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed px-5 text-center"
          >
            <ImagePlus class="size-5 text-muted-foreground" />
            <p class="mt-3 text-sm font-medium">还没有生成版本</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              完成画面方案后，生成结果会直接显示在这里。
            </p>
          </div>

          <div v-if="topic.versions.length > 1" class="mt-3">
            <p class="mb-2 text-xs text-muted-foreground">历史版本</p>
            <ScrollArea class="w-full pb-2">
              <div class="flex w-max gap-2 pb-2">
                <Button
                  v-for="version in topic.versions"
                  :key="version.id"
                  :variant="selectedVersion?.id === version.id ? 'secondary' : 'outline'"
                  class="h-auto w-24 shrink-0 flex-col items-stretch gap-0 overflow-hidden p-0"
                  :aria-label="`查看 V${version.versionNumber}`"
                  :aria-pressed="selectedVersion?.id === version.id"
                  @click="emit('select-version', version)"
                >
                  <AiImage
                    v-if="version.images[0]"
                    :alt="`${topic.title} V${version.versionNumber}`"
                    :src="version.images[0].url"
                    class="aspect-[4/3] w-full rounded-none bg-muted/30 object-cover"
                  />
                  <div
                    v-else
                    class="flex aspect-[4/3] w-full items-center justify-center bg-muted/30"
                  >
                    <ImageIcon class="size-4 text-muted-foreground" />
                  </div>
                  <span class="w-full border-t px-2 py-1.5 text-xs"
                    >V{{ version.versionNumber }}</span
                  >
                </Button>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </section>

        <section aria-labelledby="illustration-references-heading">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 id="illustration-references-heading" class="text-sm font-medium">画面素材</h3>
            <SagStatusBadge :tone="references.length ? 'success' : 'info'">
              {{ references.length ? `${references.length} 项素材` : '未添加素材' }}
            </SagStatusBadge>
          </div>
          <div v-if="references.length" class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div
              v-for="asset in references"
              :key="asset.key"
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
              <p class="truncate border-t px-2 py-1 text-center text-[11px] text-muted-foreground">
                {{ asset.detail }}
              </p>
            </div>
          </div>
          <div
            v-else
            class="flex min-h-24 items-center justify-center border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
          >
            可以直接创作，也可以加入角色、已有插画或上传图作为画面素材。
          </div>
          <Button class="mt-3" variant="outline" size="sm" @click="emit('open-reference-picker')">
            <Images class="size-4" />
            {{ references.length ? '管理画面素材' : '添加画面素材' }}
          </Button>
          <p class="mt-2 text-xs leading-5 text-muted-foreground">
            角色、已有插画和上传图会在本次生成中作为参考；生成版本会保存这次选择的素材。
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
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button class="w-full" :disabled="generateDisabled" @click="emit('generate')">
        <Sparkles class="size-4" />
        {{
          busy ? '正在生成插画' : revisionLabel ? `基于 ${revisionLabel} 生成新版本` : '生成插画'
        }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        {{
          revisionActive && !revisionReady
            ? '先在左侧对话中说明要调整的内容'
            : '使用 GPT-Image-2，点击后将产生实际费用'
        }}
      </p>
    </footer>
  </section>
</template>
