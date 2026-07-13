<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { useGachaStore } from '@/stores/gacha';
import { useAppStore } from '@/stores/app';
import { useWriterStore } from '@/stores/writer';
import { nextCardName } from '@/utils/prompt-directives';
import FormPane from './components/form-pane.vue';
import DraftPane from './components/draft-pane.vue';

const router = useRouter();
const gacha = useGachaStore();
const app = useAppStore();
const writer = useWriterStore();

onMounted(() => {
  if (gacha.projectRoot) {
    writer.ensureContextLoaded(gacha.projectRoot);
    if (!writer.category && gacha.project?.categories.length) {
      const first = gacha.project.categories[0];
      if (first) {
        applyCategory(first.name);
      }
    }
  }
});

function applyCategory(name: unknown) {
  if (typeof name !== 'string' || !name) {
    return;
  }
  writer.setCategory(name);
  if (gacha.project) {
    const cat = gacha.project.categories.find(c => c.name === writer.category);
    const existing = cat?.prompts.map(p => p.name) ?? [];
    writer.name = nextCardName(existing);
  }
}

const isReasoner = computed(() => app.settings.deepseekModel === 'deepseek-reasoner');

const canSave = computed(() =>
  Boolean(gacha.projectRoot)
  && Boolean(writer.category)
  && Boolean(writer.name.trim())
  && Boolean(writer.draft.trim())
  && !writer.isGenerating,
);

async function onSaveAndGo() {
  const outcome = await writer.saveAndGo(path => router.push(path));
  if (!outcome.ok) {
    toast.error(outcome.error || '保存失败');
  } else {
    toast.success('已保存，去抽卡页看了');
  }
}
</script>

<template>
  <div class="h-full">
    <div v-if="!gacha.projectRoot" class="h-full flex items-center justify-center">
      <div class="text-center space-y-3 max-w-md">
        <h2 class="text-lg font-semibold">
          还没设置项目目录
        </h2>
        <p class="text-sm text-muted-foreground">
          去「设置」里选一个项目目录。
        </p>
      </div>
    </div>

    <div v-else-if="!gacha.project" class="h-full flex items-center justify-center">
      <p class="text-sm text-muted-foreground">
        正在扫描…
      </p>
    </div>

    <ResizablePanelGroup v-else direction="horizontal" class="h-full">
      <ResizablePanel :default-size="40" :min-size="30" :max-size="55">
        <FormPane />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel :default-size="60" :min-size="35">
        <DraftPane
          :can-save="canSave"
          :is-reasoner="isReasoner"
          @save-and-go="onSaveAndGo"
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
