<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SagImageEditor } from '@/components/sag/image-editor';
import { Button } from '@/components/ui/button';

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
  <SagImageEditor
    v-if="imageSource"
    :key="imageSource.sourceUrl"
    :file-name="imageSource.fileName"
    :mime-type="imageSource.mimeType"
    :source-url="imageSource.sourceUrl"
    @back="goBack"
  />
  <main
    v-else
    class="flex h-full min-h-0 items-center justify-center overflow-hidden bg-background p-6"
  >
    <div class="max-w-sm text-center">
      <h1 class="text-sm font-semibold">无法打开图片编辑器</h1>
      <p class="mt-2 text-sm text-muted-foreground">缺少有效的图片信息。</p>
      <Button class="mt-4" variant="outline" @click="goBack">返回</Button>
    </div>
  </main>
</template>
