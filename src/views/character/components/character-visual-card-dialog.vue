<script setup lang="ts">
import { Sparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ArtStyle } from '@/types';

defineProps<{
  artStyles: ArtStyle[];
  busy: boolean;
  open: boolean;
  selectedArtStyleId: string;
}>();

const emit = defineEmits<{
  (event: 'generate'): void;
  (event: 'update:open', value: boolean): void;
  (event: 'update:selectedArtStyleId', value: string): void;
}>();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>抽取角色视觉卡</DialogTitle>
        <DialogDescription>
          系统会先把当前角色草稿转成 3 个具体视觉假设，再分别生成图片。
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-2 py-2">
        <Label for="character-visual-card-style">画风</Label>
        <Select
          :model-value="selectedArtStyleId"
          :disabled="busy"
          @update:model-value="emit('update:selectedArtStyleId', String($event))"
        >
          <SelectTrigger id="character-visual-card-style" class="w-full">
            <SelectValue placeholder="选择画风" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="style in artStyles" :key="style.id" :value="style.id">
              {{ style.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs leading-5 text-muted-foreground">
          视觉卡只用于角色探索，不会自动进入正式角色资产。生成 3 张图片会产生实际费用。
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="busy || !selectedArtStyleId" @click="emit('generate')">
          <Sparkles class="size-4" />
          {{ busy ? '正在准备视觉简报' : '抽 3 张视觉卡' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
