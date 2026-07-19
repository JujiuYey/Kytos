<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import type { CharacterImageSize, CharacterLibraryState, CharacterSummary } from '@/types';

type EditorMode = 'create' | 'rename';

const router = useRouter();
const library = ref<CharacterLibraryState | null>(null);
const loading = ref(true);
const busy = ref(false);
const errorMessage = ref('');
const editorOpen = ref(false);
const editorMode = ref<EditorMode>('create');
const editorName = ref('');
const editorCharacter = ref<CharacterSummary | null>(null);
const deleteTarget = ref<CharacterSummary | null>(null);

const characters = computed(() => library.value?.characters ?? []);
const editorTitle = computed(() => (editorMode.value === 'create' ? '新建角色' : '重命名角色'));

const visualAssetAspectClasses: Record<CharacterImageSize, string> = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '2:3': 'aspect-[2/3]',
  '3:4': 'aspect-[3/4]',
  '4:5': 'aspect-[4/5]',
};
const skeletonAspectClasses = ['aspect-[2/3]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/5]'];

function getVisualAssetAspectClass(size: CharacterImageSize): string {
  return visualAssetAspectClasses[size];
}

function getSkeletonAspectClass(index: number): string {
  return skeletonAspectClasses[(index - 1) % skeletonAspectClasses.length] ?? 'aspect-[3/4]';
}

async function loadLibrary(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    library.value = await window.desktop.getCharacterLibrary();
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function openEditor(mode: EditorMode, character: CharacterSummary | null = null): void {
  editorMode.value = mode;
  editorCharacter.value = character;
  editorName.value = character?.name ?? '';
  editorOpen.value = true;
}

async function submitEditor(): Promise<void> {
  const name = editorName.value.trim();
  if (!name || busy.value) {
    return;
  }
  busy.value = true;
  try {
    if (editorMode.value === 'create') {
      library.value = await window.desktop.createCharacter({ name });
    } else if (editorCharacter.value) {
      library.value = await window.desktop.updateCharacter({
        characterId: editorCharacter.value.id,
        name,
      });
    } else {
      return;
    }
    editorOpen.value = false;
    toast.success(editorMode.value === 'create' ? '角色已创建' : '角色名称已更新');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

async function openCharacter(character: CharacterSummary): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    library.value = await window.desktop.selectCharacter({ characterId: character.id });
    await router.push({ name: 'character' });
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;
  if (!target || busy.value) {
    return;
  }
  busy.value = true;
  try {
    library.value = await window.desktop.deleteCharacter({ characterId: target.id });
    deleteTarget.value = null;
    toast.success('角色已移除');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadLibrary();
});
</script>

<template>
  <SagPage>
    <template #header>
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <UsersRound class="size-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">角色管理</h1>
            <Badge variant="secondary" class="shrink-0 tabular-nums">
              {{ characters.length }}
            </Badge>
          </div>
          <p class="truncate text-xs text-muted-foreground">管理多个角色及其完整形象资料</p>
        </div>
      </div>
      <Button :disabled="busy" @click="openEditor('create')">
        <Plus class="size-4" />
        新建角色
      </Button>
    </template>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-4 shrink-0 sm:mx-5">
      <AlertTitle>角色资料暂时无法读取</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button size="sm" variant="outline" @click="loadLibrary">重试</Button>
      </AlertDescription>
    </Alert>

    <ScrollArea class="min-h-0 flex-1 bg-muted/10">
      <div
        v-if="loading"
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <article
          v-for="index in 6"
          :key="index"
          class="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-md border bg-background align-top"
        >
          <Skeleton :class="[getSkeletonAspectClass(index), 'w-full rounded-none']" />
          <div class="space-y-3 border-t px-3 py-3">
            <Skeleton class="h-4 w-3/5" />
            <Skeleton class="h-8 w-full" />
          </div>
        </article>
      </div>

      <div
        v-else
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <article
          v-for="character in characters"
          :key="character.id"
          class="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-md border bg-background align-top"
        >
          <Button
            variant="ghost"
            class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
            :disabled="busy"
            :aria-label="`进入角色 ${character.name}`"
            @click="openCharacter(character)"
          >
            <AiImage
              v-if="character.visualAsset"
              :alt="`${character.name}的${character.visualAsset.name}`"
              :src="character.visualAsset.url"
              :class="[
                getVisualAssetAspectClass(character.visualAsset.size),
                'w-full rounded-none bg-muted/30 object-cover transition-opacity hover:opacity-95',
              ]"
            />
            <div
              v-else
              class="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-muted-foreground"
            >
              <UserRound class="size-10" />
              <span class="text-xs">尚无正式角色视觉</span>
            </div>
          </Button>

          <div class="space-y-3 border-t px-3 py-3">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="truncate text-sm font-medium">{{ character.name }}</h2>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {{
                    character.visualAsset
                      ? `正式资产 · ${character.visualAsset.name}`
                      : '等待添加正式角色视觉'
                  }}
                </p>
              </div>
              <SagStatusBadge
                v-if="library?.activeCharacterId === character.id"
                tone="success"
                class="shrink-0"
              >
                <Check class="size-3" />
                当前角色
              </SagStatusBadge>
            </div>

            <div class="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                :disabled="busy"
                @click="openCharacter(character)"
              >
                进入角色
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button size="icon-sm" variant="ghost" :aria-label="`管理角色 ${character.name}`">
                    <MoreHorizontal class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="openEditor('rename', character)">
                    <Pencil class="size-4" />
                    重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @select="deleteTarget = character"
                  >
                    <Trash2 class="size-4" />
                    移除角色
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </article>
      </div>
    </ScrollArea>

    <Dialog v-model:open="editorOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editorTitle }}</DialogTitle>
          <DialogDescription> 每个角色拥有独立的角色特征、角色视觉和表情资料。 </DialogDescription>
        </DialogHeader>
        <Input
          v-model="editorName"
          placeholder="角色名称"
          maxlength="100"
          @keydown.enter.prevent="submitEditor"
        />
        <DialogFooter>
          <Button variant="outline" :disabled="busy" @click="editorOpen = false">取消</Button>
          <Button :disabled="busy || !editorName.trim()" @click="submitEditor">
            {{ busy ? '保存中' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SagConfirmDialog
      :open="Boolean(deleteTarget)"
      title="移除这个角色？"
      description="角色将从管理列表移除。为避免破坏旧作品，已经生成的图片文件会保留在工作区。"
      confirm-text="确认移除"
      :loading="busy"
      @update:open="value => !value && (deleteTarget = null)"
      @confirm="confirmDelete"
    />
  </SagPage>
</template>
