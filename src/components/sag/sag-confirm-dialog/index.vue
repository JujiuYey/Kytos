<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-vue-next';

interface Props {
  /**
   * 是否打开
   */
  open: boolean;
  /**
   * 标题
   */
  title?: string;
  /**
   * 描述
   */
  description?: string;
  /**
   * 确认按钮文本
   */
  confirmText?: string;
  /**
   * 取消按钮文本
   */
  cancelText?: string;
  /**
   * 是否加载中
   */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认删除',
  description: '此操作不可恢复，确定要删除吗？',
  confirmText: '确定删除',
  cancelText: '取消',
  loading: false,
});

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'update:open', value: boolean): void;
}>();

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('update:open', false);
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle class="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle>{{ title }}</DialogTitle>
        </div>
        <DialogDescription>
          {{ description }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ cancelText }}
        </Button>
        <Button
          variant="destructive"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
