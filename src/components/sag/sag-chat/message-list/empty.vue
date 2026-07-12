<script lang="ts" setup>
import { Bot, Sparkles } from 'lucide-vue-next';
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="text-center max-w-md">
      <div class="mb-6 flex justify-center">
        <div class="relative">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <Bot class="w-8 h-8 text-white" />
          </div>
          <div class="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
            <Sparkles class="w-3 h-3 text-yellow-800" />
          </div>
        </div>
      </div>

      <h3 class="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
        欢迎使用 AI 助手
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
        我是您的智能助手，可以帮助您解答问题、处理任务或进行有趣的对话。请开始我们的交流吧！
      </p>

      <div class="grid grid-cols-1 gap-3 text-sm">
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-left">
          <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">
            💡 问题解答
          </div>
          <div class="text-gray-600 dark:text-gray-400">
            回答各种问题，提供专业建议
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-left">
          <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">
            ✍️ 内容创作
          </div>
          <div class="text-gray-600 dark:text-gray-400">
            帮助编写文档、邮件或创意内容
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-left">
          <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">
            🤝 日常对话
          </div>
          <div class="text-gray-600 dark:text-gray-400">
            进行轻松愉快的交流和讨论
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
