<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowRight, Check, ImageUp, LoaderCircle, WandSparkles, X } from '@lucide/vue';
import { LocalFileUpload } from '@/components/sag/local-file-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SaveFileRequest, SavedFileResult } from '@/types';

const props = defineProps<{
  existing: boolean;
  initialName: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  (event: 'submit', name: string, visualAsset: SaveFileRequest | null): void;
}>();

const name = ref('');
const visualAsset = ref<SaveFileRequest | null>(null);
const visualAssetName = ref('');
const visualAssetUrl = ref('');
const pendingChoice = ref<'upload' | 'generate' | null>(null);
const normalizedName = computed(() => name.value.trim());
const submitDisabled = computed(
  () => props.loading || !normalizedName.value || name.value.length > 100,
);
const uploadSubmitDisabled = computed(() => submitDisabled.value || !visualAsset.value);

watch(
  () => props.initialName,
  initialName => {
    name.value = initialName;
  },
  { immediate: true },
);

watch(
  () => props.loading,
  loading => {
    if (!loading) pendingChoice.value = null;
  },
);

function submitWithVisualAsset(): void {
  if (!uploadSubmitDisabled.value && visualAsset.value) {
    pendingChoice.value = 'upload';
    emit('submit', normalizedName.value, visualAsset.value);
  }
}

function continueToGenerate(): void {
  if (!submitDisabled.value) {
    pendingChoice.value = 'generate';
    emit('submit', normalizedName.value, null);
  }
}

function revokeVisualAssetUrl(): void {
  if (visualAssetUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(visualAssetUrl.value);
  }
}

async function localUploadHandler(request: SaveFileRequest): Promise<SavedFileResult> {
  visualAsset.value = request;
  const blob = new Blob([request.fileData], { type: request.mimeType });
  return {
    fileName: request.fileName,
    originalName: request.fileName,
    size: request.fileData.byteLength,
    mimeType: request.mimeType,
    url: URL.createObjectURL(blob),
  };
}

function handleUploadSuccess(result: SavedFileResult | SavedFileResult[]): void {
  const target = Array.isArray(result) ? result[0] : result;
  if (!target) return;
  revokeVisualAssetUrl();
  visualAssetName.value = target.originalName;
  visualAssetUrl.value = target.url;
}

function removeVisualAsset(): void {
  revokeVisualAssetUrl();
  visualAsset.value = null;
  visualAssetName.value = '';
  visualAssetUrl.value = '';
}

onBeforeUnmount(revokeVisualAssetUrl);
</script>

<template>
  <section class="w-full max-w-5xl" aria-labelledby="character-summary-heading">
    <p class="text-xs font-semibold uppercase text-muted-foreground">角色概要</p>
    <h2 id="character-summary-heading" class="mt-2 text-2xl font-semibold sm:text-3xl">
      {{ existing ? '确认这个角色的名称' : '先给角色一个名字' }}
    </h2>
    <p class="mt-2 text-sm leading-6 text-muted-foreground">填写角色名称，然后选择一种创建方式。</p>

    <form class="mt-8 space-y-8" @submit.prevent>
      <div class="max-w-2xl space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="character-create-name">角色名称</Label>
          <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 100</span>
        </div>
        <Input
          id="character-create-name"
          v-model="name"
          autofocus
          maxlength="100"
          placeholder="例如：小林、我的产品角色"
        />
      </div>

      <fieldset>
        <legend class="mb-3 text-sm font-medium">选择创建方式</legend>
        <div class="grid items-stretch gap-4 md:grid-cols-2">
          <section
            class="flex min-h-96 min-w-0 flex-col rounded-md border bg-background p-5 transition-colors focus-within:border-foreground/40"
            aria-labelledby="upload-existing-visual-heading"
          >
            <div class="flex items-start gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <ImageUp class="size-4.5" />
              </div>
              <div class="min-w-0">
                <h3 id="upload-existing-visual-heading" class="font-semibold">上传已有视觉</h3>
                <p class="mt-1 text-sm leading-6 text-muted-foreground">
                  已经有满意的角色图片，上传后直接完成角色创建。
                </p>
              </div>
            </div>

            <div class="mt-5 flex-1">
              <LocalFileUpload
                v-if="!visualAssetUrl"
                :upload-handler="localUploadHandler"
                accept="image/jpeg,image/png,image/webp"
                :multiple="false"
                :max-files="1"
                :max-file-size="10 * 1024 * 1024"
                :disabled="loading"
                enable-drop-zone
                description="支持 JPG / PNG / WebP，单张最大 10MB"
                dropzone-hint="拖放已有角色锚点到此处，或"
                label="选择已有角色锚点"
                @upload-success="handleUploadSuccess"
              />
              <div
                v-else
                class="flex items-center gap-3 rounded-md border bg-muted/20 p-3"
                aria-live="polite"
              >
                <img
                  :src="visualAssetUrl"
                  alt="已选择的正式角色锚点"
                  class="size-16 shrink-0 rounded-md border object-cover"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ visualAssetName }}</p>
                  <p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check class="size-3.5" />
                    将直接保存为正式锚点
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  :disabled="loading"
                  aria-label="移除已有角色锚点"
                  title="移除已有角色锚点"
                  @click="removeVisualAsset"
                >
                  <X class="size-4" />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              class="mt-5 w-full"
              :disabled="uploadSubmitDisabled"
              @click="submitWithVisualAsset"
            >
              <LoaderCircle
                v-if="loading && pendingChoice === 'upload'"
                class="size-4 animate-spin"
              />
              <template v-else>
                使用已有视觉创建角色
                <ArrowRight class="size-4" />
              </template>
            </Button>
          </section>

          <section
            class="flex min-h-96 min-w-0 flex-col rounded-md border bg-background p-5 transition-colors focus-within:border-foreground/40"
            aria-labelledby="generate-first-visual-heading"
          >
            <div class="flex items-start gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <WandSparkles class="size-4.5" />
              </div>
              <div class="min-w-0">
                <h3 id="generate-first-visual-heading" class="font-semibold">创建第一个形象</h3>
                <p class="mt-1 text-sm leading-6 text-muted-foreground">
                  还没有角色图片，从风格和人物细节开始创建。
                </p>
              </div>
            </div>

            <div
              class="my-8 flex flex-1 items-center justify-center border-y bg-muted/20 px-6 py-8"
            >
              <div class="max-w-xs text-center">
                <WandSparkles class="mx-auto size-8 text-muted-foreground" />
                <p class="mt-4 text-sm font-medium">进入角色形象创建流程</p>
                <p class="mt-1 text-xs leading-5 text-muted-foreground">
                  选择风格、提供参考图并完善人物形象。
                </p>
              </div>
            </div>

            <Button
              type="button"
              class="w-full"
              :disabled="submitDisabled"
              @click="continueToGenerate"
            >
              <LoaderCircle
                v-if="loading && pendingChoice === 'generate'"
                class="size-4 animate-spin"
              />
              <template v-else>
                继续创建第一个形象
                <ArrowRight class="size-4" />
              </template>
            </Button>
          </section>
        </div>
      </fieldset>
    </form>
  </section>
</template>
