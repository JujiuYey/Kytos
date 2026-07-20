<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileStack,
  Plus,
  Search,
  Trash2,
} from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import type { CharacterPortraitImage, StoryProject } from '@/types';

type StoryStatusTone = 'error' | 'info' | 'neutral' | 'success' | 'warning';

interface StoryStatus {
  label: string;
  tone: StoryStatusTone;
}

const router = useRouter();
const stories = ref<StoryProject[]>([]);
const searchQuery = ref('');
const loading = ref(true);
const loadingError = ref('');
const creating = ref(false);
const deletingStoryId = ref('');
const deleteTarget = ref<StoryProject | null>(null);

const filteredStories = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  return stories.value.filter(story => {
    if (!query) {
      return true;
    }
    return [story.title, story.draft.summary, story.draft.premise, story.draft.setting]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(query);
  });
});

function getCover(story: StoryProject): CharacterPortraitImage | null {
  const keyShot = story.shots.find(shot => shot.id === story.keyShotId);
  const candidateShots = keyShot
    ? [keyShot, ...story.shots.filter(shot => shot !== keyShot)]
    : story.shots;
  for (const shot of candidateShots) {
    const selectedVersion = shot.versions.find(version => version.id === shot.selectedVersionId);
    const version =
      (selectedVersion?.status === 'completed' ? selectedVersion : undefined) ??
      shot.versions.find(item => item.status === 'completed' && item.images.length > 0);
    if (version?.images[0]) {
      return version.images[0];
    }
  }
  return null;
}

function getStatus(story: StoryProject): StoryStatus {
  const isGenerating = story.shots.some(shot =>
    shot.versions.some(version => ['submitted', 'pending', 'processing'].includes(version.status)),
  );
  if (isGenerating) {
    return { label: '生成中', tone: 'info' };
  }
  if (story.storyboardStale) {
    return { label: '待复核', tone: 'warning' };
  }
  if (story.storyboardReady) {
    return { label: '分镜完成', tone: 'success' };
  }
  if (story.storyReady) {
    return { label: '故事已整理', tone: 'success' };
  }
  return { label: '草稿', tone: 'neutral' };
}

function getCompletedShotCount(story: StoryProject): number {
  return story.shots.filter(shot =>
    shot.versions.some(version => version.status === 'completed' && version.images.length > 0),
  ).length;
}

function getDescription(story: StoryProject): string {
  return story.draft.summary || story.draft.premise || '还没有整理故事摘要，进入故事创作继续完善。';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function loadWorkspace(): Promise<void> {
  loading.value = true;
  loadingError.value = '';
  try {
    stories.value = await window.desktop.getStoryWorkspace().then(workspace => workspace.stories);
  } catch (error: unknown) {
    loadingError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function openStory(story: StoryProject): void {
  void router.push({ name: 'story', query: { storyId: story.id } });
}

async function createStory(): Promise<void> {
  if (creating.value) {
    return;
  }
  creating.value = true;
  try {
    const story = await window.desktop.createStory({});
    openStory(story);
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    creating.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;
  if (!target || deletingStoryId.value) {
    return;
  }
  deletingStoryId.value = target.id;
  try {
    const workspace = await window.desktop.deleteStory({ storyId: target.id });
    stories.value = workspace.stories;
    deleteTarget.value = null;
    toast.success('故事已删除');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    deletingStoryId.value = '';
  }
}

onMounted(() => {
  void loadWorkspace();
});
</script>

<template>
  <SagPage>
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <BookMarked class="size-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">故事管理</h1>
            <Badge variant="secondary" class="shrink-0 tabular-nums">{{ stories.length }}</Badge>
          </div>
          <p class="hidden truncate text-xs text-muted-foreground sm:block">
            集中查看故事进度，继续进入任意故事创作
          </p>
        </div>
      </div>

      <Button class="ml-auto shrink-0" :disabled="creating" @click="createStory">
        <Plus class="size-4" />
        {{ creating ? '创建中' : '新建故事' }}
      </Button>
    </template>

    <div class="flex shrink-0 items-center border-b px-4 py-3 sm:px-5">
      <InputGroup class="w-full sm:w-80">
        <InputGroupAddon>
          <Search class="size-4" />
        </InputGroupAddon>
        <InputGroupInput v-model="searchQuery" placeholder="搜索故事名称或内容" />
      </InputGroup>
      <span class="ml-auto hidden text-xs text-muted-foreground sm:block">
        {{ filteredStories.length }} 个故事
      </span>
    </div>

    <Alert v-if="loadingError" variant="destructive" class="mx-4 mt-4 shrink-0 sm:mx-5">
      <AlertTitle>故事列表暂时无法读取</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ loadingError }}</span>
        <Button size="sm" variant="outline" @click="loadWorkspace">重试</Button>
      </AlertDescription>
    </Alert>

    <ScrollArea class="min-h-0 flex-1 bg-muted/10">
      <div
        v-if="loading"
        class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="index in 6"
          :key="index"
          class="overflow-hidden rounded-md border bg-background"
        >
          <Skeleton class="aspect-[16/9] w-full rounded-none" />
          <div class="space-y-3 p-3">
            <Skeleton class="h-4 w-3/5" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-4/5" />
          </div>
        </article>
      </div>

      <div
        v-else-if="filteredStories.length"
        class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="story in filteredStories"
          :key="story.id"
          class="min-w-0 overflow-hidden rounded-md border bg-background"
        >
          <Button
            variant="ghost"
            class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
            :aria-label="`打开${story.title}`"
            @click="openStory(story)"
          >
            <div class="relative aspect-[16/9] w-full bg-muted/40">
              <AiImage
                v-if="getCover(story)"
                :alt="`${story.title}封面`"
                :src="getCover(story)?.url"
                class="size-full rounded-none object-cover transition-opacity hover:opacity-95"
              />
              <div
                v-else
                class="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                <BookOpen class="size-8" />
                <span class="text-xs">尚未生成画面</span>
              </div>
            </div>
          </Button>

          <div class="space-y-3 border-t px-3 py-3">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="truncate text-sm font-medium">{{ story.title }}</h2>
                <p class="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                  {{ getDescription(story) }}
                </p>
              </div>
              <SagStatusBadge :tone="getStatus(story).tone" class="shrink-0">
                <CheckCircle2 v-if="getStatus(story).tone === 'success'" class="size-3" />
                <Clock3 v-else-if="getStatus(story).tone === 'info'" class="size-3" />
                {{ getStatus(story).label }}
              </SagStatusBadge>
            </div>

            <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span class="truncate"
                >{{ getCompletedShotCount(story) }}/{{ story.shots.length }} 个分镜</span
              >
              <span class="flex shrink-0 items-center gap-1">
                <Clock3 class="size-3.5" />
                {{ formatDate(story.updatedAt) }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" @click="openStory(story)">
                <BookOpen class="size-4" />
                继续创作
              </Button>
              <TooltipProvider :delay-duration="300">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-8 text-muted-foreground hover:text-destructive"
                      :disabled="Boolean(deletingStoryId)"
                      :aria-label="`删除${story.title}`"
                      @click="deleteTarget = story"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除故事</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12">
        <div class="max-w-sm text-center">
          <div
            class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
          >
            <FileStack class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 text-sm font-medium">
            {{ searchQuery.trim() ? '没有找到匹配的故事' : '还没有故事' }}
          </h2>
          <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
            {{
              searchQuery.trim()
                ? '可以换个关键词，或清除搜索查看全部故事。'
                : '创建第一个故事，从一个模糊想法开始和 Agent 共创。'
            }}
          </p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <Button v-if="searchQuery.trim()" variant="outline" @click="searchQuery = ''">
              清除搜索
            </Button>
            <Button v-else :disabled="creating" @click="createStory">
              <Plus class="size-4" />
              新建故事
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>

    <SagConfirmDialog
      :open="Boolean(deleteTarget)"
      title="删除这个故事？"
      description="故事对话、文字分镜和所有生成版本都会一起删除，此操作不可恢复。"
      confirm-text="删除故事"
      :loading="Boolean(deletingStoryId)"
      @update:open="value => !value && (deleteTarget = null)"
      @confirm="confirmDelete"
    />
  </SagPage>
</template>
