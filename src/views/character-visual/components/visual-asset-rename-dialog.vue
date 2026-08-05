<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = defineProps<{
  currentName: string;
  loading: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  (event: 'rename', name: string): void;
  (event: 'update:open', value: boolean): void;
}>();

const name = ref('');
const normalizedName = computed(() => name.value.trim());
const disabled = computed(
  () =>
    props.loading ||
    !normalizedName.value ||
    name.value.length > 80 ||
    normalizedName.value === props.currentName,
);

watch(
  [() => props.open, () => props.currentName],
  ([open, currentName]) => {
    if (open) {
      name.value = currentName;
    }
  },
  { immediate: true },
);

function submit(): void {
  if (!disabled.value) {
    emit('rename', normalizedName.value);
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <form class="space-y-5" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>重命名图片</DialogTitle>
          <DialogDescription>名称用于区分角色视觉中的不同图片。</DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <Label for="rename-character-visual">图片名称</Label>
            <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 80</span>
          </div>
          <Input
            id="rename-character-visual"
            v-model="name"
            maxlength="80"
            placeholder="例如：基础形象、冬季造型、挥手动作"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="loading"
            @click="emit('update:open', false)"
          >
            取消
          </Button>
          <Button type="submit" :disabled="disabled">{{ loading ? '保存中' : '保存名称' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
