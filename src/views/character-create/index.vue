<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/vue';
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  CharacterPortraitImage,
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
import CharacterSummaryStart from './components/character-summary-start.vue';
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
const isInitializing = ref(true);
const isSavingSummary = ref(false);
const needsSummary = ref(false);
const summaryInitialName = ref('');
const summaryTargetId = ref('');
const prompt = ref('');
const promptDraft = ref<CharacterPromptDraft>(createEmptyCharacterPromptDraft());
const candidateGeneration = ref<CharacterVisualGeneration | null>(null);
const pendingFinalGeneration = ref<CharacterVisualGeneration | null>(null);
const finalVersions = ref<CharacterVisualGeneration[]>([]);
const selectedFinalGenerationId = ref('');
const baseImage = ref<CharacterPortraitImage | null>(null);
const isCandidateGenerating = ref(false);
const isFinalGenerating = ref(false);
const skipRefinement = ref(false);
const isSaving = ref(false);
const isSaved = ref(false);
let generationTimer: ReturnType<typeof setTimeout> | null = null;

const model = computed(() => appStore.settings.generalModel);
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
const isGenerating = computed(() => isCandidateGenerating.value || isFinalGenerating.value);
const selectedFinalGeneration = computed(
  () =>
    finalVersions.value.find(generation => generation.id === selectedFinalGenerationId.value) ??
    null,
);
const displayedFinalImage = computed(
  () => pendingFinalGeneration.value?.image ?? selectedFinalGeneration.value?.image ?? null,
);

const selectedStyleDetails = computed(() =>
  CHARACTER_STYLES.find(style => style.id === selectedStyle.value),
);
const characterId = computed(() =>
  typeof route.query.characterId === 'string' ? route.query.characterId : '',
);
const isNewCharacterRequested = computed(() => route.query.new === '1');
const currentStepDetails = computed(() => CHARACTER_WORKFLOW_STEPS[currentStep.value - 1]);
const canContinue = computed(() => {
  if (currentStep.value === 1) return true;
  if (currentStep.value === 2) return true;
  return Boolean(baseImage.value) && !isGenerating.value;
});

function selectStyle(styleId: StyleId | null): void {
  selectedStyle.value = styleId;
  const style = CHARACTER_STYLES.find(option => option.id === styleId);
  promptDraft.value.overallStyleKeywords = style ? [style.name, ...style.tags].join('、') : '';
  prompt.value = '';
  resetGeneratedVisuals();
}

function agentBody() {
  return {
    draft: promptDraft.value,
    hasReferenceImage: Boolean(sourceImageUrl.value),
    model: model.value,
    stylePrompt: selectedStyleDetails.value?.stylePrompt || '',
  };
}

async function compilePrompt(): Promise<void> {
  if (isPromptAssistantResponding.value) return;
  prompt.value = '';
  await sendMessage(
    { text: '请立即调用 finalizeCharacterPrompt，根据当前草稿整理最终生图提示词。' },
    { body: agentBody() },
  );
  syncAgentOutputs();
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
  if (isSaved.value || step > furthestStep.value) return;
  currentStep.value = step;
}

function nextStep(): void {
  if (currentStep.value === 3) {
    void generateCandidates();
    return;
  }
  if (currentStep.value === 4) {
    void generateFinalImage();
    return;
  }
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

function resetGeneratedVisuals(): void {
  if (generationTimer) {
    clearTimeout(generationTimer);
    generationTimer = null;
  }
  candidateGeneration.value = null;
  pendingFinalGeneration.value = null;
  finalVersions.value = [];
  selectedFinalGenerationId.value = '';
  baseImage.value = null;
  isCandidateGenerating.value = false;
  isFinalGenerating.value = false;
  isSaved.value = false;
}

function updatePromptDraft(draft: CharacterPromptDraft): void {
  promptDraft.value = draft;
  prompt.value = '';
  resetGeneratedVisuals();
}

async function generateCandidates(): Promise<void> {
  if (isGenerating.value || isPromptAssistantResponding.value) return;
  isCandidateGenerating.value = true;
  isSaved.value = false;
  try {
    await compilePrompt();
    if (!prompt.value.trim()) throw new Error('提示词整理失败，请重试');
    candidateGeneration.value = await window.desktop.character.visual.generateCharacterVisual({
      prompt: prompt.value,
      n: 4,
      resolution: '1k',
      size: '3:4',
    });
    await pollGeneration(candidateGeneration.value.id, 'candidates');
  } catch (error: unknown) {
    isCandidateGenerating.value = false;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

function selectCandidate(image: CharacterPortraitImage): void {
  baseImage.value = image;
  pendingFinalGeneration.value = null;
  finalVersions.value = [];
  selectedFinalGenerationId.value = '';
  isSaved.value = false;
  currentStep.value = 4;
  furthestStep.value = 4;
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('无法读取候选图用于精修');
  return blobToDataUrl(await response.blob());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('候选图转换失败'));
    reader.onerror = () => reject(new Error('候选图转换失败'));
    reader.readAsDataURL(blob);
  });
}

function referenceImageToDataUrl(referenceImage: SaveFileRequest): Promise<string> {
  return blobToDataUrl(new Blob([referenceImage.fileData], { type: referenceImage.mimeType }));
}

async function generateFinalImage(): Promise<void> {
  if (!baseImage.value || isGenerating.value) return;
  if (skipRefinement.value) return;
  isFinalGenerating.value = true;
  isSaved.value = false;
  try {
    const imageUrls = [await imageUrlToDataUrl(baseImage.value.url)];
    if (sourceImageFile.value) imageUrls.push(await referenceImageToDataUrl(sourceImageFile.value));
    pendingFinalGeneration.value = await window.desktop.character.visual.generateCharacterVisual({
      imageUrls,
      n: 1,
      prompt: `${prompt.value}\n\nKeep the same character identity, face shape, hairstyle and art style from the reference image. One single full-body character, centered, pure white background, no shadow, refined high-definition character design sheet.`,
      resolution: '2k',
      size: '3:4',
    });
    await pollGeneration(pendingFinalGeneration.value.id, 'final');
  } catch (error: unknown) {
    isFinalGenerating.value = false;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function pollGeneration(generationId: string, phase: 'candidates' | 'final'): Promise<void> {
  try {
    const generation = await window.desktop.character.visual.getCharacterVisualGeneration({
      generationId,
    });
    if (phase === 'candidates') candidateGeneration.value = generation;
    else updateFinalGeneration(generation);
    if (['submitted', 'pending', 'processing'].includes(generation.status)) {
      generationTimer = setTimeout(() => void pollGeneration(generationId, phase), 2500);
      return;
    }
    if (phase === 'candidates') isCandidateGenerating.value = false;
    else isFinalGenerating.value = false;
    if (generation.status === 'completed') {
      toast.success(phase === 'candidates' ? '候选图已生成，请选择一张作为基底' : '正式视觉已生成');
    } else {
      toast.error(generation.errorMessage || '角色形象生成失败');
    }
  } catch (error: unknown) {
    if (phase === 'candidates') isCandidateGenerating.value = false;
    else isFinalGenerating.value = false;
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

function updateFinalGeneration(generation: CharacterVisualGeneration): void {
  if (generation.status !== 'completed' || !generation.image) {
    pendingFinalGeneration.value = generation;
    return;
  }
  const versionIndex = finalVersions.value.findIndex(version => version.id === generation.id);
  if (versionIndex === -1) finalVersions.value = [...finalVersions.value, generation];
  else finalVersions.value[versionIndex] = generation;
  selectedFinalGenerationId.value = generation.id;
  pendingFinalGeneration.value = null;
}

function selectFinalVersion(generationId: string): void {
  if (!finalVersions.value.some(generation => generation.id === generationId)) return;
  selectedFinalGenerationId.value = generationId;
  skipRefinement.value = false;
  isSaved.value = false;
}

async function saveImage(): Promise<void> {
  const generation = skipRefinement.value
    ? candidateGeneration.value
    : selectedFinalGeneration.value;
  if (isSaving.value || !generation || !baseImage.value || !characterId.value) return;
  isSaving.value = true;
  try {
    await window.desktop.character.visual.saveCharacterVisual({
      characterId: characterId.value,
      generationId: generation.id,
      imageFileName: skipRefinement.value ? baseImage.value.fileName : generation.image?.fileName,
    });
    isSaved.value = true;
    toast.success('第一个正式角色视觉已保存');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSaving.value = false;
  }
}

function startOver(): void {
  resetGeneratedVisuals();
  currentStep.value = 1;
  furthestStep.value = 1;
}

function finishWorkflow(): void {
  void router.push({ name: 'character' });
}

function resetCreationSession(): void {
  if (generationTimer) {
    clearTimeout(generationTimer);
    generationTimer = null;
  }
  void stop();
  messages.value = [];
  revokeSourceImageUrl();
  currentStep.value = 1;
  furthestStep.value = 1;
  selectedStyle.value = null;
  sourceImageUrl.value = '';
  sourceImageName.value = '';
  sourceImageFile.value = null;
  characterName.value = '';
  prompt.value = '';
  promptDraft.value = createEmptyCharacterPromptDraft();
  isCandidateGenerating.value = false;
  isFinalGenerating.value = false;
  isSaving.value = false;
  isSaved.value = false;
  candidateGeneration.value = null;
  pendingFinalGeneration.value = null;
  finalVersions.value = [];
  selectedFinalGenerationId.value = '';
  baseImage.value = null;
  skipRefinement.value = false;
  needsSummary.value = false;
  summaryInitialName.value = '';
  summaryTargetId.value = '';
}

async function saveCharacterSummary(
  name: string,
  visualAsset: SaveFileRequest | null,
): Promise<void> {
  if (isSavingSummary.value) return;
  isSavingSummary.value = true;
  try {
    const library = summaryTargetId.value
      ? await window.desktop.character.library.updateCharacter({
          characterId: summaryTargetId.value,
          name,
        })
      : await window.desktop.character.library.createCharacter({ name });
    const id = summaryTargetId.value || library.activeCharacterId;
    const character = library.characters.find(item => item.id === id);
    if (!character) {
      throw new Error('角色概要创建失败');
    }
    summaryTargetId.value = character.id;
    summaryInitialName.value = character.name;

    if (visualAsset) {
      await window.desktop.character.visual.saveCharacterVisualAsset({
        characterId: character.id,
        fileData: visualAsset.fileData,
        fileName: visualAsset.fileName,
        mimeType: visualAsset.mimeType,
      });
      toast.success('角色和已有视觉已保存');
      await router.push({ name: 'character' });
      return;
    }

    await router.replace({ name: 'character-create', query: { characterId: character.id } });
    characterName.value = character.name;
    needsSummary.value = false;
    summaryTargetId.value = '';
    summaryInitialName.value = '';
    toast.success('角色概要已保存，可以开始创建第一个形象');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSavingSummary.value = false;
  }
}

async function initialize(): Promise<void> {
  try {
    if (!characterId.value) {
      const library = await window.desktop.character.library.getCharacterLibrary();
      const activeCharacter = isNewCharacterRequested.value
        ? undefined
        : library.characters.find(character => character.id === library.activeCharacterId);
      if (activeCharacter && !activeCharacter.visualAsset) {
        summaryTargetId.value = activeCharacter.id;
        summaryInitialName.value = activeCharacter.name;
      }
      needsSummary.value = true;
      return;
    }
    const library = await window.desktop.character.library.getCharacterLibrary();
    const character = library.characters.find(item => item.id === characterId.value);
    if (!character) {
      throw new Error('未找到这个角色');
    }
    await window.desktop.character.library.selectCharacter({ characterId: character.id });
    if (character.visualAsset) {
      toast.info('这个角色已经有正式视觉，请在角色视觉中继续管理');
      await router.replace({ name: 'character-portrait' });
      return;
    }
    characterName.value = character.name;
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
    await router.replace({ name: 'character' });
  } finally {
    isInitializing.value = false;
  }
}

watch(messages, syncAgentOutputs, { deep: true });
watch(chatError, error => {
  if (error) toast.error(error.message);
});
watch(characterId, (id, previousId) => {
  if (!id && previousId) {
    resetCreationSession();
    isInitializing.value = true;
    void initialize();
  }
});

onMounted(() => {
  void initialize();
});

onBeforeUnmount(() => {
  if (generationTimer) clearTimeout(generationTimer);
  void stop();
  revokeSourceImageUrl();
});
</script>

<template>
  <SagPage
    :title="needsSummary || !characterName ? '创建角色' : '创建第一个形象'"
    :description="
      needsSummary
        ? '先建立角色概要，再创建第一个正式形象'
        : characterName
          ? `正在为「${characterName}」建立正式视觉`
          : '正在读取角色概要'
    "
    :icon="Sparkles"
  >
    <template #header-actions>
      <span v-if="!isInitializing && !needsSummary" class="text-xs text-muted-foreground">
        {{ currentStep }} / 4
      </span>
    </template>

    <div v-if="isInitializing" class="flex min-h-0 flex-1 items-center justify-center bg-muted/20">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <ScrollArea v-if="!isInitializing && needsSummary" class="min-h-0 flex-1 bg-muted/20">
      <main class="mx-auto flex min-h-full w-full max-w-6xl px-5 py-9 sm:px-8 lg:px-10 lg:py-14">
        <CharacterSummaryStart
          :existing="Boolean(summaryTargetId)"
          :initial-name="summaryInitialName"
          :loading="isSavingSummary"
          @submit="saveCharacterSummary"
        />
      </main>
    </ScrollArea>

    <div v-if="!isInitializing && !needsSummary" class="shrink-0 bg-background">
      <CharacterCreateStepper
        :current-step="currentStep"
        :furthest-step="furthestStep"
        class="mx-auto w-full max-w-6xl px-5 py-2 sm:px-8 lg:px-10"
        @select="goToStep"
      />
    </div>

    <ScrollArea v-if="!isInitializing && !needsSummary" class="min-h-0 flex-1 bg-muted/20">
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
              @reference-selected="handleReferenceSelected"
              @upload-success="handleUploadSuccess"
            />
            <CharacterPromptStep
              v-else-if="currentStep === 3"
              :candidates="candidateGeneration?.images || []"
              :candidate-expected-count="4"
              :draft="promptDraft"
              :is-generating="isCandidateGenerating"
              :selected-candidate="baseImage"
              :style-name="selectedStyleDetails?.name || '由系统补全'"
              @generate="generateCandidates"
              @select-candidate="selectCandidate"
              @update:draft="updatePromptDraft"
            />
            <CharacterGenerationStep
              v-else-if="baseImage"
              :base-image="baseImage"
              :final-image="displayedFinalImage"
              :final-versions="finalVersions"
              :is-generating="isFinalGenerating"
              :is-saved="isSaved"
              :progress="pendingFinalGeneration?.progress || 0"
              :selected-final-generation-id="selectedFinalGenerationId"
              :skip-refinement="skipRefinement"
              @select-final-version="selectFinalVersion"
              @update:skip-refinement="skipRefinement = $event"
            />
          </Transition>
        </section>
      </main>
    </ScrollArea>

    <footer v-if="!isInitializing && !needsSummary" class="shrink-0 border-t bg-background">
      <div
        class="mx-auto flex w-full max-w-6xl flex-col-reverse justify-between gap-3 px-5 py-2 sm:flex-row sm:items-center sm:px-8 lg:px-10"
      >
        <Button
          variant="ghost"
          class="justify-center gap-2 text-muted-foreground sm:justify-start"
          :disabled="currentStep === 1 || isGenerating || isSaved"
          @click="previousStep"
        >
          <ArrowLeft class="size-4" />
          {{ currentStep === 4 ? '返回调整' : '上一步' }}
        </Button>
        <div class="flex flex-col-reverse gap-3 sm:flex-row">
          <Button v-if="isSaved" class="min-w-44 justify-center gap-2" @click="finishWorkflow">
            <Check class="size-4" />
            完成，返回角色管理
          </Button>
          <Button
            v-else-if="currentStep === 4 && (skipRefinement || selectedFinalGeneration?.image)"
            variant="ghost"
            class="gap-2"
            @click="startOver"
          >
            重新开始
          </Button>
          <Button
            v-if="
              currentStep === 4 && !skipRefinement && selectedFinalGeneration?.image && !isSaved
            "
            variant="outline"
            class="min-w-32 justify-center gap-2"
            :disabled="isGenerating"
            @click="nextStep"
          >
            重新精修
            <RotateCcw class="size-4" />
          </Button>
          <Button
            v-if="
              currentStep === 4 && (skipRefinement || selectedFinalGeneration?.image) && !isSaved
            "
            class="min-w-40 justify-center gap-2"
            :disabled="isSaving"
            @click="saveImage"
          >
            <Save class="size-4" />
            {{ isSaving ? '保存中' : '满意，设为正式视觉' }}
          </Button>
          <Button
            v-if="currentStep < 3 && !isSaved"
            class="min-w-32 justify-center gap-2"
            :disabled="!canContinue || isGenerating"
            @click="nextStep"
          >
            <LoaderCircle v-if="isGenerating" class="size-4 animate-spin" />
            下一步
            <ArrowRight class="size-4" />
          </Button>
          <Button
            v-if="
              currentStep === 4 && !skipRefinement && !selectedFinalGeneration?.image && !isSaved
            "
            class="min-w-36 justify-center gap-2"
            :disabled="isGenerating"
            @click="generateFinalImage"
          >
            <LoaderCircle v-if="isGenerating" class="size-4 animate-spin" />
            <template v-else>
              精修定稿
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
