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
  mode: 'create' | 'rename';
  open: boolean;
}>();

const emit = defineEmits<{
  (event: 'submit', name: string): void;
  (event: 'update:open', value: boolean): void;
}>();

const name = ref('');
const normalizedName = computed(() => name.value.trim());
const submitDisabled = computed(
  () =>
    props.loading ||
    !normalizedName.value ||
    name.value.length > 100 ||
    (props.mode === 'rename' && normalizedName.value === props.currentName),
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
  if (!submitDisabled.value) {
    emit('submit', normalizedName.value);
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <form class="space-y-5" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ mode === 'create' ? '新建角色' : '修改角色名称' }}</DialogTitle>
          <DialogDescription>
            {{
              mode === 'create'
                ? '先建立角色概要，下一步只负责创建这个角色的第一个形象。'
                : '角色名称会同步到角色概要和相关工作区。'
            }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <Label for="character-summary-name">角色名称</Label>
            <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 100</span>
          </div>
          <Input
            id="character-summary-name"
            v-model="name"
            autofocus
            maxlength="100"
            placeholder="例如：小林、我的产品角色"
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
          <Button type="submit" :disabled="submitDisabled">
            {{ loading ? '保存中' : mode === 'create' ? '创建并继续' : '保存名称' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
