<script setup lang="ts">
import ApiKeySetting from './api-key-setting.vue';
</script>

<template>
  <ApiKeySetting
    service="apimart"
    title="APIMart"
    description="用于图片生成服务。Key 只在调用服务时由主进程读取。"
    placeholder="输入 APIMart API Key"
    docs-url="https://apimart.ai"
  />
</template>
