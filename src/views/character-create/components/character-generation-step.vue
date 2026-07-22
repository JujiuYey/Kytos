<script setup lang="ts">
import { Check, LoaderCircle, WandSparkles } from '@lucide/vue';
import { Progress } from '@/components/ui/progress';

defineProps<{
  generationCount: number;
  generatedImage: string;
  hasGenerated: boolean;
  isGenerating: boolean;
  isSaved: boolean;
  progress: number;
  selectedStyleName: string;
}>();
</script>

<template>
  <section class="max-w-4xl" aria-labelledby="result-heading">
    <div
      v-if="isGenerating"
      class="flex min-h-96 flex-col items-center justify-center rounded-xl border bg-background px-6 text-center"
    >
      <div
        class="generation-orbit mb-6 flex size-20 items-center justify-center rounded-full border border-primary/20 bg-primary/5"
      >
        <LoaderCircle class="size-8 animate-spin text-primary" />
      </div>
      <h3 class="text-base font-semibold">正在生成角色形象</h3>
      <p class="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        先把「{{ selectedStyleName }}」和你的描述组合起来，生成一张可以继续调整的初稿。
      </p>
      <Progress :value="progress" class="mt-6 max-w-xs" />
    </div>

    <div v-else-if="hasGenerated" class="space-y-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase text-muted-foreground">
            第 {{ generationCount }} 次生成
          </p>
          <h3 id="result-heading" class="mt-1 text-xl font-semibold">这张方向接近你想要的吗？</h3>
        </div>
        <span
          v-if="isSaved"
          class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700"
        >
          <Check class="size-3.5" />
          已设为正式视觉
        </span>
      </div>

      <div
        class="flex aspect-square max-h-[640px] items-center justify-center overflow-hidden rounded-xl border bg-muted/10"
      >
        <img
          :src="generatedImage"
          :alt="`生成的${selectedStyleName}角色示例`"
          class="size-full object-contain"
        />
      </div>
    </div>

    <div
      v-else
      class="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 text-center"
    >
      <div class="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
        <WandSparkles class="size-6 text-muted-foreground" />
      </div>
      <h3 class="text-base font-semibold">准备好生成第一张了</h3>
      <p class="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        点击下方按钮，先得到一张可以讨论的初稿。它不是终稿，随时可以回来修改。
      </p>
    </div>
  </section>
</template>

<style scoped>
.generation-orbit {
  animation: orbit-pulse 1.4s ease-in-out infinite;
}

@keyframes orbit-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}
</style>
