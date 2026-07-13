<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Loader2, Save } from 'lucide-vue-next';
import { useContextStore } from '@/stores/context';
import { useGachaStore } from '@/stores/gacha';
import type { ContextKind } from '@/types/writer';

const props = defineProps<{
  kind: ContextKind;
  helperText: string;
  label: string;
}>();

const store = useContextStore();
const project = useGachaStore();

const draft = ref('');
const lastSaved = ref('');

const content = computed(() => (props.kind === 'ip' ? store.ip : store.agents));
const path = computed(() => (props.kind === 'ip' ? store.ipPath : store.agentsPath));
const dirty = computed(() => draft.value !== lastSaved.value);
const canSave = computed(() => Boolean(project.projectRoot) && dirty.value && !store.isSaving);

watch(
  content,
  value => {
    draft.value = value;
    lastSaved.value = value;
  },
  { immediate: true },
);

async function onSave() {
  if (!project.projectRoot) {
    return;
  }
  const ok = await store.save(project.projectRoot, props.kind, draft.value);
  if (ok) {
    lastSaved.value = draft.value;
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-6 max-w-4xl mx-auto gap-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">
        {{ label }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ helperText }}
      </p>
      <p class="text-xs text-muted-foreground font-mono break-all">
        正在改 <code>{{ path || '—' }}</code>
      </p>
    </header>

    <div v-if="!project.projectRoot" class="rounded border border-dashed p-6 text-sm text-muted-foreground">
      先去「设置」里选一个项目目录。
    </div>

    <template v-else>
      <textarea
        v-model="draft"
        class="flex-1 min-h-[60vh] w-full resize-none rounded border bg-muted/30 p-4 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
        spellcheck="false"
        :disabled="store.isLoading"
      />

      <footer class="flex items-center justify-between gap-3">
        <span v-if="store.lastError" class="text-xs text-red-600 flex-1 break-all">
          {{ store.lastError }}
        </span>
        <span v-else-if="dirty" class="text-xs text-muted-foreground">
          未保存
        </span>
        <span v-else class="text-xs text-muted-foreground">
          已保存
        </span>
        <Button :disabled="!canSave" @click="onSave">
          <Loader2 v-if="store.isSaving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </Button>
      </footer>
    </template>
  </div>
</template>
