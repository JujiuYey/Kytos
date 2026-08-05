<script setup lang="ts">
import ApiKeySetting from './api-key-setting.vue';
</script>

<template>
  <ApiKeySetting
    service="minimax"
    title="MiniMax"
    description="用于接入 MiniMax 文本与多模态模型。已保存的 Key 不会回传到界面。"
    placeholder="输入 MiniMax API Key"
    docs-url="https://platform.minimaxi.com/docs/guides/quickstart-preparation"
  />
</template>
