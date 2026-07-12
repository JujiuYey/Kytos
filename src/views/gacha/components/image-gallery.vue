<script setup lang="ts">
import { computed, ref } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Image as ImageIcon, Star } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const images = computed(() => store.selectedPrompt?.prompt.images ?? []);
const promptName = computed(() => store.selectedPrompt?.prompt.name ?? '');

function imageSrc(path: string, mtime: number): string {
  // Append mtime as cache buster so overwriting a baseline file invalidates the cache.
  return `${convertFileSrc(path)}?v=${mtime}`;
}

const hoveringPath = ref<string | null>(null);

interface PendingBaseline {
  imagePath: string;
  target: '定妆照' | '角色表';
  baselinePath: string;
}

const pending = ref<PendingBaseline | null>(null);

function requestSetBaseline(imagePath: string, target: '定妆照' | '角色表') {
  // The baseline file is at `<root>/角色/<target>.png`. We don't know root
  // here, but the project scan fills `store.project.baselines.{dingzhuangzhao,jiaosebiao}`.
  const baseline = target === '定妆照'
    ? store.project?.baselines.dingzhuangzhao
    : store.project?.baselines.jiaosebiao;
  pending.value = {
    imagePath,
    target,
    baselinePath: baseline?.path ?? `角色/${target}.png`,
  };
}

async function confirmBaseline() {
  if (!pending.value) {
    return;
  }
  await store.setBaseline(pending.value.imagePath, pending.value.target);
  pending.value = null;
}

function cancelBaseline() {
  pending.value = null;
}
</script>

<template>
  <div class="h-full flex flex-col border-l">
    <header class="px-4 py-2 border-b bg-muted/20 text-sm font-medium">
      <div v-if="promptName">
        {{ promptName }} 的卡
      </div>
      <div v-else class="text-muted-foreground">
        还没有选中任何 prompt
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="images.length === 0" class="text-sm text-muted-foreground italic">
        还没有抽过卡。
      </div>
      <div v-else class="grid grid-cols-2 gap-3">
        <div
          v-for="image of images"
          :key="image.path"
          class="relative group border rounded-lg overflow-hidden bg-muted"
          @mouseenter="hoveringPath = image.path"
          @mouseleave="hoveringPath = null"
        >
          <img
            :src="imageSrc(image.path, image.mtime)"
            :alt="`${promptName}-${String(image.index).padStart(2, '0')}`"
            class="block w-full h-auto"
            loading="lazy"
          />
          <div class="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded tabular-nums">
            -{{ String(image.index).padStart(2, '0') }}
          </div>

          <div
            v-if="hoveringPath === image.path"
            class="absolute bottom-1 left-1 right-1 flex gap-1 bg-black/70 rounded p-1"
          >
            <Button
              size="sm"
              variant="secondary"
              class="h-6 text-xs flex-1 px-2"
              @click="requestSetBaseline(image.path, '定妆照')"
            >
              <Star class="size-3" />
              定妆照
            </Button>
            <Button
              size="sm"
              variant="secondary"
              class="h-6 text-xs flex-1 px-2"
              @click="requestSetBaseline(image.path, '角色表')"
            >
              <Star class="size-3" />
              角色表
            </Button>
          </div>
        </div>
      </div>
    </div>

    <footer v-if="store.project && promptName" class="border-t px-4 py-2 text-xs text-muted-foreground space-y-0.5">
      <div class="flex items-center gap-2">
        <ImageIcon class="size-3" />
        <span>{{ images.length }} 张已抽</span>
      </div>
      <div>
        API key:
        <span v-if="store.project.has_api_key" class="text-green-600">已配置</span>
        <span v-else class="text-red-600">未配置（去设置里填）</span>
      </div>
    </footer>

    <Dialog :open="pending !== null" @update:open="(v: boolean) => { if (!v) cancelBaseline() }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>覆盖基准图？</DialogTitle>
          <DialogDescription>
            这一步不可逆 —— 原文件会被覆盖。
          </DialogDescription>
        </DialogHeader>
        <div v-if="pending" class="text-sm space-y-2">
          <div>
            把 <code class="bg-muted px-1 rounded">{{ pending.imagePath }}</code>
          </div>
          <div>
            设为 <strong>{{ pending.target }}</strong>，覆盖：
          </div>
          <code class="block bg-muted px-2 py-1 rounded font-mono text-xs break-all">
            {{ pending.baselinePath }}
          </code>
          <p class="text-xs text-muted-foreground pt-2">
            覆盖之后，所有后续抽卡都会以这张图为角色参照。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="cancelBaseline">
            取消
          </Button>
          <Button @click="confirmBaseline">
            确认覆盖
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
