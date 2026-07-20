<script setup lang="ts">
import { computed } from 'vue';
import { CircleDashed } from '@lucide/vue';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CharacterDraft, CharacterDraftField } from '@/types';
import { getCharacterDraftProgress } from '@/types';

const props = defineProps<{
  draft: CharacterDraft;
}>();

interface FieldDefinition {
  field: CharacterDraftField;
  label: string;
  placeholder: string;
}

const fieldGroups: Array<{
  fields: FieldDefinition[];
  label: string;
}> = [
  {
    label: '人物种子',
    fields: [
      { field: 'name', label: '姓名', placeholder: '尚未命名' },
      {
        field: 'characterSeed',
        label: '人物种子',
        placeholder: '一句话说明人物大概是谁',
      },
    ],
  },
  {
    label: '形象锚点',
    fields: [
      { field: 'visualSummary', label: '视觉总述', placeholder: '最容易识别人物的具体视觉组合' },
      { field: 'ageAndBuild', label: '年龄与体态', placeholder: '年龄感、体型、比例和整体姿态' },
      { field: 'faceAnchor', label: '脸部锚点', placeholder: '脸型、眼睛、眉毛和嘴型等稳定特征' },
      { field: 'hairAnchor', label: '发型锚点', placeholder: '发型、发色、长度和轮廓' },
      { field: 'defaultOutfit', label: '默认服装', placeholder: '最常用、最具识别度的基础造型' },
      { field: 'characterPalette', label: '角色配色', placeholder: '属于角色身份的固有颜色关系' },
      { field: 'signatureItems', label: '标志物', placeholder: '配饰、道具或身体识别特征' },
      {
        field: 'silhouetteMarkers',
        label: '轮廓识别点',
        placeholder: '缩小或剪影时仍能认出的组合',
      },
    ],
  },
  {
    label: '视觉表现',
    fields: [
      { field: 'visualMedium', label: '表现形式', placeholder: '线稿、赛璐璐、厚涂、像素等形式' },
      { field: 'lineAndShape', label: '线条与造型', placeholder: '线条、简化程度和夸张方式' },
      { field: 'colorRules', label: '色彩规则', placeholder: '全彩、有限色或强调色的使用方式' },
      { field: 'detailDensity', label: '细节密度', placeholder: '人物、服装和环境的细节程度' },
      {
        field: 'backgroundRules',
        label: '背景规则',
        placeholder: '留白、环境线条或完整场景的处理',
      },
      { field: 'textRules', label: '文字规则', placeholder: '手写文字、注释和漫画符号的使用规则' },
      {
        field: 'exclusions',
        label: '排除项',
        placeholder: '明确不希望出现的形象或画面特征',
      },
    ],
  },
];

const progress = computed(() => getCharacterDraftProgress(props.draft));
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b px-5 py-4">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="font-medium">关键资料完整度</span>
        <span class="tabular-nums text-muted-foreground">{{ progress.completion }}%</span>
      </div>
      <Progress :model-value="progress.completion" class="mt-2 h-1.5" />
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <section v-for="group in fieldGroups" :key="group.label">
        <h3 class="border-y bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground">
          {{ group.label }}
        </h3>
        <dl class="divide-y">
          <div v-for="item in group.fields" :key="item.field" class="px-5 py-4">
            <dt class="mb-1.5 text-xs font-medium text-muted-foreground">{{ item.label }}</dt>
            <dd v-if="draft[item.field]" class="whitespace-pre-wrap break-words text-sm leading-6">
              {{ draft[item.field] }}
            </dd>
            <dd v-else class="flex items-center gap-2 text-sm text-muted-foreground/70">
              <CircleDashed class="size-3.5 shrink-0" />
              {{ item.placeholder }}
            </dd>
          </div>
        </dl>
      </section>
    </ScrollArea>
  </div>
</template>
