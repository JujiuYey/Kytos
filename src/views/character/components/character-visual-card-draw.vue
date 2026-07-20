<script setup lang="ts">
import { Check, Save, SlidersHorizontal, Sparkles } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GenerationPollingStatus,
  type GenerationPollingStateMap,
} from '@/components/sag/generation-polling-status';
import type { CharacterVisualCard, CharacterVisualCardDraw } from '@/types';

defineProps<{
  busy: boolean;
  draw: CharacterVisualCardDraw;
  pollingStates: GenerationPollingStateMap;
  savingCardIds: string[];
}>();

const emit = defineEmits<{
  (event: 'adjust', card: CharacterVisualCard): void;
  (event: 'save', payload: { card: CharacterVisualCard; draw: CharacterVisualCardDraw }): void;
}>();

function statusLabel(card: CharacterVisualCard): string {
  const labels: Record<CharacterVisualCard['status'], string> = {
    cancelled: '已取消',
    completed: '已生成',
    failed: '生成失败',
    pending: '等待生成',
    processing: '生成中',
    submitted: '已提交',
  };
  return labels[card.status];
}

function badgeVariant(
  card: CharacterVisualCard,
): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (card.status === 'completed') {
    return 'default';
  }
  if (card.status === 'failed' || card.status === 'cancelled') {
    return 'destructive';
  }
  return 'secondary';
}
</script>

<template>
  <section class="p-4">
    <div class="flex flex-wrap items-start gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <Sparkles class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">角色视觉抽卡</h3>
        </div>
        <p class="mt-1 text-xs text-muted-foreground">
          这是可撤回的视觉假设；满意时保存，不满意时说明下一步调整方向
        </p>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-[minmax(0,22rem)] justify-center gap-3">
      <article
        v-for="card in draw.cards"
        :key="card.id"
        class="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background"
      >
        <div class="relative aspect-[2/3] w-full bg-muted/40">
          <AiImage
            v-if="card.image"
            :alt="`${card.title}角色视觉卡`"
            :src="card.image.url"
            class="size-full rounded-none object-cover"
          />
          <div
            v-else-if="card.status === 'failed' || card.status === 'cancelled'"
            class="flex size-full items-center justify-center px-5 text-center text-xs leading-5 text-destructive"
          >
            {{ card.errorMessage || '这张视觉卡没有生成成功' }}
          </div>
          <div v-else class="flex size-full flex-col justify-end p-3">
            <Skeleton class="absolute inset-0 rounded-none" />
            <GenerationPollingStatus
              class="relative rounded-md bg-background/90 p-3 backdrop-blur-sm"
              compact
              :attempt="pollingStates[card.id]?.attempt ?? 0"
              :phase="pollingStates[card.id]?.phase ?? 'waiting'"
            />
          </div>
          <Badge class="absolute left-2 top-2" :variant="badgeVariant(card)">
            {{ statusLabel(card) }}
          </Badge>
        </div>

        <div class="flex min-h-0 flex-1 flex-col p-3">
          <h4 class="text-sm font-medium">{{ card.title }}</h4>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            {{ card.summary }}
          </p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <Badge v-for="tag in card.tags" :key="tag" variant="outline">
              {{ tag }}
            </Badge>
          </div>
          <div v-if="card.status === 'completed'" class="mt-auto grid gap-2 pt-4">
            <Button
              size="sm"
              :variant="card.savedToVisualAt ? 'secondary' : 'default'"
              :disabled="busy || Boolean(card.savedToVisualAt) || savingCardIds.includes(card.id)"
              @click="emit('save', { card, draw })"
            >
              <Check v-if="card.savedToVisualAt" class="size-3.5" />
              <Save v-else class="size-3.5" />
              {{
                card.savedToVisualAt
                  ? '已保存到角色视觉'
                  : savingCardIds.includes(card.id)
                    ? '正在保存'
                    : '保存到角色视觉'
              }}
            </Button>
            <Button size="sm" variant="outline" :disabled="busy" @click="emit('adjust', card)">
              <SlidersHorizontal class="size-3.5" />
              调整方向
            </Button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
