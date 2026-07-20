<script setup lang="ts">
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import { PromptInputHeader, usePromptInput } from '@/components/ai-elements/prompt-input';

const { files, removeFile } = usePromptInput();
</script>

<template>
  <PromptInputHeader v-if="files.length" class="w-full justify-start py-2">
    <Attachments variant="grid" class="ml-0 w-full">
      <Attachment v-for="file in files" :key="file.id" :data="file" @remove="removeFile(file.id)">
        <AttachmentPreview />
        <AttachmentRemove label="移除图片" />
      </Attachment>
    </Attachments>
  </PromptInputHeader>
</template>
