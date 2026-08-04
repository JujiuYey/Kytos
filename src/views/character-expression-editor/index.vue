<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SagImageEditor } from '@/components/sag/image-editor';
import type { CharacterExpressionRecord, CharacterPortraitImage } from '@/types';

const route = useRoute();
const router = useRouter();
const record = ref<CharacterExpressionRecord | null>(null);
const image = ref<CharacterPortraitImage | null>(null);
const errorMessage = ref('');

const characterId = computed(() => getQueryValue(route.query.characterId));
const taskId = computed(() => getQueryValue(route.query.taskId));
const fileName = computed(() => getQueryValue(route.query.fileName));

function getQueryValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function loadSource(): Promise<void> {
  if (!characterId.value || !taskId.value || !fileName.value) {
    errorMessage.value = '缺少要编辑的表情信息';
    return;
  }
  try {
    const workspace = await window.desktop.character.expression.getCharacterExpressionWorkspace({
      characterId: characterId.value,
    });
    const matchedRecord = workspace.records.find(item => item.id === taskId.value);
    const matchedImage = matchedRecord?.images.find(item => item.fileName === fileName.value);
    if (!matchedRecord || !matchedImage) throw new Error('这张表情已不存在');
    record.value = matchedRecord;
    image.value = matchedImage;
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '无法加载这张表情';
  }
}

function goBack(): void {
  void router.push({ name: 'character-expression' });
}

onMounted(() => {
  void loadSource();
});
</script>

<template>
  <SagImageEditor
    v-if="image"
    :file-name="record?.name || image.fileName"
    :mime-type="image.mimeType"
    :source-url="image.url"
    @back="goBack"
  />
  <main
    v-else
    class="flex h-full min-h-0 items-center justify-center overflow-hidden bg-background p-6"
  >
    <div class="max-w-sm text-center">
      <div v-if="!errorMessage" class="text-sm text-muted-foreground">正在打开图片编辑器...</div>
      <template v-else>
        <h1 class="text-sm font-semibold">无法打开图片编辑器</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ errorMessage }}</p>
        <Button class="mt-4" variant="outline" @click="goBack">返回表情管理</Button>
      </template>
    </div>
  </main>
</template>
