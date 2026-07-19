<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { CheckCircle2, ExternalLink, FolderOpen, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const errorMessage = ref('');
const isOpening = ref(false);
const isSelecting = ref(false);
const isSwitchDialogOpen = ref(false);
const isSwitching = ref(false);
const pendingPath = ref('');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function chooseProjectDir() {
  isSelecting.value = true;
  errorMessage.value = '';
  try {
    const selected = await window.desktop.selectDirectory();
    if (selected && selected !== appStore.workspacePath) {
      pendingPath.value = selected;
      isSwitchDialogOpen.value = true;
    }
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSelecting.value = false;
  }
}

async function switchWorkspace() {
  if (!pendingPath.value) {
    return;
  }

  isSwitching.value = true;
  errorMessage.value = '';
  try {
    await appStore.setWorkspaceDirectory(pendingPath.value);
    isSwitchDialogOpen.value = false;
    pendingPath.value = '';
    toast.success('作品工作区已切换');
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSwitching.value = false;
  }
}

async function openWorkspace() {
  isOpening.value = true;
  errorMessage.value = '';
  try {
    await appStore.openWorkspaceDirectory();
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isOpening.value = false;
  }
}
</script>

<template>
  <div class="rounded-md border bg-muted/20 p-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background"
        >
          <FolderOpen class="size-4 text-muted-foreground" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium">当前工作区</p>
            <SagStatusBadge tone="success">
              <CheckCircle2 class="size-3" />
              可用
            </SagStatusBadge>
          </div>
          <p class="mt-1 break-all font-mono text-sm text-muted-foreground">
            {{ appStore.workspacePath }}
          </p>
          <p v-if="errorMessage" class="mt-2 text-sm text-destructive" role="alert">
            {{ errorMessage }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" :disabled="isOpening" @click="openWorkspace">
          <Loader2 v-if="isOpening" class="size-4 animate-spin" />
          <ExternalLink v-else class="size-4" />
          在访达中打开
        </Button>
        <Button variant="outline" :disabled="isSelecting" @click="chooseProjectDir">
          <Loader2 v-if="isSelecting" class="size-4 animate-spin" />
          <FolderOpen v-else class="size-4" />
          更换目录
        </Button>
      </div>
    </div>

    <Dialog v-model:open="isSwitchDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>切换作品工作区？</DialogTitle>
          <DialogDescription>
            应用将从新位置读写作品。原工作区内的文件不会自动移动或删除。
          </DialogDescription>
        </DialogHeader>
        <div class="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm break-all">
          {{ pendingPath }}
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="isSwitching" @click="isSwitchDialogOpen = false">
            取消
          </Button>
          <Button :disabled="isSwitching" @click="switchWorkspace">
            <Loader2 v-if="isSwitching" class="size-4 animate-spin" />
            <FolderOpen v-else class="size-4" />
            切换工作区
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
