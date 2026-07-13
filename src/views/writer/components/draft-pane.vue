<script setup lang="ts">
import { ref } from 'vue';
import { Brain, ChevronDown, ChevronRight, Save } from 'lucide-vue-next';
import { useWriterStore } from '@/stores/writer';

defineProps<{
  canSave: boolean;
  isReasoner: boolean;
}>();

const emit = defineEmits<{
  saveAndGo: [];
  toggleReasoning: [open: boolean];
}>();

const writer = useWriterStore();

const showReasoning = ref(false);

function onToggle(e: Event) {
  const open = (e.target as HTMLDetailsElement).open;
  showReasoning.value = open;
  emit('toggleReasoning', open);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="px-4 py-2 border-b bg-muted/20 flex items-center gap-3">
      <span class="text-xs text-muted-foreground flex-1">
        {{ writer.category || '—' }} / {{ writer.name || '—' }}.md
      </span>
      <Button
        size="sm"
        :disabled="!canSave"
        @click="emit('saveAndGo')"
      >
        <Save class="size-3" />
        保存并去抽卡
      </Button>
    </header>

    <div v-if="!isReasoner && writer.reasoning" class="border-b bg-muted/10 text-xs text-muted-foreground px-4 py-1 italic">
      （deepseek-chat 不输出思维链）
    </div>

    <details
      v-if="isReasoner && writer.reasoning"
      :open="showReasoning"
      class="border-b bg-muted/10"
      @toggle="onToggle"
    >
      <summary class="cursor-pointer select-none px-4 py-2 text-xs text-muted-foreground flex items-center gap-1">
        <component :is="showReasoning ? ChevronDown : ChevronRight" class="size-3" />
        <Brain class="size-3" />
        思维链 ({{ writer.reasoning.length }} 字)
      </summary>
      <pre class="whitespace-pre-wrap break-words px-4 pb-2 text-xs font-mono text-muted-foreground">{{ writer.reasoning }}</pre>
    </details>

    <div class="flex-1 overflow-hidden flex flex-col">
      <Textarea
        v-model="writer.draft"
        class="flex-1 resize-none font-mono text-sm leading-relaxed rounded-none border-0 focus-visible:ring-0"
        spellcheck="false"
        placeholder="生成的 md 会一个字一个字流到这里，可改"
      />
    </div>

    <footer v-if="writer.lastError" class="border-t px-4 py-2 text-xs text-red-600">
      {{ writer.lastError }}
    </footer>
  </div>
</template>
