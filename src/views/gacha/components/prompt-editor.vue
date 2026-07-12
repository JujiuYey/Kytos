<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Loader2, Save } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();

const SIZE_OPTIONS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'];
const RESOLUTION_OPTIONS = ['1k', '2k'];

const draftRaw = ref('');
const draftSize = ref<string>('16:9');
const draftResolution = ref<string>('1k');

watch(
  () => store.promptDetail,
  detail => {
    if (detail) {
      draftRaw.value = detail.raw;
      draftSize.value = detail.size;
      draftResolution.value = detail.resolution;
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
  // Replace existing <!-- size: --> / <!-- resolution: --> lines if present;
  // otherwise insert at the top.
  const sizeLine = `<!-- size: ${size} -->`;
  const resolutionLine = `<!-- resolution: ${resolution} -->`;
  let updated = raw
    .replace(/^<!--\s*size\s*:\s*\S+?\s*-->\s*/m, '')
    .replace(/^<!--\s*resolution\s*:\s*\S+?\s*-->\s*/m, '');
  // Trim leading blank lines so the directives stay on the first lines.
  updated = updated.replace(/^\n+/, '');
  updated = `${sizeLine}\n${resolutionLine}\n\n${updated}`;
  return updated;
}

async function save() {
  const finalRaw = syncDirectives(draftRaw.value, draftSize.value, draftResolution.value);
  const ok = await store.savePrompt(finalRaw);
  if (ok) {
    // Refresh detail so dirty/draft state resets.
    if (store.selectedPrompt) {
      await store.selectPrompt(store.selectedPrompt.categoryName, store.selectedPrompt.prompt);
    }
  }
}

const logEntries = computed(() => store.logs.slice(-30).reverse());
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="!store.promptDetail" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      左栏选一张卡片开始
    </div>

    <template v-else>
      <header class="px-4 py-2 border-b flex items-center gap-3 bg-muted/20">
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
          :disabled="!dirty || store.isSaving"
          @click="save"
        >
          <Loader2 v-if="store.isSaving" class="size-3 animate-spin" />
          <Save v-else class="size-3" />
          保存
        </Button>
      </header>

      <div class="flex-1 overflow-hidden flex flex-col">
        <Textarea
          v-model="draftRaw"
          class="flex-1 resize-none font-mono text-sm rounded-none border-0 border-b focus-visible:ring-0"
          spellcheck="false"
        />

        <div class="h-32 overflow-y-auto border-t bg-muted/10 px-3 py-2">
          <div class="text-xs font-medium text-muted-foreground mb-1">
            日志
          </div>
          <div
            v-for="entry of logEntries"
            :key="entry.timestamp"
            class="text-xs font-mono"
            :class="{
              'text-red-600': entry.level === 'error',
              'text-yellow-600': entry.level === 'warn',
              'text-muted-foreground': entry.level === 'info',
            }"
          >
            {{ new Date(entry.timestamp).toLocaleTimeString() }} {{ entry.message }}
          </div>
          <div v-if="logEntries.length === 0" class="text-xs text-muted-foreground italic">
            还没有日志
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
