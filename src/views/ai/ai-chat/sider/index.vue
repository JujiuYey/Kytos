<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import Conversations from './conversations.vue';
import { useConversationsStore } from '@/stores/conversations';

// 只需要获取新建对话的方法
const { clearCurrentConversation } = useConversationsStore();

function handleNewConversation() {
  clearCurrentConversation();
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-2 p-2 border-b">
      <Button class="w-full" size="sm" @click="handleNewConversation">
        <Plus class="h-4 w-4 mr-2" />
        新建对话
      </Button>
    </div>
    <Conversations />
  </div>
</template>
