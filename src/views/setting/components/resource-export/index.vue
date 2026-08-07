<script setup lang="ts">
import { ref } from 'vue';
import { Download, Images, Loader2 } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { toErrorMessage } from '@/utils/helpers';

const errorMessage = ref('');
const isExporting = ref(false);
const lastExportPath = ref('');

async function exportImages(): Promise<void> {
  isExporting.value = true;
  errorMessage.value = '';
  try {
    const result = await window.desktop.file.exportWorkspaceImages();
    if (result.canceled) return;
    if (!result.directoryPath || result.fileCount === 0) {
      toast.info('当前工作区没有可导出的图片');
      return;
    }
    lastExportPath.value = result.directoryPath;
    toast.success(`已导出 ${result.fileCount} 张图片，共 ${result.categoryCount} 个分类`);
  } catch (error: unknown) {
    errorMessage.value = toErrorMessage(error);
    toast.error(errorMessage.value);
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <section aria-labelledby="resource-export-heading">
    <div class="mb-4">
      <h2 id="resource-export-heading" class="text-base font-semibold">图片资源</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        将工作区中的图片按角色、表情、插画和故事等类型批量导出。
      </p>
    </div>

    <div
      class="flex flex-col gap-4 rounded-md border p-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="flex min-w-0 items-start gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/30">
          <Images class="size-4 text-muted-foreground" />
        </div>
        <div class="min-w-0">
          <h3 class="text-sm font-medium">导出全部图片</h3>
          <p class="mt-1 text-sm text-muted-foreground">只复制图片文件，不包含数据库和 JSON。</p>
          <p v-if="lastExportPath" class="mt-2 break-all font-mono text-xs text-muted-foreground">
            {{ lastExportPath }}
          </p>
          <p v-if="errorMessage" class="mt-2 text-sm text-destructive" role="alert">
            {{ errorMessage }}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        class="shrink-0"
        :disabled="isExporting"
        @click="exportImages"
      >
        <Loader2 v-if="isExporting" class="size-4 animate-spin" />
        <Download v-else class="size-4" />
        {{ isExporting ? '正在导出' : '选择位置并导出' }}
      </Button>
    </div>
  </section>
</template>
