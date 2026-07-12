import { defineStore } from 'pinia';
import type { Conversation } from '@/types';
import { nanoid } from 'nanoid';

export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>([]);

  const setConversations = (newConversations: Conversation[]) => {
    conversations.value = newConversations;
  };

  const updateConversation = (updatedConversation: Conversation) => {
    const index = conversations.value.findIndex(conv => conv.id === updatedConversation.id);
    if (index !== -1) {
      conversations.value[index] = updatedConversation;
    }
  };

  const addConversation = (conversation: Conversation) => {
    conversations.value.push(conversation);
  };

  const deleteConversation = (id: string) => {
    conversations.value = conversations.value.filter(conv => conv.id !== id);
    if (currentConversationId.value === id) {
      currentConversationId.value = null;
    }
  };

  const clearConversations = () => {
    conversations.value = [];
    currentConversationId.value = null;
  };

  // ----------------- 当前对话管理---------------
  const currentConversationId = ref<string | null>(null);
  const currentConversation = ref<Conversation | null>(null);

  const setCurrentConversationId = (id: string | null) => {
    currentConversationId.value = id;
    if (id) {
      currentConversation.value = conversations.value.find(conv => conv.id === id) || null;
    } else {
      currentConversation.value = null;
    }
  };

  const createConversation = () => {
    const newConversation: Conversation = {
      id: nanoid(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addConversation(newConversation);
    setCurrentConversationId(newConversation.id);
    currentConversation.value = newConversation;
  };

  const createUserMessage = (content: string) => {
    return addPlaceholderMessage('user', content);
  };

  // 添加一个占位的assistant消息
  const addPlaceholderMessage = (role: 'user' | 'assistant', content: string = '') => {
    if (currentConversation.value) {
      const newMessage = {
        id: nanoid(),
        role,
        content,
        timestamp: Date.now(),
      };
      currentConversation.value.messages.push(newMessage);
      return newMessage.id;
    }
    return null;
  };

  // 根据ID更新消息内容
  const updateMessageById = (messageId: string, content: string) => {
    if (currentConversation.value) {
      const message = currentConversation.value.messages.find(msg => msg.id === messageId);
      if (message) {
        message.content = content;
        message.timestamp = Date.now();
      }
    }
  };

  const clearCurrentConversation = () => {
    currentConversationId.value = null;
    currentConversation.value = null;
  };

  return {
    conversations,
    currentConversationId,
    currentConversation,
    setConversations,
    setCurrentConversationId,
    updateConversation,
    addConversation,
    deleteConversation,
    clearConversations,

    createConversation,
    addPlaceholderMessage,
    updateMessageById,
    createUserMessage,
    clearCurrentConversation,
  };
}, {
  persist: {
    key: 'vue-ollama-chat-conversations',
    storage: localStorage,
    pick: ['conversations', 'currentConversationId'],
  },
});
