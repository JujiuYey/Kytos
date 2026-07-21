<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, FolderOpen, HardDrive, Loader2, ShieldCheck } from '@lucide/vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const router = useRouter();
const isSaving = ref(false);
const errorMessage = ref(appStore.initializationError);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function finishSetup(action: () => Promise<void>) {
  if (isSaving.value) {
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';
  try {
    await action();
    await router.replace('/character-create');
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isSaving.value = false;
  }
}

async function useSuggestedWorkspace() {
  await finishSetup(() => appStore.useSuggestedWorkspace());
}

async function chooseWorkspace() {
  if (isSaving.value) {
    return;
  }

  errorMessage.value = '';
  try {
    const selectedPath = await window.desktop.settings.selectDirectory();
    if (selectedPath) {
      await finishSetup(() => appStore.setWorkspaceDirectory(selectedPath));
    }
  } catch (error: unknown) {
    errorMessage.value = getErrorMessage(error);
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <div class="w-full max-w-xl">
      <div class="mb-10 flex items-center gap-3">
        <div
          class="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <HardDrive class="size-4" />
        </div>
        <span class="text-sm font-semibold">Kytos</span>
      </div>

      <section aria-labelledby="setup-title">
        <p class="mb-2 text-sm font-medium text-muted-foreground">首次设置</p>
        <h1 id="setup-title" class="text-3xl font-semibold tracking-normal">选择作品存储位置</h1>
        <p class="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          角色资料、素材和生成结果将保存在这里。应用配置和 API Key 不会写入这个目录。
        </p>

        <div class="my-8 border-y py-5">
          <div class="flex min-w-0 items-start gap-3">
            <FolderOpen class="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">推荐位置</p>
              <p class="mt-1 break-all font-mono text-sm text-muted-foreground">
                {{ appStore.suggestedWorkspacePath }}
              </p>
            </div>
          </div>
        </div>

        <Alert v-if="errorMessage" variant="destructive" class="mb-5">
          <AlertCircle class="size-4" />
          <AlertTitle>无法完成设置</AlertTitle>
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <div class="flex flex-wrap gap-3">
          <Button :disabled="isSaving" @click="useSuggestedWorkspace">
            <Loader2 v-if="isSaving" class="size-4 animate-spin" />
            <HardDrive v-else class="size-4" />
            使用推荐位置
          </Button>
          <Button variant="outline" :disabled="isSaving" @click="chooseWorkspace">
            <FolderOpen class="size-4" />
            选择其他目录
          </Button>
        </div>

        <div class="mt-8 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <ShieldCheck class="mt-0.5 size-4 shrink-0" />
          <span>目录确认后仍可在系统设置中切换；切换不会自动移动旧文件。</span>
        </div>
      </section>
    </div>
  </main>
</template>
