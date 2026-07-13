<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import { useContextStore } from '@/stores/context';
import ContextEditor from '@/components/context-editor.vue';
import ChatTab from './components/chat-tab.vue';

const project = useGachaStore();
const context = useContextStore();

const activeTab = ref<'write' | 'chat'>('write');

onMounted(async () => {
  if (project.projectRoot) {
    await context.load(project.projectRoot);
  }
});

function onAccepted() {
  activeTab.value = 'write';
}
</script>

<template>
  <Tabs v-model:value="activeTab" class="h-full">
    <TabsList class="m-2">
      <TabsTrigger value="write">
        手写
      </TabsTrigger>
      <TabsTrigger value="chat">
        对话
      </TabsTrigger>
    </TabsList>
    <TabsContent value="write" class="h-[calc(100%-3rem)] mt-0">
      <ContextEditor
        kind="ip"
        label="特征"
        helper-text="你的人物形象是谁、ta该演什么。写卡时作为 system prompt 发给 DeepSeek。"
      />
    </TabsContent>
    <TabsContent value="chat" class="h-[calc(100%-3rem)] mt-0">
      <ChatTab @accepted="onAccepted" />
    </TabsContent>
  </Tabs>
</template>
