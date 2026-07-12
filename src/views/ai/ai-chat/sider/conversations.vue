<script setup lang="ts">
import { MessageSquare, Trash2 } from 'lucide-vue-next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatTimestamp, truncateText } from '@/utils/helpers';
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useConversationsStore } from '@/stores/conversations';

// 直接从 store 获取数据和方法
const store = useConversationsStore();
const { conversations, currentConversationId } = storeToRefs(store);
const { setCurrentConversationId, deleteConversation } = store;

// 删除确认对话框状态
const showDeleteConfirm = ref(false);
const conversationToDelete = ref<string | null>(null);

function selectConversation(id: string) {
  setCurrentConversationId(id);
}

function handleDeleteConversation(e: MouseEvent, conversationId: string) {
  e.stopPropagation();
  conversationToDelete.value = conversationId;
  showDeleteConfirm.value = true;
}

function confirmDeleteConversation() {
  if (conversationToDelete.value) {
    deleteConversation(conversationToDelete.value);
    showDeleteConfirm.value = false;
    conversationToDelete.value = null;
  }
}

function cancelDeleteConversation() {
  showDeleteConfirm.value = false;
  conversationToDelete.value = null;
}
</script>

<template>
  <div class="p-2 space-y-2">
    <div v-if="conversations.length === 0" class="text-center py-8 text-muted-foreground">
      <MessageSquare class="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p class="text-sm">
        暂无对话
      </p>
    </div>
    <template v-else>
      <Card
        v-for="conversation of conversations"
        :key="conversation.id"
        :class="`p-3 cursor-pointer transition-colors hover:bg-muted/50 group ${
          currentConversationId === conversation.id
            ? 'bg-muted border-primary'
            : ''
        }`"
        @click="selectConversation(conversation.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="font-medium text-sm truncate">
              {{ truncateText(conversation.title, 30) }}
            </h4>
            <div class="flex items-center gap-2 mt-1">
              <Badge variant="secondary" class="text-xs">
                {{ conversation.messages.length }} 条消息
              </Badge>
              <span class="text-xs text-muted-foreground">
                {{ formatTimestamp(conversation.updatedAt) }}
              </span>
            </div>
          </div>

          <!-- 删除按钮 -->
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="删除对话"
            @click="(e: MouseEvent) => handleDeleteConversation(e, conversation.id)"
          >
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>
      </Card>
    </template>

    <!-- 删除确认对话框 -->
    <Dialog :open="showDeleteConfirm" @update:open="(value) => showDeleteConfirm = value">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            你确定要删除这个对话吗？此操作不可撤销，该对话的所有消息将被永久删除。
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2 pt-4">
          <Button variant="outline" @click="cancelDeleteConversation">
            取消
          </Button>
          <Button variant="destructive" @click="confirmDeleteConversation">
            <Trash2 class="h-4 w-4 mr-2" />
            确认删除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
