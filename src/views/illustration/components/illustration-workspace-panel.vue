<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ChevronDown,
  GitBranch,
  ImagePlus,
  Images,
  Link2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { ImageViewer } from '@/components/sag/image-viewer';
import type {
  CharacterPortraitResolution,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
} from '@/types';

const props = defineProps<{
  apimartConfigured: boolean;
  baseReference: IllustrationVersionReference | null;
  busy: boolean;
  prompt: string;
  referencesReady: boolean;
  resolution: CharacterPortraitResolution;
  size: IllustrationSize;
  topic: IllustrationTopic;
}>();

const emit = defineEmits<{
  (event: 'clear-base'): void;
  (event: 'delete-version', version: IllustrationVersion): void;
  (event: 'generate'): void;
  (event: 'rename', title: string): void;
  (event: 'select-base', reference: IllustrationVersionReference): void;
  (event: 'update:prompt', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: IllustrationSize): void;
  (event: 'update:useCharacter', value: boolean): void;
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
const baseVersionNumber = computed(
  () =>
    props.topic.versions.find(version => version.id === props.baseReference?.versionId)
      ?.versionNumber,
);
const generateDisabled = computed(
  () =>
    props.busy ||
    !props.topic.ready ||
    !props.prompt.trim() ||
    !props.apimartConfigured ||
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
        <Badge :variant="topic.ready ? 'secondary' : 'outline'">
          {{ topic.ready ? '可生成' : '对话整理中' }}
        </Badge>
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

          <div
            class="flex items-center justify-between gap-4 rounded-md border px-3 py-3 md:hidden"
          >
            <div>
              <Label for="illustration-mobile-use-character">使用当前角色</Label>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ referencesReady ? '正式定妆照与角色表已就绪' : '需要先准备正式角色参考图' }}
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

        <section aria-labelledby="illustration-output-heading">
          <h3 id="illustration-output-heading" class="mb-3 text-sm font-medium">输出规格</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="illustration-size">比例</Label>
              <Select
                :model-value="size"
                @update:model-value="emit('update:size', $event as IllustrationSize)"
              >
                <SelectTrigger id="illustration-size" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="3:4">3:4</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="9:16">9:16</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="illustration-resolution">清晰度</Label>
              <Select
                :model-value="resolution"
                @update:model-value="
                  emit('update:resolution', $event as CharacterPortraitResolution)
                "
              >
                <SelectTrigger id="illustration-resolution" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1k">1K</SelectItem>
                  <SelectItem value="2k">2K</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section v-if="baseReference" class="rounded-md border px-3 py-3" aria-label="旧版本参考">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2 text-sm">
              <GitBranch class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate">下一版参考 V{{ baseVersionNumber }}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              class="size-7"
              aria-label="取消旧版本参考"
              @click="emit('clear-base')"
            >
              <X class="size-3.5" />
            </Button>
          </div>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            旧版本只延续构图和情境；角色身份仍以正式角色资产为准。
          </p>
        </section>

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
                </div>
                <Badge variant="outline">
                  {{
                    isActive(version)
                      ? '生成中'
                      : version.status === 'completed'
                        ? '已完成'
                        : '未完成'
                  }}
                </Badge>
              </div>

              <div v-if="isActive(version)" class="p-4">
                <div class="flex items-center gap-2 text-sm">
                  <Loader />
                  GPT-Image-2 正在绘制
                </div>
                <div class="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>可以离开页面，稍后会继续查询</span>
                  <span class="tabular-nums">{{ version.progress }}%</span>
                </div>
                <Progress :model-value="version.progress" class="mt-2" />
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
                      <Button
                        size="sm"
                        variant="ghost"
                        @click="
                          emit('select-base', { fileName: image.fileName, versionId: version.id })
                        "
                      >
                        <Link2 class="size-4" />
                        以此继续
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
        {{
          busy
            ? '正在生成插画'
            : baseReference
              ? `基于 V${baseVersionNumber} 生成新版本`
              : '生成插画'
        }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        使用 GPT-Image-2，点击后将产生实际费用
      </p>
    </footer>
  </section>
</template>
