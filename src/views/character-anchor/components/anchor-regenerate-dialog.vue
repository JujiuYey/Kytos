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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MAX_CHARACTER_REFERENCE_BOARD_FEEDBACK_LENGTH } from '@/types';

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{
  imageName: string;
  loading: boolean;
  unavailableReason: string;
  error: string;
}>();
const emit = defineEmits<{
  regenerate: [feedback: string];
}>();

const feedback = ref('');
const canSubmit = computed(
  () =>
    !props.loading &&
    !props.unavailableReason &&
    Boolean(feedback.value.trim()) &&
    feedback.value.length <= MAX_CHARACTER_REFERENCE_BOARD_FEEDBACK_LENGTH,
);

watch(open, value => {
  if (value) feedback.value = '';
});

function setOpen(value: boolean): void {
  if (!props.loading) open.value = value;
}

function submit(): void {
  if (canSubmit.value) emit('regenerate', feedback.value.trim());
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>重新生成图片</DialogTitle>
          <DialogDescription class="break-words">{{ imageName }}</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2">
          <Label for="anchor-regenerate-feedback">修改意见</Label>
          <Textarea
            id="anchor-regenerate-feedback"
            v-model="feedback"
            :disabled="loading"
            :maxlength="MAX_CHARACTER_REFERENCE_BOARD_FEEDBACK_LENGTH"
            :rows="4"
            placeholder="例如，保留服装配色，发型轮廓更贴近参考图"
            required
          />
        </div>
        <p v-if="error || unavailableReason" role="alert" class="text-sm text-destructive">
          {{ error || unavailableReason }}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="loading" @click="setOpen(false)">
            取消
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            {{ loading ? '提交中' : '重新生成' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
