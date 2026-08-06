<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Crop } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { SagPage } from '@/components/sag/sag-page';
import ImageEditor from './image-editor.vue';

interface ImageSource {
  fileName: string;
  mimeType: string;
  sourceUrl: string;
}

const route = useRoute();
const router = useRouter();

const imageSource = computed<ImageSource | null>(() => {
  const fileName = getQueryValue(route.query.fileName);
  const mimeType = getQueryValue(route.query.mimeType);
  const sourceUrl = getQueryValue(route.query.sourceUrl);
  if (!fileName || !mimeType.startsWith('image/') || !sourceUrl) {
    return null;
  }
  return { fileName, mimeType, sourceUrl };
});

function getQueryValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function goBack(): void {
  const returnTo = getQueryValue(route.query.returnTo);
  if (returnTo && router.hasRoute(returnTo)) {
    void router.push({ name: returnTo });
    return;
  }
  router.back();
}
</script>

<template>
  <SagPage :icon="Crop">
    <template #header>
      <Button size="icon" variant="ghost" aria-label="返回" @click="goBack">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-sm font-semibold">
          {{ imageSource ? '图片编辑' : '无法打开图片编辑器' }}
        </h1>
        <p class="truncate text-xs text-muted-foreground">
          {{ imageSource?.fileName ?? '缺少有效的图片信息' }}
        </p>
      </div>
    </template>

    <ImageEditor
      v-if="imageSource"
      :key="imageSource.sourceUrl"
      :file-name="imageSource.fileName"
      :mime-type="imageSource.mimeType"
      :source-url="imageSource.sourceUrl"
      @back="goBack"
    />
    <div v-else class="flex flex-1 items-center justify-center p-6">
      <Button variant="outline" @click="goBack">返回</Button>
    </div>
  </SagPage>
</template>
