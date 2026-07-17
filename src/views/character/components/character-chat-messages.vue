<script setup lang="ts">
import type { ChatStatus } from 'ai';
import { Bot, Check, FileText, PencilLine } from 'lucide-vue-next';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool';
import type { CharacterAgentMessage, CharacterDraftField } from '@/types';

defineProps<{
  messages: CharacterAgentMessage[];
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'suggest', text: string): void;
}>();

const fieldLabels: Record<CharacterDraftField, string> = {
  appearance: '外形',
  background: '背景',
  concept: '核心概念',
  motivation: '动机',
  name: '姓名',
  personality: '性格',
  relationships: '关系',
  speechStyle: '说话方式',
  visualDirection: '视觉方向',
};

const startingSuggestions = [
  '我有一个角色想法，帮我逐步完善',
  '从零开始问我问题，创建一个新角色',
  '我想先确定角色的核心概念',
];
</script>

<template>
  <Conversation class="min-h-0 flex-1">
    <ConversationContent class="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
      <ConversationEmptyState
        v-if="messages.length === 0"
        title="从一个念头开始"
        description="Agent 会边聊边整理角色草稿。"
        class="min-h-[22rem]"
      >
        <template #icon>
          <Bot class="size-8" />
        </template>
        <Suggestions class="mt-3 flex-wrap justify-center">
          <Suggestion
            v-for="suggestion in startingSuggestions"
            :key="suggestion"
            :suggestion="suggestion"
            @click="emit('suggest', $event)"
          />
        </Suggestions>
      </ConversationEmptyState>

      <Message v-for="message in messages" :key="message.id" :from="message.role">
        <MessageContent class="w-full">
          <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
            <MessageResponse v-if="part.type === 'text'" :content="part.text" />

            <Tool v-else-if="part.type === 'tool-updateCharacterDraft'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="整理角色草稿" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <PencilLine class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available'">
                    已更新
                    {{ part.output.updatedFields.map(field => fieldLabels[field]).join('、') }}
                  </span>
                  <span v-else>正在识别并整理用户确认的角色信息</span>
                </div>
              </ToolContent>
            </Tool>

            <Tool v-else-if="part.type === 'tool-completeCharacterProfile'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="生成角色完成稿" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <Check
                    v-if="part.state === 'output-available' && part.output.ready"
                    class="mt-0.5 size-4 shrink-0"
                  />
                  <FileText v-else class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available' && part.output.ready">
                    完成稿已放到右侧，等待确认保存
                  </span>
                  <span v-else-if="part.state === 'output-available'">
                    当前信息还不够，Agent 会继续确认关键设定
                  </span>
                  <span v-else>正在组织角色档案</span>
                </div>
              </ToolContent>
            </Tool>
          </template>
        </MessageContent>
      </Message>

      <div
        v-if="status === 'submitted'"
        class="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader />
        Agent 正在判断下一步
      </div>
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
</template>
