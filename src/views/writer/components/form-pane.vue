<script setup lang="ts">
import { computed } from 'vue';
import { toast } from 'vue-sonner';
import { Loader2, Sparkles } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app';
import { useGachaStore } from '@/stores/gacha';
import { useWriterStore } from '@/stores/writer';
import { nextCardName } from '@/utils/prompt-directives';

const gacha = useGachaStore();
const writer = useWriterStore();
const app = useAppStore();

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

async function onGenerate() {
  const result = await writer.generate();
  if (!result) {
    toast.error(writer.lastError || '生成失败');
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-6 gap-4 overflow-y-auto">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">
        写卡
      </h1>
      <p class="text-sm text-muted-foreground">
        一句意图 → DeepSeek 出四段结构的 md → 人看一眼 → 保存 → 去抽卡。
      </p>
      <p v-if="!gacha.project?.has_deepseek_key" class="text-xs text-red-600">
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
</template>
