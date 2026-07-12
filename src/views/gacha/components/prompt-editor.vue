<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Copy, Loader2, Save, Sparkles, RotateCw, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const SIZE_OPTIONS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'];
const RESOLUTION_OPTIONS = ['1k', '2k'];

const draftRaw = ref('');
const draftSize = ref<string>('16:9');
const draftResolution = ref<string>('1k');
const noRef = ref(false);

watch(
  () => store.promptDetail,
  detail => {
    if (detail) {
      draftRaw.value = detail.raw;
      draftSize.value = detail.size;
      draftResolution.value = detail.resolution;
      // Spec: only 00-定妆照.md defaults to off (重抽角色形象本身时不能带旧形象).
      noRef.value = store.selectedPrompt?.prompt.name === '00-定妆照';
    }
  },
  { immediate: true },
);

const dirty = computed(() => {
  if (!store.promptDetail) {
    return false;
  }
  return draftRaw.value !== store.promptDetail.raw
    || draftSize.value !== store.promptDetail.size
    || draftResolution.value !== store.promptDetail.resolution;
});

function syncDirectives(raw: string, size: string, resolution: string): string {
  const sizeLine = `<!-- size: ${size} -->`;
  const resolutionLine = `<!-- resolution: ${resolution} -->`;
  const updated = raw
    .replace(/^<!--\s*size\s*:\s*\S+?\s*-->\s*/m, '')
    .replace(/^<!--\s*resolution\s*:\s*\S+?\s*-->\s*/m, '');
  return `${sizeLine}\n${resolutionLine}\n\n${updated.replace(/^\n+/, '')}`;
}

async function save() {
  const finalRaw = syncDirectives(draftRaw.value, draftSize.value, draftResolution.value);
  const ok = await store.savePrompt(finalRaw);
  if (ok && store.selectedPrompt) {
    await store.selectPrompt(store.selectedPrompt.categoryName, store.selectedPrompt.prompt);
  }
}

async function draw() {
  if (!store.projectRoot || !store.selectedPrompt) {
    return;
  }
  // Save dirty edits first so the model sees the current text.
  if (dirty.value) {
    await save();
  }
  await store.draw({
    root: store.projectRoot,
    md_path: store.selectedPrompt.prompt.md_path,
    no_ref: noRef.value,
    extra_refs: [],
    size: draftSize.value,
    resolution: draftResolution.value,
    dry_run: false,
  });
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function refetch(taskId: string) {
  if (!taskId) {
    return;
  }
  await store.fetchTask(taskId);
}

const lastResult = computed(() => store.lastDrawResult);
const failed = computed(() => lastResult.value?.failed ?? []);
const recentLogs = computed(() => store.logs.slice(-40).reverse());
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="!store.promptDetail" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      左栏选一张卡片开始
    </div>

    <template v-else>
      <header class="px-4 py-2 border-b bg-muted/20 space-y-2">
        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-xs text-muted-foreground truncate">
              {{ store.selectedPrompt?.categoryName }} / {{ store.selectedPrompt?.prompt.name }}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <label class="text-xs text-muted-foreground">size</label>
              <Select v-model="draftSize">
                <SelectTrigger class="h-7 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt of SIZE_OPTIONS" :key="opt" :value="opt">
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <label class="text-xs text-muted-foreground ml-2">resolution</label>
              <Select v-model="draftResolution">
                <SelectTrigger class="h-7 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt of RESOLUTION_OPTIONS" :key="opt" :value="opt">
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="!dirty || store.isSaving"
            @click="save"
          >
            <Loader2 v-if="store.isSaving" class="size-3 animate-spin" />
            <Save v-else class="size-3" />
            保存
          </Button>
          <Button
            size="sm"
            :disabled="store.isDrawing || !store.project?.has_api_key"
            @click="draw"
          >
            <Loader2 v-if="store.isDrawing" class="size-3 animate-spin" />
            <Sparkles v-else class="size-3" />
            {{ store.isDrawing ? '抽卡中…' : '抽卡' }}
          </Button>
        </div>
        <div class="flex items-center gap-2">
          <Switch
            id="no-ref"
            :model-value="noRef"
            @update:model-value="(v: boolean) => noRef = v"
          />
          <label for="no-ref" class="text-xs text-muted-foreground cursor-pointer">
            不带角色参考图
          </label>
          <span v-if="store.selectedPrompt?.prompt.name === '00-定妆照'" class="text-xs text-muted-foreground italic">
            (重抽角色本身，默认关)
          </span>
        </div>
      </header>

      <div class="flex-1 overflow-hidden flex flex-col">
        <Textarea
          v-model="draftRaw"
          class="flex-1 resize-none font-mono text-sm rounded-none border-0 border-b focus-visible:ring-0"
          spellcheck="false"
        />

        <div v-if="lastResult && (lastResult.task_id || failed.length > 0)" class="border-t px-3 py-2 space-y-1 bg-muted/10">
          <div v-if="lastResult.task_id" class="flex items-center gap-2 text-xs">
            <span class="text-muted-foreground">task_id:</span>
            <code class="font-mono">{{ lastResult.task_id }}</code>
            <Button
              size="sm"
              variant="ghost"
              class="h-5 px-1"
              @click="copyText(lastResult.task_id)"
            >
              <Copy class="size-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              class="h-5 px-2"
              :disabled="store.isDrawing"
              @click="refetch(lastResult.task_id)"
            >
              <RotateCw class="size-3" />
              用 task_id 取回
            </Button>
          </div>
          <div v-if="failed.length > 0" class="space-y-1">
            <div class="text-xs text-red-600 font-medium">
              下载失败 {{ failed.length }} 张（链接 24 小时内有效，可以重试）：
            </div>
            <div
              v-for="f of failed"
              :key="f.url"
              class="text-xs font-mono flex items-start gap-1 group"
            >
              <code class="truncate flex-1 text-red-700">{{ f.url }}</code>
              <Button
                size="sm"
                variant="ghost"
                class="h-5 px-1 opacity-0 group-hover:opacity-100"
                @click="copyText(f.url)"
              >
                <Copy class="size-3" />
              </Button>
            </div>
          </div>
          <div v-if="lastResult.saved.length > 0" class="text-xs text-green-700">
            已落盘 {{ lastResult.saved.length }} 张
          </div>
        </div>

        <div class="border-t bg-muted/10 px-3 py-2 max-h-32 overflow-y-auto">
          <div class="text-xs font-medium text-muted-foreground mb-1">
            日志
            <button
              v-if="store.logs.length > 0"
              class="ml-2 text-xs text-muted-foreground hover:text-foreground"
              @click="store.clearLogs()"
            >
              <X class="inline size-3" /> 清空
            </button>
          </div>
          <div
            v-for="entry of recentLogs"
            :key="entry.timestamp + entry.message"
            class="text-xs font-mono"
            :class="{
              'text-red-600': entry.level === 'error',
              'text-yellow-600': entry.level === 'warn',
              'text-muted-foreground': entry.level === 'info',
            }"
          >
            {{ new Date(entry.timestamp).toLocaleTimeString() }} {{ entry.message }}
          </div>
          <div v-if="recentLogs.length === 0" class="text-xs text-muted-foreground italic">
            还没有日志
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
