<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Image as ImageIcon, Palette, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import type {
  ArtStyle,
  ArtStyleSource,
  ArtStyleWorkspaceState,
  SaveArtStyleRequest,
} from '@/types';
import ArtStyleEditorDialog from './components/art-style-editor-dialog.vue';

type StyleFilter = 'all' | ArtStyleSource;

const workspace = ref<ArtStyleWorkspaceState | null>(null);
const filter = ref<StyleFilter>('all');
const searchQuery = ref('');
const loading = ref(true);
const loadingError = ref('');
const mutatingStyleId = ref('');
const editorOpen = ref(false);
const editorTarget = ref<ArtStyle | null>(null);
const deleteTarget = ref<ArtStyle | null>(null);
const deleteDialogOpen = computed({
  get: () => Boolean(deleteTarget.value),
  set: (open: boolean) => {
    if (!open) {
      deleteTarget.value = null;
    }
  },
});

const styles = computed(() => workspace.value?.styles ?? []);
const presetCount = computed(() => styles.value.filter(style => style.source === 'preset').length);
const customCount = computed(() => styles.value.filter(style => style.source === 'custom').length);
const filteredStyles = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  return styles.value.filter(style => {
    const filterMatches = filter.value === 'all' || style.source === filter.value;
    const queryMatches =
      !query ||
      style.name.toLocaleLowerCase('zh-CN').includes(query) ||
      style.description.toLocaleLowerCase('zh-CN').includes(query) ||
      style.prompt.toLocaleLowerCase('zh-CN').includes(query);
    return filterMatches && queryMatches;
  });
});

async function loadWorkspace(): Promise<void> {
  loading.value = true;
  loadingError.value = '';
  try {
    workspace.value = await window.desktop.getArtStyleWorkspace();
  } catch (error: unknown) {
    loadingError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editorTarget.value = null;
  editorOpen.value = true;
}

function openEdit(style: ArtStyle): void {
  editorTarget.value = style;
  editorOpen.value = true;
}

async function saveStyle(request: SaveArtStyleRequest): Promise<void> {
  if (mutatingStyleId.value) {
    return;
  }
  mutatingStyleId.value = request.id || 'new';
  try {
    workspace.value = await window.desktop.saveArtStyle(request);
    editorOpen.value = false;
    toast.success(request.id ? '画风已更新' : '画风已新增');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    mutatingStyleId.value = '';
  }
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;
  if (!target || mutatingStyleId.value) {
    return;
  }
  mutatingStyleId.value = target.id;
  try {
    workspace.value = await window.desktop.deleteArtStyle({ id: target.id });
    deleteTarget.value = null;
    toast.success('画风已删除');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    mutatingStyleId.value = '';
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
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background"
        >
          <Palette class="size-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">画风管理</h1>
            <Badge variant="secondary" class="shrink-0 tabular-nums">{{ styles.length }}</Badge>
          </div>
          <p class="hidden text-xs text-muted-foreground sm:block">
            管理创作时可选择的预置与自定义画风
          </p>
        </div>
      </div>
      <Button class="ml-auto shrink-0" @click="openCreate">
        <Plus class="size-4" />
        新增画风
      </Button>
    </template>

    <div
      class="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <Tabs :model-value="filter" @update:model-value="filter = $event as StyleFilter">
        <TabsList class="w-full sm:w-auto">
          <TabsTrigger value="all">全部 {{ styles.length }}</TabsTrigger>
          <TabsTrigger value="preset">预置 {{ presetCount }}</TabsTrigger>
          <TabsTrigger value="custom">自定义 {{ customCount }}</TabsTrigger>
        </TabsList>
      </Tabs>
      <InputGroup class="sm:w-72">
        <InputGroupAddon><Search class="size-4" /></InputGroupAddon>
        <InputGroupInput v-model="searchQuery" placeholder="搜索画风名称或规则" />
      </InputGroup>
    </div>

    <Alert v-if="loadingError" variant="destructive" class="mx-4 mt-4 shrink-0 sm:mx-5">
      <AlertTitle>画风库暂时无法读取</AlertTitle>
      <AlertDescription class="flex items-center justify-between gap-3">
        <span>{{ loadingError }}</span>
        <Button size="sm" variant="outline" @click="loadWorkspace">重试</Button>
      </AlertDescription>
    </Alert>

    <ScrollArea class="min-h-0 flex-1 bg-muted/10">
      <div
        v-if="loading"
        class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <Skeleton v-for="index in 8" :key="index" class="h-80 rounded-md" />
      </div>

      <div
        v-else-if="filteredStyles.length"
        class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="style in filteredStyles"
          :key="style.id"
          class="flex min-w-0 flex-col overflow-hidden rounded-md border bg-background"
        >
          <ImageViewer
            v-if="style.referenceImage"
            :alt="style.name"
            :src="style.referenceImage.url"
            :title="style.name"
            description="查看画风参考图"
          >
            <Button
              variant="ghost"
              class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
              :aria-label="`查看${style.name}参考图`"
            >
              <AiImage
                :src="style.referenceImage.url"
                :alt="style.name"
                class="aspect-[4/3] w-full rounded-none bg-muted/30 object-contain"
              />
            </Button>
          </ImageViewer>
          <div v-else class="flex aspect-[4/3] flex-col justify-between border-b bg-muted/20 p-5">
            <div class="flex items-center justify-between gap-3">
              <Badge variant="secondary">预置画风</Badge>
              <ImageIcon class="size-4 text-muted-foreground" />
            </div>
            <div class="flex gap-2">
              <span
                v-for="color in style.palette"
                :key="color"
                class="size-8 rounded-sm border shadow-sm"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>

          <div class="flex flex-1 flex-col p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate text-sm font-medium">{{ style.name }}</h2>
                <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {{ style.description }}
                </p>
              </div>
              <Badge
                :variant="style.source === 'preset' ? 'secondary' : 'outline'"
                class="shrink-0"
              >
                {{ style.source === 'preset' ? '预置' : '自定义' }}
              </Badge>
            </div>
            <p class="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {{ style.prompt }}
            </p>

            <div v-if="style.source === 'custom'" class="mt-auto flex justify-end gap-1 pt-4">
              <TooltipProvider :delay-duration="300">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-8"
                      aria-label="编辑画风"
                      @click="openEdit(style)"
                    >
                      <Pencil class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>编辑画风</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon"
                      variant="ghost"
                      class="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="删除画风"
                      @click="deleteTarget = style"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除画风</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12 text-center">
        <div class="max-w-sm">
          <Palette class="mx-auto size-6 text-muted-foreground" />
          <h2 class="mt-4 text-sm font-medium">没有找到匹配的画风</h2>
          <p class="mt-1 text-sm text-muted-foreground">调整搜索内容或切换分类。</p>
        </div>
      </div>
    </ScrollArea>

    <ArtStyleEditorDialog
      v-model:open="editorOpen"
      :loading="Boolean(mutatingStyleId)"
      :style="editorTarget"
      @save="saveStyle"
    />
    <SagConfirmDialog
      v-model:open="deleteDialogOpen"
      title="删除这个画风？"
      description="画风规则和参考图会被永久删除。已经生成的历史版本仍会保留当时使用的画风名称。"
      confirm-text="删除画风"
      :loading="Boolean(mutatingStyleId)"
      @confirm="confirmDelete"
    />
  </SagPage>
</template>
