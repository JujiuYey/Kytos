<script setup lang="ts">
import { computed } from 'vue';
import { ClipboardList } from '@lucide/vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CharacterPromptDraft } from '../workflow-data';

const props = defineProps<{
  draft: CharacterPromptDraft;
}>();

type DraftField = keyof CharacterPromptDraft;

const groups: Array<{
  title: string;
  fields: Array<{ key: DraftField; label: string }>;
}> = [
  {
    title: '我的 IP 形象',
    fields: [
      { key: 'age', label: '年龄' },
      { key: 'gender', label: '性别' },
      { key: 'hairColor', label: '头发颜色' },
      { key: 'hairstyle', label: '头发长短 / 发型' },
      { key: 'clothingColor', label: '衣服颜色' },
      { key: 'clothingStyle', label: '衣服款式' },
      { key: 'clothingLength', label: '衣服长短' },
      { key: 'bottomsColor', label: '裤子 / 裙子颜色' },
      { key: 'bottomsStyle', label: '裤子 / 裙子款式' },
      { key: 'bottomsLength', label: '裤子 / 裙子长短' },
      { key: 'shoesColor', label: '鞋子颜色' },
      { key: 'shoesStyle', label: '鞋子款式' },
      { key: 'shoesHeight', label: '鞋子长短 / 高度' },
      { key: 'accessories', label: '可选配饰' },
      { key: 'props', label: '可选物品 / 道具' },
      { key: 'characterMood', label: '角色气质' },
    ],
  },
  {
    title: '我的配色',
    fields: [
      { key: 'primaryColor', label: '主色' },
      { key: 'secondaryColor', label: '辅助色' },
      { key: 'accentColor', label: '强调色' },
      { key: 'backgroundColor', label: '背景色' },
      { key: 'forbiddenColors', label: '禁用颜色' },
      { key: 'overallStyleKeywords', label: '整体风格关键词' },
    ],
  },
];

const allFields = groups.flatMap(group => group.fields);
const confirmedCount = computed(
  () => allFields.filter(field => Boolean(props.draft[field.key].trim())).length,
);
</script>

<template>
  <aside
    class="flex h-[32rem] min-h-0 flex-col overflow-hidden rounded-lg border bg-background"
    aria-label="角色形象草稿"
  >
    <header class="flex h-[57px] shrink-0 items-center justify-between gap-3 border-b px-4">
      <div class="flex min-w-0 items-center gap-2">
        <ClipboardList class="size-4 shrink-0" />
        <h3 class="truncate text-sm font-medium">形象草稿</h3>
      </div>
      <span class="shrink-0 text-xs text-muted-foreground">
        已确认 {{ confirmedCount }} / {{ allFields.length }}
      </span>
    </header>

    <ScrollArea class="min-h-0 flex-1">
      <div class="px-4 py-4">
        <section v-for="group in groups" :key="group.title" class="mb-6 last:mb-0">
          <h4 class="mb-2 text-xs font-semibold text-foreground">{{ group.title }}</h4>
          <dl class="divide-y border-y">
            <div
              v-for="field in group.fields"
              :key="field.key"
              class="grid grid-cols-[minmax(0,7.25rem)_minmax(0,1fr)] gap-3 py-2.5 text-xs leading-5"
            >
              <dt class="text-muted-foreground">{{ field.label }}</dt>
              <dd
                :class="[
                  'min-w-0 break-words text-right',
                  draft[field.key] ? 'text-foreground' : 'text-muted-foreground/60',
                ]"
              >
                {{ draft[field.key] || '待确认' }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </ScrollArea>
  </aside>
</template>
