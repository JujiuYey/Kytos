<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/vue';
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
import { useAppStore } from '@/stores/app';
import type {
  CharacterCreateAgentMessage,
  CharacterVisualGeneration,
  SaveFileRequest,
  SavedFileResult,
} from '@/types';
import { CHARACTER_CREATE_AGENT_ENDPOINT } from '@/types';
import CharacterCreateStepper from './components/character-create-stepper.vue';
import CharacterGenerationStep from './components/character-generation-step.vue';
import CharacterPromptStep from './components/character-prompt-step.vue';
import CharacterSourceStep from './components/character-source-step.vue';
import CharacterStyleStep from './components/character-style-step.vue';
import { getPromptSuggestions } from './prompt-interview';
import {
  CHARACTER_STYLES,
  CHARACTER_WORKFLOW_STEPS,
  createEmptyCharacterPromptDraft,
  type CharacterPromptDraft,
  type Step,
  type StyleId,
} from './workflow-data';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const currentStep = ref<Step>(1);
const furthestStep = ref<Step>(1);
const selectedStyle = ref<StyleId | null>(null);
const sourceImageUrl = ref('');
const sourceImageName = ref('');
const sourceImageFile = ref<SaveFileRequest | null>(null);
const characterName = ref('');
const prompt = ref('');
const promptDraft = ref<CharacterPromptDraft>(createEmptyCharacterPromptDraft());
const isGenerating = ref(false);
const isSaving = ref(false);
const hasGenerated = ref(false);
const isSaved = ref(false);
const generationCount = ref(0);
const activeGeneration = ref<CharacterVisualGeneration | null>(null);
const uploadedOfficialUrl = ref('');
let generationTimer: ReturnType<typeof setTimeout> | null = null;

const model = computed(() => appStore.settings.deepseekModel);
const transport = new DefaultChatTransport<CharacterCreateAgentMessage>({
  api: CHARACTER_CREATE_AGENT_ENDPOINT,
});
const {
  error: chatError,
  messages,
  sendMessage,
  status: chatStatus,
  stop,
} = useChat<CharacterCreateAgentMessage>({ transport });
const isPromptAssistantResponding = computed(
  () => chatStatus.value === 'submitted' || chatStatus.value === 'streaming',
);

const selectedStyleDetails = computed(() =>
  CHARACTER_STYLES.find(style => style.id === selectedStyle.value),
);
const isEditing = computed(
  () => route.query.mode === 'edit' && typeof route.query.characterId === 'string',
);
const currentStepDetails = computed(() => CHARACTER_WORKFLOW_STEPS[currentStep.value - 1]);
const canContinue = computed(() => {
  if (currentStep.value === 1) return true;
  if (currentStep.value === 2) return true;
  if (currentStep.value === 3) return Boolean(prompt.value.trim());
  return !isGenerating.value;
});
const promptSuggestions = computed(() => {
  const answerCount = messages.value.filter(message => message.role === 'user').length;
  return getPromptSuggestions(answerCount, selectedStyleDetails.value?.name);
});

function selectStyle(styleId: StyleId | null): void {
  selectedStyle.value = styleId;
  const style = CHARACTER_STYLES.find(option => option.id === styleId);
  promptDraft.value.overallStyleKeywords = style ? [style.name, ...style.tags].join('、') : '';
  prompt.value = '';
}

function agentBody() {
  return {
    draft: promptDraft.value,
    hasReferenceImage: Boolean(sourceImageUrl.value),
    model: model.value,
    stylePrompt: selectedStyleDetails.value?.stylePrompt || '',
  };
}

async function sendPromptAnswer(answer: string): Promise<void> {
  const text = answer.trim();
  if (!text || isPromptAssistantResponding.value) return;
  hasGenerated.value = false;
  isSaved.value = false;
  await sendMessage({ text }, { body: agentBody() });
}

async function compilePrompt(): Promise<void> {
  if (isPromptAssistantResponding.value) return;
  hasGenerated.value = false;
  isSaved.value = false;
  await sendMessage(
    { text: '请根据目前已经确认的人物信息调用 finalizeCharacterPrompt，整理出最终生图提示词。' },
    { body: agentBody() },
  );
}

function syncAgentOutputs(): void {
  for (const message of messages.value) {
    for (const part of message.parts) {
      if (part.type === 'tool-updateCharacterDraft' && part.state === 'output-available') {
        promptDraft.value = { ...part.output.draft };
      }
      if (part.type === 'tool-finalizeCharacterPrompt' && part.state === 'output-available') {
        promptDraft.value = { ...part.output.draft };
        prompt.value = part.output.prompt;
      }
    }
  }
}

function goToStep(step: Step): void {
  if (step > furthestStep.value) return;
  currentStep.value = step;
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

function handleReferenceSelected(request: SaveFileRequest): void {
  sourceImageFile.value = request;
}

function revokeSourceImageUrl(): void {
  if (sourceImageUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceImageUrl.value);
}

function resetSource(): void {
  revokeSourceImageUrl();
  sourceImageUrl.value = '';
  sourceImageName.value = '';
  sourceImageFile.value = null;
}

async function saveUploadedAsOfficial(): Promise<void> {
  const file = sourceImageFile.value;
  if (!file || isSaving.value) return;
  isSaving.value = true;
  try {
    const result = await window.desktop.character.visual.saveCharacterVisualAsset({
      characterId:
        isEditing.value && typeof route.query.characterId === 'string'
          ? route.query.characterId
          : undefined,
      name: isEditing.value ? undefined : characterName.value,
      fileData: file.fileData,
      fileName: file.fileName,
      mimeType: file.mimeType,
    });
    uploadedOfficialUrl.value = sourceImageUrl.value;
    activeGeneration.value = null;
    hasGenerated.value = true;
    isSaved.value = true;
    currentStep.value = 4;
    furthestStep.value = 4;
    await router.replace({
      name: 'character-create',
      query: { characterId: result.characterId, mode: 'edit' },
    });
    toast.success('已有图片已设为正式角色视觉');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSaving.value = false;
  }
}

async function generateImage(): Promise<void> {
  if (isGenerating.value || !prompt.value.trim()) return;
  isGenerating.value = true;
  hasGenerated.value = false;
  isSaved.value = false;
  generationCount.value += 1;
  try {
    activeGeneration.value = await window.desktop.character.visual.generateCharacterVisual({
      prompt: prompt.value,
      referenceImage: sourceImageFile.value
        ? {
            fileData: sourceImageFile.value.fileData,
            fileName: sourceImageFile.value.fileName,
            mimeType: sourceImageFile.value.mimeType,
          }
        : undefined,
    });
    await pollGeneration(activeGeneration.value.id);
  } catch (error: unknown) {
    isGenerating.value = false;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function pollGeneration(generationId: string): Promise<void> {
  try {
    const generation = await window.desktop.character.visual.getCharacterVisualGeneration({ generationId });
    activeGeneration.value = generation;
    if (['submitted', 'pending', 'processing'].includes(generation.status)) {
      generationTimer = setTimeout(() => void pollGeneration(generationId), 2500);
      return;
    }
    isGenerating.value = false;
    if (generation.status === 'completed') {
      hasGenerated.value = true;
      toast.success('角色形象已生成，可以继续调整或保存');
    } else {
      toast.error(generation.errorMessage || '角色形象生成失败');
    }
  } catch (error: unknown) {
    isGenerating.value = false;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function saveImage(): Promise<void> {
  if (isSaving.value || !hasGenerated.value) return;
  isSaving.value = true;
  try {
    if (!activeGeneration.value?.image) throw new Error('未找到当前生成结果');
    const result = await window.desktop.character.visual.saveCharacterVisual({
      characterId:
        isEditing.value && typeof route.query.characterId === 'string'
          ? route.query.characterId
          : undefined,
      generationId: activeGeneration.value.id,
    });
    isSaved.value = true;
    if (!isEditing.value) {
      await router.replace({
        name: 'character-create',
        query: { characterId: result.characterId, mode: 'edit' },
      });
    }
    toast.success('正式角色视觉已保存');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSaving.value = false;
  }
}

function startOver(): void {
  activeGeneration.value = null;
  uploadedOfficialUrl.value = '';
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

watch(messages, syncAgentOutputs, { deep: true });
watch(chatError, error => {
  if (error) toast.error(error.message);
});

onBeforeUnmount(() => {
  if (generationTimer) clearTimeout(generationTimer);
  void stop();
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
          <h1 class="truncate text-sm font-semibold">{{ isEditing ? '编辑角色' : '创建角色' }}</h1>
          <p class="truncate text-xs text-muted-foreground">
            {{ isEditing ? '调整角色形象，直到满意为止' : '先做出一张满意的角色形象' }}
          </p>
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
              :character-name="characterName"
              :is-editing="isEditing"
              :source-image-name="sourceImageName"
              :source-image-url="sourceImageUrl"
              @remove-image="resetSource"
              @reference-selected="handleReferenceSelected"
              @save-as-official="saveUploadedAsOfficial"
              @upload-success="handleUploadSuccess"
              @update:character-name="characterName = $event"
            />
            <CharacterPromptStep
              v-else-if="currentStep === 3"
              :draft="promptDraft"
              :is-responding="isPromptAssistantResponding"
              :messages="messages"
              :model-value="prompt"
              :style-name="selectedStyleDetails?.name || '由访谈决定'"
              :suggestions="promptSuggestions"
              @compile="compilePrompt"
              @send="sendPromptAnswer"
              @update:model-value="prompt = $event"
            />
            <CharacterGenerationStep
              v-else
              :generation-count="generationCount"
              :generated-image="activeGeneration?.image?.url || uploadedOfficialUrl"
              :has-generated="hasGenerated"
              :is-generating="isGenerating"
              :is-saved="isSaved"
              :is-uploaded-asset="Boolean(uploadedOfficialUrl)"
              :progress="activeGeneration?.progress || 0"
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
            v-if="currentStep === 4 && hasGenerated && !uploadedOfficialUrl"
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
            :disabled="isSaved || isSaving"
            @click="saveImage"
          >
            <Save class="size-4" />
            {{ isSaving ? '保存中' : isSaved ? '已设为正式视觉' : '满意，设为正式视觉' }}
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
