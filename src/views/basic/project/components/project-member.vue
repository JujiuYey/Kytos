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
import { Plus, X } from 'lucide-vue-next';
import { ref } from 'vue';

import { projectMemberService } from '@/api/project-member';
import { toast } from 'vue-sonner';

interface Props {
  /**
   * 是否打开
   */
  open: boolean;
  /**
   * 项目ID
   */
  projectId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'confirm', members: string[]): void;
  (e: 'update:open', value: boolean): void;
}>();

const memberInput = ref('');
const members = ref<string[]>([]);

function addMember() {
  const name = memberInput.value.trim();
  if (name && !members.value.includes(name)) {
    members.value.push(name);
    memberInput.value = '';
  }
}

function removeMember(index: number) {
  members.value.splice(index, 1);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    addMember();
  }
}

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

watch(() => props.open, () => {
  fetchMembers();
});

async function fetchMembers() {
  if (!props.projectId) {
    return;
  }

  try {
    const res = await projectMemberService.list(props.projectId);
    members.value = res.map(member => member.member_name);
  } catch (error) {
    toast.error(`${error}`);
  }
}

async function handleConfirm() {
  if (!props.projectId) {
    return;
  }

  try {
    await projectMemberService.batchUpdateMembers(props.projectId, members.value);

    emit('confirm', members.value);
    emit('update:open', false);
  } catch (error) {
    toast.error(`${error}`);
  }
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
          <DialogTitle>项目成员设置</DialogTitle>
        </div>
        <DialogDescription>
          项目成员设置
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Input
              v-model="memberInput"
              type="text"
              placeholder="输入成员姓名"
              @keydown="handleKeydown"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            :disabled="!memberInput.trim()"
            @click="addMember"
          >
            <Plus class="h-4 w-4" />
          </Button>
        </div>

        <div v-if="members.length > 0" class="space-y-2">
          <div v-for="(member, index) of members" :key="index" class="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
            <span>{{ member }}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="removeMember(index)"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          @click="handleCancel"
        >
          取消
        </Button>
        <Button
          variant="default"
          @click="handleConfirm"
        >
          确认
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
