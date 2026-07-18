<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { AlertCircle } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app';
import { SagPage } from '@/components/sag/sag-page';
import type {
  CharacterAgentMessage,
  CharacterDraft,
  CharacterDraftUpdateResult,
  CharacterProfileProposalResult,
  CredentialStatus,
} from '@/types';
import {
  CHARACTER_AGENT_ENDPOINT,
  DEFAULT_DEEPSEEK_MODEL,
  createEmptyCharacterDraft,
} from '@/types';
import CharacterChatHeader from './components/character-chat-header.vue';
import CharacterChatInput from './components/character-chat-input.vue';
import CharacterChatMessages from './components/character-chat-messages.vue';
import CharacterWorkspacePanel from './components/character-workspace-panel.vue';

const appStore = useAppStore();
const draft = ref<CharacterDraft>(createEmptyCharacterDraft());
const savedProfileMarkdown = ref('');
const proposedProfileMarkdown = ref('');
const credentialStatus = ref<CredentialStatus | null>(null);
const initializationError = ref('');
const isInitializing = ref(true);
const isResetDialogOpen = ref(false);
const isSaving = ref(false);
const isProfileSaved = ref(false);
const workspaceOpen = ref(true);
const mobilePane = ref<'chat' | 'draft'>('chat');

const model = computed(() => appStore.settings.deepseekModel.trim() || DEFAULT_DEEPSEEK_MODEL);
const profileMarkdown = computed(() => proposedProfileMarkdown.value || savedProfileMarkdown.value);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));

const transport = new DefaultChatTransport<CharacterAgentMessage>({
  api: CHARACTER_AGENT_ENDPOINT,
  body: { model: model.value },
});

const { clearError, error, messages, regenerate, sendMessage, status, stop } =
  useChat<CharacterAgentMessage>({
    transport,
    onFinish: () => {
      void refreshWorkspace().catch(refreshError => {
        initializationError.value =
          refreshError instanceof Error ? refreshError.message : String(refreshError);
      });
    },
  });

const chatStatus = computed<ChatStatus>(() => status.value);
const isBusy = computed(() => chatStatus.value === 'submitted' || chatStatus.value === 'streaming');
const isInputDisabled = computed(
  () => isInitializing.value || !keyConfigured.value || chatStatus.value === 'error',
);
const errorMessage = computed(() => initializationError.value || error.value?.message || '');

function isDraftUpdateResult(value: unknown): value is CharacterDraftUpdateResult {
  return Boolean(value && typeof value === 'object' && 'draft' in value);
}

function isProfileProposalResult(value: unknown): value is CharacterProfileProposalResult {
  return Boolean(value && typeof value === 'object' && 'markdown' in value && 'draft' in value);
}

function applyToolOutputs(messageList: CharacterAgentMessage[]) {
  for (const message of messageList) {
    for (const part of message.parts) {
      if (
        part.type === 'tool-updateCharacterDraft' &&
        part.state === 'output-available' &&
        isDraftUpdateResult(part.output)
      ) {
        draft.value = part.output.draft;
      }
      if (
        part.type === 'tool-completeCharacterProfile' &&
        part.state === 'output-available' &&
        isProfileProposalResult(part.output) &&
        part.output.ready
      ) {
        draft.value = part.output.draft;
        proposedProfileMarkdown.value = part.output.markdown;
        isProfileSaved.value = part.output.markdown === savedProfileMarkdown.value;
        mobilePane.value = 'draft';
      }
    }
  }
}

async function refreshWorkspace() {
  const workspace = await window.desktop.getCharacterWorkspace();
  draft.value = workspace.draft;
  savedProfileMarkdown.value = workspace.profileMarkdown ?? '';
  if (!proposedProfileMarkdown.value) {
    isProfileSaved.value = Boolean(workspace.profileMarkdown);
  }
}

async function initialize() {
  isInitializing.value = true;
  initializationError.value = '';
  try {
    const [workspace, statusResult] = await Promise.all([
      window.desktop.getCharacterWorkspace(),
      window.desktop.getCredentialStatus('deepseek'),
    ]);
    draft.value = workspace.draft;
    savedProfileMarkdown.value = workspace.profileMarkdown ?? '';
    isProfileSaved.value = Boolean(workspace.profileMarkdown);
    credentialStatus.value = statusResult;
  } catch (initializationFailure: unknown) {
    initializationError.value =
      initializationFailure instanceof Error
        ? initializationFailure.message
        : String(initializationFailure);
  } finally {
    isInitializing.value = false;
  }
}

async function send(text: string) {
  if (!text.trim() || isInputDisabled.value || isBusy.value) {
    return;
  }
  await sendMessage({ text: text.trim() });
}

async function retry() {
  if (chatStatus.value !== 'error') {
    return;
  }
  await regenerate();
}

async function saveProfile() {
  if (!proposedProfileMarkdown.value || isSaving.value) {
    return;
  }
  isSaving.value = true;
  try {
    await window.desktop.saveCharacterProfile({
      markdown: proposedProfileMarkdown.value,
    });
    savedProfileMarkdown.value = proposedProfileMarkdown.value;
    isProfileSaved.value = true;
    toast.success('角色完成稿已保存到 ip.md');
  } catch (saveError: unknown) {
    toast.error(saveError instanceof Error ? saveError.message : String(saveError));
  } finally {
    isSaving.value = false;
  }
}

function resetConversation() {
  clearError();
  messages.value = [];
  proposedProfileMarkdown.value = '';
  isProfileSaved.value = Boolean(savedProfileMarkdown.value);
  isResetDialogOpen.value = false;
  mobilePane.value = 'chat';
}

function closeWorkspace(): void {
  workspaceOpen.value = false;
  mobilePane.value = 'chat';
}

function openWorkspace(): void {
  workspaceOpen.value = true;
  mobilePane.value = 'draft';
}

watch(messages, messageList => applyToolOutputs(messageList));
onMounted(() => {
  void initialize();
});
</script>

<template>
  <SagPage>
    <template #header>
      <CharacterChatHeader
        v-model:mobile-pane="mobilePane"
        :busy="isBusy"
        :key-configured="keyConfigured"
        :model="model"
        :workspace-open="workspaceOpen"
        @open-workspace="openWorkspace"
        @new-session="isResetDialogOpen = true"
      />
    </template>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>Agent 暂时无法继续</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button v-if="chatStatus === 'error'" variant="outline" size="sm" @click="retry">
          重试
        </Button>
      </AlertDescription>
    </Alert>

    <div
      :class="[
        'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden',
        workspaceOpen && 'lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]',
      ]"
    >
      <section
        :class="[
          'min-h-0 min-w-0 flex-col overflow-hidden lg:flex',
          !workspaceOpen || mobilePane === 'chat' ? 'flex' : 'hidden',
        ]"
        aria-label="角色共创对话"
      >
        <CharacterChatMessages :messages="messages" :status="chatStatus" @suggest="send" />
        <CharacterChatInput
          :disabled="isInputDisabled"
          :status="chatStatus"
          @send="send"
          @stop="stop"
        />
      </section>

      <aside
        v-if="workspaceOpen"
        :class="[
          'min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5',
          mobilePane === 'draft' ? 'flex' : 'hidden',
        ]"
        aria-label="角色档案"
      >
        <CharacterWorkspacePanel
          :can-save="Boolean(proposedProfileMarkdown) && !isProfileSaved"
          :draft="draft"
          :is-saving="isSaving"
          :profile-markdown="profileMarkdown"
          :saved="isProfileSaved"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeWorkspace"
          @save="saveProfile"
        />
      </aside>
    </div>

    <Dialog v-model:open="isResetDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>开始新对话？</DialogTitle>
          <DialogDescription>
            当前消息会被清空，已经整理到角色草稿和保存到 ip.md 的内容会保留。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isResetDialogOpen = false">取消</Button>
          <Button @click="resetConversation">开始新对话</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SagPage>
</template>
