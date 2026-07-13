<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Loader2, Save, Sparkles, ChevronDown, ChevronRight, Brain } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useGachaStore } from '@/stores/gacha';
import { useAppStore } from '@/stores/app';
import { useWriterStore } from '@/stores/writer';
import { nextCardName } from '@/utils/prompt-directives';

const router = useRouter();
const gacha = useGachaStore();
const app = useAppStore();
const writer = useWriterStore();

const showReasoning = ref(false);

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

const categories = computed(() => gacha.project?.categories.map(c => c.name) ?? []);

const existingNames = computed(() => {
  const cat = gacha.project?.categories.find(c => c.name === writer.category);
  return cat?.prompts.map(p => p.name) ?? [];
});

function applyCategory(name: unknown) {
  if (typeof name !== 'string' || !name) {
    return;
  }
  writer.setCategory(name);
  if (gacha.project) {
    writer.name = nextCardName(existingNames.value);
  }
}

const canGenerate = computed(() =>
  Boolean(gacha.projectRoot)
  && Boolean(gacha.project?.has_deepseek_key)
  && !writer.isGenerating
  && Boolean(writer.category)
  && Boolean(writer.name.trim())
  && Boolean(writer.intent.trim()),
);

const canSave = computed(() =>
  Boolean(gacha.projectRoot)
  && Boolean(writer.category)
  && Boolean(writer.name.trim())
  && Boolean(writer.draft.trim())
  && !writer.isGenerating,
);

async function onGenerate() {
  const result = await writer.generate();
  if (!result) {
    toast.error(writer.lastError || '生成失败');
  }
}

async function onSaveAndGo() {
  const outcome = await writer.saveAndGo(path => router.push(path));
  if (!outcome.ok) {
    toast.error(outcome.error || '保存失败');
  } else {
    toast.success('已保存，去抽卡页看了');
  }
}

const isReasoner = computed(() => app.settings.deepseekModel === 'deepseek-reasoner');
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
        <div class="h-full flex flex-col p-6 gap-4 overflow-y-auto">
          <header class="space-y-1">
            <h1 class="text-2xl font-semibold">
              写卡
            </h1>
            <p class="text-sm text-muted-foreground">
              一句意图 → DeepSeek 出四段结构的 md → 人看一眼 → 保存 → 去抽卡。
            </p>
            <p v-if="!gacha.project.has_deepseek_key" class="text-xs text-red-600">
              还没配 DeepSeek key，去「设置」里加。
            </p>
          </header>

          <div class="space-y-2">
            <label class="text-xs text-muted-foreground">类目</label>
            <Select :model-value="writer.category" @update:model-value="applyCategory">
              <SelectTrigger class="font-mono text-sm">
                <SelectValue placeholder="选类目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="cat of categories" :key="cat" :value="cat">
                  {{ cat }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <label class="text-xs text-muted-foreground">名字</label>
            <Input v-model="writer.name" class="font-mono text-sm" placeholder="10-摆烂" />
            <p class="text-xs text-muted-foreground">
              类目里有 {{ existingNames.length }} 张，建议下一个编号
            </p>
          </div>

          <div class="flex items-end gap-3">
            <div class="flex-1 space-y-2">
              <label class="text-xs text-muted-foreground">画幅</label>
              <Select v-model="writer.size">
                <SelectTrigger class="font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt of writer.SIZE_OPTIONS" :key="opt" :value="opt">
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex-1 space-y-2">
              <label class="text-xs text-muted-foreground">分辨率</label>
              <Select v-model="writer.resolution">
                <SelectTrigger class="font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt of writer.RESOLUTION_OPTIONS" :key="opt" :value="opt">
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-2 flex-1 min-h-0 flex flex-col">
            <label class="text-xs text-muted-foreground">意图</label>
            <Textarea
              v-model="writer.intent"
              class="flex-1 resize-none font-mono text-sm"
              placeholder="蹲在坑边上往里看，不是举牌警告，是好奇"
            />
          </div>

          <Button size="lg" :disabled="!canGenerate" @click="onGenerate">
            <Loader2 v-if="writer.isGenerating" class="size-4 animate-spin" />
            <Sparkles v-else class="size-4" />
            {{ writer.isGenerating ? '生成中…' : '生成' }}
            <span v-if="!writer.isGenerating" class="ml-2 text-xs font-mono opacity-70">
              {{ app.settings.deepseekModel }}
            </span>
          </Button>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel :default-size="60" :min-size="35">
        <div class="h-full flex flex-col">
          <header class="px-4 py-2 border-b bg-muted/20 flex items-center gap-3">
            <span class="text-xs text-muted-foreground flex-1">
              {{ writer.category || '—' }} / {{ writer.name || '—' }}.md
            </span>
            <Button
              size="sm"
              :disabled="!canSave"
              @click="onSaveAndGo"
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
            @toggle="showReasoning = ($event.target as HTMLDetailsElement).open"
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
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
