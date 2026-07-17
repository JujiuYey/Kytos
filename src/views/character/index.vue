<script setup lang="ts">
import { ref } from 'vue';

// import CharacterChatHeader from './components/character-chat-header.vue';
// import CharacterChatInput from './components/character-chat-input.vue';
// import CharacterChatMessages from './components/character-chat-messages.vue';
// import ChatSummaryPreview from './components/chat-summary-preview.vue';

const noProject = ref(false);
</script>

<template>
  <div class="h-full flex flex-col">
    <div
      v-if="noProject"
      class="h-full flex items-center justify-center p-6 text-sm text-muted-foreground"
    >
      先去「设置」里选一个项目目录。
    </div>
  </div>
</template>
