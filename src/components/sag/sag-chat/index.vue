<script setup lang="ts">
import MessageInput from './message-input/index.vue';
import MessageList from './message-list/index.vue';
import { toast } from 'vue-sonner';
import { useConversationsStore } from '@/stores/conversations';
import { useOllamaConfig } from '@/stores/ollama-config';
import { ollamaClient } from '@/services/ollama';
import { nanoid } from 'nanoid';

const settings = computed(() => {
  return useOllamaConfig().configs;
});

const isLoading = ref(false);
const isStreaming = ref(false);
const abortController = shallowRef<AbortController | null>(null);
const streamingContent = ref('');

// 添加 MessageInput 的引用
const messageInputRef = ref<InstanceType<typeof MessageInput>>();

// 消息发送状态接口
interface SendMessageState {
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  abortController: AbortController | null;
  assistantMessageId: string | null;
}

// 验证消息发送条件
function validateSendConditions(message: string): { isValid: boolean; error?: string } {
  if (!message.trim()) {
    return { isValid: false, error: '消息内容不能为空' };
  }

  if (isLoading.value) {
    return { isValid: false, error: '正在处理中，请稍候' };
  }

  if (!settings.value.selectedModel) {
    return { isValid: false, error: '请先选择一个模型' };
  }

  return { isValid: true };
}

// 创建流处理器
function createStreamHandler(state: SendMessageState) {
  const { updateMessageById } = useConversationsStore();

  return {
    onChunk: (chunk: string) => {
      if (state.abortController?.signal.aborted) {
        return;
      }

      state.streamingContent += chunk;
      streamingContent.value = state.streamingContent;

      if (state.assistantMessageId) {
        updateMessageById(state.assistantMessageId, state.streamingContent);
      }
    },
    onStart: () => {
      isLoading.value = false;
      isStreaming.value = true;
    },
  };
}

// 执行API调用
async function executeApiCall(
  message: string,
  currentConversation: any,
  streamHandler: any,
) {
  const requestOptions = {
    temperature: settings.value.temperature,
    num_predict: settings.value.maxTokens,
  };

  const hasMessages = currentConversation && currentConversation.messages.length > 1;

  if (hasMessages) {
    await ollamaClient.chatStreamResponse(
      [
        {
          id: nanoid(),
          role: 'system',
          content: settings.value.systemPrompt,
          timestamp: Date.now(),
        },
        ...currentConversation.messages,
      ],
      settings.value.selectedModel,
      streamHandler.onChunk,
      settings.value.systemPrompt,
      requestOptions,
      streamHandler.onStart,
    );
  } else {
    await ollamaClient.generateStreamResponse(
      message,
      settings.value.selectedModel,
      streamHandler.onChunk,
      settings.value.systemPrompt,
      requestOptions,
      streamHandler.onStart,
    );
  }
}

// 处理消息发送
async function handleSendMessage(message: string) {
  // 1. 验证发送条件
  const validation = validateSendConditions(message);
  if (!validation.isValid) {
    if (validation.error) {
      toast.error(validation.error);
    }
    return;
  }

  // 2. 准备对话上下文
  const { currentConversation, createConversation, createUserMessage, addPlaceholderMessage, updateMessageById } = useConversationsStore();

  if (!currentConversation) {
    createConversation();
  }

  createUserMessage(message);
  const assistantMessageId = addPlaceholderMessage('assistant', '');

  // 3. 初始化状态
  const state: SendMessageState = {
    isLoading: true,
    isStreaming: false,
    streamingContent: '',
    abortController: new AbortController(),
    assistantMessageId,
  };

  // 更新全局状态
  abortController.value = state.abortController;
  isLoading.value = true;
  isStreaming.value = false;
  streamingContent.value = '';

  try {
    // 4. 创建流处理器并执行API调用
    const streamHandler = createStreamHandler(state);
    await executeApiCall(message, currentConversation, streamHandler);

    // 5. 确保最终内容已保存
    if (assistantMessageId && state.streamingContent) {
      updateMessageById(assistantMessageId, state.streamingContent);
    }
  } catch (error) {
    console.error('发送消息失败:', error);

    // 提供详细的错误信息
    let errorMessage = '发送消息失败，请重试';
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查 Ollama 服务是否正常运行';
      } else if (error.message.includes('abort')) {
        errorMessage = '请求已取消';
      } else {
        errorMessage = `发送失败: ${error.message}`;
      }
    }

    toast.error(errorMessage);

    // 保存部分内容
    if (assistantMessageId && state.streamingContent.trim()) {
      updateMessageById(assistantMessageId, state.streamingContent);
    }
  } finally {
    // 6. 清理状态
    isLoading.value = false;
    isStreaming.value = false;
    streamingContent.value = '';
    abortController.value = null;
  }
}

// 处理停止生成
function handleStopGeneration() {
  abortController.value?.abort();
  abortController.value = null;
  isLoading.value = false;
}

function setQuery(template: string) {
  messageInputRef.value?.setInputValue(template);
}

defineExpose({
  setQuery,
});
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 h-full">
    <div class="flex-1 overflow-y-auto">
      <MessageList
        :is-loading="isLoading"
        :is-streaming="isStreaming"
        :streaming-content="streamingContent"
      />
    </div>

    <div class="flex-shrink-0">
      <MessageInput
        ref="messageInputRef"
        :is-loading="isLoading"
        :is-streaming="isStreaming"
        :disabled="isLoading"
        @send-message="handleSendMessage"
        @stop-generation="handleStopGeneration"
      />
    </div>
  </div>
</template>
