<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { Send, Square } from 'lucide-vue-next';

interface MessageInputProps {
  isStreaming?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

// Props
const props = withDefaults(defineProps<MessageInputProps>(), {
  isStreaming: false,
  isLoading: false,
  disabled: false,
});

// Emits
const emit = defineEmits<{
  (e: 'sendMessage', message: string): void;
  (e: 'stopGeneration'): void;
}>();

// Reactive data
const message = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isFocused = ref(false);

// Computed
const canSend = computed(() => {
  return message.value.trim() && !props.isLoading && !props.isStreaming && !props.disabled;
});

// 自动调整文本框高度
function adjustTextareaHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    const scrollHeight = textareaRef.value.scrollHeight;
    textareaRef.value.style.height = `${Math.min(scrollHeight, 200)}px`;
  }
}

// Watch message changes to adjust height
watch(message, () => {
  nextTick(() => {
    adjustTextareaHeight();
  });
});

// 自动聚焦
watch(
  () => props.disabled,
  newDisabled => {
    if (!newDisabled && textareaRef.value) {
      textareaRef.value.focus();
    }
  },
);

// 组件挂载后自动聚焦
onMounted(() => {
  if (!props.disabled && textareaRef.value) {
    textareaRef.value.focus();
  }
});

// Methods
function handleSubmit(e: Event) {
  e.preventDefault();
  if (message.value.trim() && !props.isLoading && !props.isStreaming && !props.disabled) {
    emit('sendMessage', message.value.trim());
    message.value = '';
    // 发送后重新聚焦
    setTimeout(() => {
      textareaRef.value?.focus();
    }, 100);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit(e);
  }
}

function handleStop() {
  emit('stopGeneration');
}

// 设置输入框的值
function setInputValue(value: string) {
  message.value = value;
  nextTick(() => {
    adjustTextareaHeight();
    textareaRef.value?.focus();
  });
}

// 暴露方法给父组件
defineExpose({
  setInputValue,
});
</script>

<template>
  <div class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="max-w-4xl mx-auto p-4">
      <form @submit="handleSubmit">
        <div
          class="relative flex items-center rounded-2xl border transition-all duration-200 px-4 py-3" :class="[
            isFocused
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            disabled ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800',
          ]"
        >
          <!-- 文本输入区域 -->
          <div class="flex-1">
            <textarea
              ref="textareaRef"
              v-model="message"
              :placeholder="disabled ? '请先配置 Ollama 服务...' : '输入消息...'"
              :disabled="disabled"
              class="min-h-[24px] max-h-[200px] resize-none border-0 focus:ring-0 focus:outline-none bg-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 leading-6 w-full p-0"
              rows="1"
              :style="{
                boxShadow: 'none',
                fontSize: '16px',
              }"
              @keydown="handleKeyDown"
              @focus="isFocused = true"
              @blur="isFocused = false"
            />
          </div>

          <!-- 右侧操作区域 -->
          <div class="flex items-center gap-2 ml-3">
            <!-- 字符计数 -->
            <span
              v-if="message.length > 0"
              class="text-xs" :class="[
                message.length > 1800 ? 'text-red-500' : 'text-gray-400',
              ]"
            >
              {{ message.length }}
            </span>

            <!-- 发送/停止按钮 -->
            <Button
              v-if="isLoading || isStreaming"
              type="button"
              class="h-8 w-8 p-0 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 border bg-transparent transition-colors"
              title="停止生成"
              @click="handleStop"
            >
              <Square class="h-3 w-3" />
            </Button>
            <Button
              v-else
              type="submit"
              :disabled="!canSend"
              class="h-8 w-8 p-0 rounded-full transition-all duration-200" :class="[
                canSend
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transform hover:scale-105'
                  : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
              ]"
              title="发送消息"
            >
              <Send class="h-3 w-3" />
            </Button>
          </div>
        </div>

        <!-- 底部提示信息 -->
        <div
          v-if="disabled || isFocused"
          class="flex items-center justify-between mt-2 px-1"
        >
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{
              disabled
                ? '请在设置中配置 Ollama 服务地址'
                : '按 Enter 发送，Shift+Enter 换行'
            }}
          </span>
          <span
            v-if="!disabled"
            class="text-xs text-gray-400 dark:text-gray-500"
          >
            最多 2000 字符
          </span>
        </div>
      </form>
    </div>
  </div>
</template>
