<script setup lang="ts">
import type { ChatStatus } from 'ai';
import { Bot, PencilLine, Upload } from '@lucide/vue';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import type { AttachmentData } from '@/components/ai-elements/attachments';
import { Attachment, AttachmentPreview, Attachments } from '@/components/ai-elements/attachments';
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
  (event: 'upload-visual'): void;
}>();

const fieldLabels: Record<CharacterDraftField, string> = {
  ageAndBuild: '年龄与体态',
  backgroundRules: '背景规则',
  characterPalette: '角色配色',
  characterSeed: '人物种子',
  colorRules: '色彩规则',
  defaultOutfit: '默认服装',
  detailDensity: '细节密度',
  exclusions: '排除项',
  faceAnchor: '脸部锚点',
  hairAnchor: '发型锚点',
  lineAndShape: '线条与造型',
  name: '姓名',
  signatureItems: '标志物',
  silhouetteMarkers: '轮廓识别点',
  textRules: '文字规则',
  visualMedium: '表现形式',
  visualSummary: '视觉总述',
};

const startingSuggestions = [
  '我有一个角色想法，帮我逐步完善',
  '从零开始问我问题，创建一个新角色',
  '我想先说一个人物种子，再探索具体形象',
];

function getMessageAttachments(message: CharacterAgentMessage): AttachmentData[] {
  return message.parts.flatMap((part, index) =>
    part.type === 'file'
      ? [
          {
            ...part,
            id: `${message.id}-${index}`,
          },
        ]
      : [],
  );
}
</script>

<template>
  <Conversation class="scrollbar-subtle min-h-0 flex-1">
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
        <Suggestions class="mt-3 w-full max-w-full flex-wrap justify-center">
          <Suggestion
            v-for="suggestion in startingSuggestions"
            :key="suggestion"
            :suggestion="suggestion"
            @click="emit('suggest', $event)"
          />
          <Suggestion suggestion="已有确定的角色形象？直接上传" @click="emit('upload-visual')">
            <Upload class="size-4" />
            已有确定的角色形象？直接上传
          </Suggestion>
        </Suggestions>
      </ConversationEmptyState>

      <Message v-for="message in messages" :key="message.id" :from="message.role">
        <MessageContent class="w-full">
          <Attachments
            v-if="getMessageAttachments(message).length"
            variant="grid"
            class="mb-2 ml-0 w-full"
          >
            <Attachment
              v-for="attachment in getMessageAttachments(message)"
              :key="attachment.id"
              :data="attachment"
            >
              <AttachmentPreview />
            </Attachment>
          </Attachments>
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
