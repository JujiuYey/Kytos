<script setup lang="ts">
import ApiKeySetting from './api-key-setting.vue';
</script>

<template>
  <ApiKeySetting
    service="deepseek"
    title="DeepSeek"
    description="用于角色对话和内容整理。已保存的 Key 不会回传到界面。"
    placeholder="sk-..."
    docs-url="https://platform.deepseek.com/api_keys"
  />
</template>
