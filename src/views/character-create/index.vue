<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  RotateCcw,
  Save,
  Sparkles,
  WandSparkles,
} from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SagPage } from '@/components/sag/sag-page';
import type { SavedFileResult } from '@/types';
import CharacterCreateStepper from './components/character-create-stepper.vue';
import CharacterGenerationStep from './components/character-generation-step.vue';
import CharacterPromptStep from './components/character-prompt-step.vue';
import CharacterSourceStep from './components/character-source-step.vue';
import CharacterStyleStep from './components/character-style-step.vue';
import {
  GENERATION_DELAY_MS,
  PROMPT_REPLY_DELAY_MS,
  buildFinalPrompt,
  extractPromptDraft,
  getPromptOpening,
  getPromptReply,
  getPromptSuggestions,
} from './prompt-interview';
import {
  CHARACTER_STYLES,
  CHARACTER_WORKFLOW_STEPS,
  createEmptyCharacterPromptDraft,
  type CharacterPromptDraft,
  type CharacterPromptMessage,
  type Step,
  type StyleId,
} from './workflow-data';

const currentStep = ref<Step>(1);
const furthestStep = ref<Step>(1);
const selectedStyle = ref<StyleId | null>(null);
const sourceImageUrl = ref('');
const sourceImageName = ref('');
const prompt = ref('');
const promptMessages = ref<CharacterPromptMessage[]>([]);
const promptDraft = ref<CharacterPromptDraft>(createEmptyCharacterPromptDraft());
const isPromptAssistantResponding = ref(false);
const isGenerating = ref(false);
const hasGenerated = ref(false);
const isSaved = ref(false);
const generationCount = ref(0);
let generationTimer: ReturnType<typeof setTimeout> | null = null;
let promptReplyTimer: ReturnType<typeof setTimeout> | null = null;
let promptMessageSequence = 0;

const selectedStyleDetails = computed(() =>
  CHARACTER_STYLES.find(style => style.id === selectedStyle.value),
);
const generationStyleDetails = computed(() => selectedStyleDetails.value ?? CHARACTER_STYLES[0]);
const currentStepDetails = computed(() => CHARACTER_WORKFLOW_STEPS[currentStep.value - 1]);
const canContinue = computed(() => {
  if (currentStep.value === 1) return true;
  if (currentStep.value === 2) return true;
  if (currentStep.value === 3) return Boolean(prompt.value.trim());
  return !isGenerating.value;
});
const promptSuggestions = computed(() => {
  const answerCount = promptMessages.value.filter(message => message.role === 'user').length;
  return getPromptSuggestions(answerCount, selectedStyleDetails.value?.name);
});

function selectStyle(styleId: StyleId | null): void {
  selectedStyle.value = styleId;
  const style = CHARACTER_STYLES.find(option => option.id === styleId);
  promptDraft.value.overallStyleKeywords = style ? [style.name, ...style.tags].join('、') : '';
  if (promptMessages.value.length) prompt.value = '';
}

function createPromptMessage(role: CharacterPromptMessage['role'], content: string) {
  promptMessageSequence += 1;
  return { id: `prompt-message-${promptMessageSequence}`, role, content };
}

function preparePromptConversation(): void {
  if (promptMessages.value.length) return;
  promptMessages.value = [
    createPromptMessage(
      'assistant',
      getPromptOpening(Boolean(sourceImageUrl.value), selectedStyleDetails.value?.name),
    ),
  ];
}

function compilePrompt(announce = true): void {
  prompt.value = buildFinalPrompt({
    draft: promptDraft.value,
    messages: promptMessages.value,
    hasReferenceImage: Boolean(sourceImageUrl.value),
    stylePrompt: selectedStyleDetails.value?.stylePrompt,
  });
  hasGenerated.value = false;
  isSaved.value = false;
  if (announce) {
    promptMessages.value = [
      ...promptMessages.value,
      createPromptMessage(
        'assistant',
        '我已经把目前确认的人物信息和风格设定合并成最终提示词。你可以直接进入下一步，也可以继续告诉我哪里需要调整。',
      ),
    ];
  }
}

function sendPromptAnswer(answer: string): void {
  const text = answer.trim();
  if (!text || isPromptAssistantResponding.value) return;

  const hadCompiledPrompt = Boolean(prompt.value.trim());
  promptMessages.value = [...promptMessages.value, createPromptMessage('user', text)];
  const answerCount = promptMessages.value.filter(message => message.role === 'user').length;
  promptDraft.value = extractPromptDraft(promptDraft.value, text, answerCount);
  prompt.value = '';
  isPromptAssistantResponding.value = true;
  hasGenerated.value = false;
  isSaved.value = false;

  if (promptReplyTimer) clearTimeout(promptReplyTimer);
  promptReplyTimer = setTimeout(() => {
    if (answerCount >= 3) {
      compilePrompt(false);
    }
    const reply = getPromptReply(answerCount, hadCompiledPrompt);
    promptMessages.value = [...promptMessages.value, createPromptMessage('assistant', reply)];
    isPromptAssistantResponding.value = false;
    promptReplyTimer = null;
  }, PROMPT_REPLY_DELAY_MS);
}

function goToStep(step: Step): void {
  if (step > furthestStep.value) return;
  currentStep.value = step;
  if (step === 3) preparePromptConversation();
}

function validateStep(): boolean {
  if (currentStep.value === 3 && !prompt.value.trim()) {
    toast.error('先和助手聊出人物细节，再整理最终提示词');
    return false;
  }
  return true;
}

function nextStep(): void {
  if (currentStep.value === 4) {
    generateImage();
    return;
  }
  if (!validateStep()) return;
  const next = (currentStep.value + 1) as Step;
  if (next === 3) preparePromptConversation();
  currentStep.value = next;
  furthestStep.value = Math.max(furthestStep.value, next) as Step;
}

function previousStep(): void {
  if (currentStep.value > 1) currentStep.value = (currentStep.value - 1) as Step;
}

function handleUploadSuccess(result: SavedFileResult): void {
  revokeSourceImageUrl();
  sourceImageUrl.value = result.url;
  sourceImageName.value = result.originalName;
}

function revokeSourceImageUrl(): void {
  if (sourceImageUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceImageUrl.value);
}

function resetSource(): void {
  revokeSourceImageUrl();
  sourceImageUrl.value = '';
  sourceImageName.value = '';
}

function generateImage(): void {
  if (isGenerating.value) return;
  isGenerating.value = true;
  hasGenerated.value = false;
  isSaved.value = false;
  generationCount.value += 1;
  generationTimer = setTimeout(() => {
    isGenerating.value = false;
    hasGenerated.value = true;
    toast.success('角色形象已生成，可以继续调整或保存');
  }, GENERATION_DELAY_MS);
}

function saveImage(): void {
  isSaved.value = true;
  toast.success('Demo：角色形象已保存');
}

function startOver(): void {
  hasGenerated.value = false;
  isSaved.value = false;
  currentStep.value = 1;
  furthestStep.value = 1;
}

watch([selectedStyle, sourceImageUrl, prompt], () => {
  if (!isGenerating.value) {
    hasGenerated.value = false;
    isSaved.value = false;
  }
});

onBeforeUnmount(() => {
  if (generationTimer) clearTimeout(generationTimer);
  if (promptReplyTimer) clearTimeout(promptReplyTimer);
  revokeSourceImageUrl();
});
</script>

<template>
  <SagPage>
    <template #header>
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <Sparkles class="size-4" />
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-semibold">创建角色</h1>
          <p class="truncate text-xs text-muted-foreground">先做出一张满意的角色形象</p>
        </div>
      </div>
      <span class="text-xs text-muted-foreground">{{ currentStep }} / 4</span>
    </template>

    <div class="shrink-0 bg-background">
      <CharacterCreateStepper
        :current-step="currentStep"
        :furthest-step="furthestStep"
        class="mx-auto w-full max-w-6xl px-5 py-2 sm:px-8 lg:px-10"
        @select="goToStep"
      />
    </div>

    <ScrollArea class="min-h-0 flex-1 bg-muted/20">
      <main
        class="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10"
      >
        <section class="min-w-0 flex-1">
          <div class="mb-7">
            <p class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Step {{ currentStep }} / 4
            </p>
            <h2 class="text-2xl font-semibold text-foreground sm:text-3xl">
              {{ currentStepDetails?.label }}
            </h2>
            <p class="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {{ currentStepDetails?.description }}
            </p>
          </div>

          <Transition name="step-fade" mode="out-in">
            <CharacterStyleStep
              v-if="currentStep === 1"
              :model-value="selectedStyle"
              @update:model-value="selectStyle"
            />
            <CharacterSourceStep
              v-else-if="currentStep === 2"
              :source-image-name="sourceImageName"
              :source-image-url="sourceImageUrl"
              @remove-image="resetSource"
              @upload-success="handleUploadSuccess"
            />
            <CharacterPromptStep
              v-else-if="currentStep === 3"
              :draft="promptDraft"
              :is-responding="isPromptAssistantResponding"
              :messages="promptMessages"
              :model-value="prompt"
              :style-name="selectedStyleDetails?.name || '由访谈决定'"
              :suggestions="promptSuggestions"
              @compile="compilePrompt()"
              @send="sendPromptAnswer"
              @update:model-value="prompt = $event"
            />
            <CharacterGenerationStep
              v-else
              :generation-count="generationCount"
              :has-generated="hasGenerated"
              :is-generating="isGenerating"
              :is-saved="isSaved"
              :selected-style-image="generationStyleDetails?.image || ''"
              :selected-style-name="selectedStyleDetails?.name || '访谈生成风格'"
            />
          </Transition>
        </section>
      </main>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background">
      <div
        class="mx-auto flex w-full max-w-6xl flex-col-reverse justify-between gap-3 px-5 py-2 sm:flex-row sm:items-center sm:px-8 lg:px-10"
      >
        <Button
          variant="ghost"
          class="justify-center gap-2 text-muted-foreground sm:justify-start"
          :disabled="currentStep === 1 || isGenerating"
          @click="previousStep"
        >
          <ArrowLeft class="size-4" />
          {{ currentStep === 4 ? '返回调整' : '上一步' }}
        </Button>
        <div class="flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            v-if="currentStep === 4 && hasGenerated"
            variant="ghost"
            class="gap-2"
            @click="startOver"
          >
            重新开始
          </Button>
          <Button
            v-if="currentStep === 4 && hasGenerated"
            variant="outline"
            class="min-w-32 justify-center gap-2"
            @click="nextStep"
          >
            再生成一张
            <RotateCcw class="size-4" />
          </Button>
          <Button
            v-if="currentStep === 4 && hasGenerated"
            class="min-w-40 justify-center gap-2"
            :disabled="isSaved"
            @click="saveImage"
          >
            <Save class="size-4" />
            {{ isSaved ? '已保存' : '满意，保存这个形象' }}
          </Button>
          <Button
            v-else
            class="min-w-32 justify-center gap-2"
            :disabled="!canContinue || isGenerating"
            @click="nextStep"
          >
            <LoaderCircle v-if="isGenerating" class="size-4 animate-spin" />
            <template v-else-if="currentStep < 4">
              下一步
              <ArrowRight class="size-4" />
            </template>
            <template v-else>
              生成图片
              <WandSparkles class="size-4" />
            </template>
          </Button>
        </div>
      </div>
    </footer>
  </SagPage>
</template>

<style scoped>
.step-fade-enter-active,
.step-fade-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.step-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.step-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
