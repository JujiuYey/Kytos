<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import type {
  Connection,
  Edge,
  GraphEdge,
  GraphNode,
  NodeMouseEvent,
  ValidConnectionFunc,
} from '@vue-flow/core';
import { MarkerType } from '@vue-flow/core';
import { AlertCircle, ArrowLeft, ImageOff, PanelRight, RotateCcw, Workflow } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Canvas } from '@/components/ai-elements/canvas';
import { Controls } from '@/components/ai-elements/controls';
import { Panel } from '@/components/ai-elements/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SagPage } from '@/components/sag/sag-page';
import CharacterContextBar from '@/components/sag/character-context-bar.vue';
import type {
  CharacterImageRecord,
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  CharacterVisualAssetSelection,
  CredentialStatus,
} from '@/types';
import WorkflowInspector from './components/workflow-inspector.vue';
import WorkflowNodeCard from './components/workflow-node.vue';
import type {
  WorkflowAssetNodeData,
  WorkflowAssetOption,
  WorkflowGeneratorNodeData,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPromptNodeData,
  WorkflowResultNodeData,
  WorkflowRunStatus,
} from './workflow-types';

const router = useRouter();
const nodes = shallowRef<WorkflowNode[]>([]);
const edges = shallowRef<Edge[]>([]);
const assetOptions = ref<WorkflowAssetOption[]>([]);
const selectedNodeId = ref('generator');
const credentialStatus = ref<CredentialStatus | null>(null);
const isInitializing = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref('');
const inspectorOpen = ref(false);

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;

const ACTIVE_STATUSES: WorkflowRunStatus[] = ['submitted', 'pending', 'processing'];

const selectedNode = computed(
  () => nodes.value.find(node => node.id === selectedNodeId.value) ?? null,
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const hasOfficialAssets = computed(() => assetOptions.value.length > 0);
const generatorNode = computed(() => nodes.value.find(node => node.type === 'generator') ?? null);

const generateDisabled = computed(() => {
  const generator = generatorNode.value;
  if (!generator || generator.data.kind !== 'generator') {
    return true;
  }
  const assetNode = findIncomingNode(generator.id, 'asset');
  const promptNode = findIncomingNode(generator.id, 'prompt');
  const resultNode = findOutgoingNode(generator.id, 'result');
  return (
    isInitializing.value ||
    isSubmitting.value ||
    ACTIVE_STATUSES.includes(generator.data.status) ||
    !keyConfigured.value ||
    !assetNode ||
    !promptNode ||
    !resultNode ||
    promptNode.data.kind !== 'prompt' ||
    !promptNode.data.prompt.trim() ||
    promptNode.data.prompt.length > 20_000 ||
    !generator.data.name.trim() ||
    generator.data.name.length > 80
  );
});

const defaultEdgeOptions = {
  markerEnd: MarkerType.ArrowClosed,
  type: 'smoothstep',
};

function buildSheetPrompt(): string {
  return [
    '参考图中的角色就是唯一要画的人，必须保持同一个角色，不要重新设计或美化。',
    '严格保持参考图中的脸、五官、神态、发型、身材比例、服装、鞋履、配饰、颜色和绘画风格一致。',
    '生成一张 16:9 横版多角度角色设定表，人物之间留出清晰间距并对齐。',
    '从左到右依次展示：正面全身、完全侧面全身、背面全身、放大的四分之三侧面头肩像。',
    '全身视图保持相同身高和自然中性站姿，完整展示头部到鞋底；头像清楚展示五官、表情、发型与标志性配饰。',
    '背景干净统一，不要地面线、阴影、边框、文字、标注、色卡、额外人物或额外物品。',
  ].join('\n');
}

function assetKey(selection: CharacterVisualAssetSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

function findImage(
  workspace: CharacterPortraitWorkspaceState,
  selection: CharacterVisualAssetSelection,
): { image: CharacterPortraitImage; record: CharacterImageRecord } | null {
  const recordList = selection.kind === 'portrait' ? workspace.records : workspace.sheetRecords;
  const record = recordList.find(item => item.id === selection.taskId);
  const image = record?.images.find(item => item.fileName === selection.fileName);
  return record && image ? { image, record } : null;
}

function createAssetOptions(workspace: CharacterPortraitWorkspaceState): WorkflowAssetOption[] {
  return workspace.officialAssets.flatMap(selection => {
    const match = findImage(workspace, selection);
    if (!match) {
      return [];
    }
    return [
      {
        image: match.image,
        key: assetKey(selection),
        label: match.image.name || match.record.name || '正式资产',
        selection,
      },
    ];
  });
}

function toRunStatus(status: CharacterSheetRecord['status'] | undefined): WorkflowRunStatus {
  return status ?? 'idle';
}

function initializeGraph(
  workspace: CharacterPortraitWorkspaceState,
  options: WorkflowAssetOption[],
): void {
  const latestSheet = workspace.sheetRecords.find(record => record.source === 'generated');
  const assetNodes: WorkflowNode[] = options.map((option, index) => ({
    ariaLabel: `正式资产：${option.label}`,
    data: {
      assetKey: option.key,
      image: option.image,
      kind: 'asset',
      label: option.label,
      selection: option.selection,
    },
    deletable: false,
    id: `asset-${index + 1}`,
    position: { x: 0, y: index * 230 },
    type: 'asset',
  }));
  const promptNode: WorkflowNode = {
    ariaLabel: '图片提示词',
    data: {
      kind: 'prompt',
      label: '图片提示词',
      prompt: latestSheet?.prompt || buildSheetPrompt(),
    },
    deletable: false,
    id: 'prompt',
    position: { x: 0, y: Math.max(options.length, 1) * 230 },
    type: 'prompt',
  };
  const generatorNodeData: WorkflowGeneratorNodeData = {
    errorMessage: latestSheet?.errorMessage || '',
    kind: 'generator',
    label: '图片生成',
    name: latestSheet?.name || '角色表',
    progress: latestSheet?.progress || 0,
    resolution: latestSheet?.resolution || '1k',
    status: toRunStatus(latestSheet?.status),
    taskId: latestSheet?.id || '',
  };
  const generator: WorkflowNode = {
    ariaLabel: '图片生成',
    data: generatorNodeData,
    deletable: false,
    id: 'generator',
    position: { x: 410, y: 120 },
    type: 'generator',
  };
  const result: WorkflowNode = {
    ariaLabel: '生成结果',
    data: {
      errorMessage: latestSheet?.errorMessage || '',
      image: latestSheet?.images[0] || null,
      kind: 'result',
      label: latestSheet?.name || '生成结果',
      progress: latestSheet?.progress || 0,
      status: toRunStatus(latestSheet?.status),
    },
    deletable: false,
    id: 'result',
    position: { x: 820, y: 120 },
    type: 'result',
  };

  nodes.value = [...assetNodes, promptNode, generator, result];
  edges.value = [
    ...(assetNodes[0]
      ? [{ id: 'asset-generator', source: assetNodes[0].id, target: generator.id }]
      : []),
    { id: 'prompt-generator', source: promptNode.id, target: generator.id },
    { id: 'generator-result', source: generator.id, target: result.id },
  ];

  if (latestSheet && ACTIVE_STATUSES.includes(latestSheet.status)) {
    isSubmitting.value = true;
    schedulePoll(latestSheet.id);
  }
}

function findNode(id: string): WorkflowNode | null {
  return nodes.value.find(node => node.id === id) ?? null;
}

function findIncomingNode(targetId: string, kind: WorkflowNodeKind): WorkflowNode | null {
  const sourceIds = edges.value.filter(edge => edge.target === targetId).map(edge => edge.source);
  return nodes.value.find(node => sourceIds.includes(node.id) && node.type === kind) ?? null;
}

function findOutgoingNode(sourceId: string, kind: WorkflowNodeKind): WorkflowNode | null {
  const targetIds = edges.value.filter(edge => edge.source === sourceId).map(edge => edge.target);
  return nodes.value.find(node => targetIds.includes(node.id) && node.type === kind) ?? null;
}

const isValidConnection: ValidConnectionFunc = (_connection, { sourceNode, targetNode }) =>
  (sourceNode.type === 'asset' || sourceNode.type === 'prompt') && targetNode.type === 'generator'
    ? true
    : sourceNode.type === 'generator' && targetNode.type === 'result';

function handleConnect(connection: Connection): void {
  const sourceNode = findNode(connection.source);
  if (!sourceNode) {
    return;
  }
  edges.value = [
    ...edges.value.filter(edge => {
      if (edge.target !== connection.target) {
        return true;
      }
      const existingSource = findNode(edge.source);
      return existingSource?.type !== sourceNode.type;
    }),
    {
      id: `${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target: connection.target,
      targetHandle: connection.targetHandle,
    },
  ];
}

function handleNodeClick(event: NodeMouseEvent): void {
  selectedNodeId.value = event.node.id;
}

function handleNodesUpdate(updatedNodes: GraphNode[]): void {
  nodes.value = updatedNodes as WorkflowNode[];
}

function handleEdgesUpdate(updatedEdges: GraphEdge[]): void {
  edges.value = updatedEdges;
}

function updateAsset(value: string): void {
  const node = selectedNode.value;
  const option = assetOptions.value.find(asset => asset.key === value);
  if (!node || node.data.kind !== 'asset' || !option) {
    return;
  }
  const data: WorkflowAssetNodeData = {
    assetKey: option.key,
    image: option.image,
    kind: 'asset',
    label: option.label,
    selection: option.selection,
  };
  node.data = data;
  nodes.value = [...nodes.value];
}

function updatePrompt(value: string): void {
  const node = selectedNode.value;
  if (!node || node.data.kind !== 'prompt') {
    return;
  }
  const data: WorkflowPromptNodeData = { ...node.data, prompt: value };
  node.data = data;
  nodes.value = [...nodes.value];
}

function updateGeneratorName(value: string): void {
  const node = selectedNode.value;
  if (!node || node.data.kind !== 'generator') {
    return;
  }
  node.data = { ...node.data, name: value };
  nodes.value = [...nodes.value];
}

function updateGeneratorResolution(value: CharacterPortraitResolution): void {
  const node = selectedNode.value;
  if (!node || node.data.kind !== 'generator') {
    return;
  }
  node.data = { ...node.data, resolution: value };
  nodes.value = [...nodes.value];
}

function updateGeneratorStatus(
  generatorId: string,
  update: Partial<Omit<WorkflowGeneratorNodeData, 'kind'>>,
): void {
  const node = findNode(generatorId);
  if (!node || node.data.kind !== 'generator') {
    return;
  }
  node.data = { ...node.data, ...update };
  nodes.value = [...nodes.value];
}

function updateResultStatus(
  resultId: string,
  update: Partial<Omit<WorkflowResultNodeData, 'kind'>>,
): void {
  const node = findNode(resultId);
  if (!node || node.data.kind !== 'result') {
    return;
  }
  node.data = { ...node.data, ...update };
  nodes.value = [...nodes.value];
}

function clearPollTimer(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(taskId: string): void {
  clearPollTimer();
  pollTimer = setTimeout(() => {
    void pollTask(taskId);
  }, 2500);
}

async function pollTask(taskId: string): Promise<void> {
  if (isDisposed) {
    return;
  }
  try {
    const record = await window.desktop.getCharacterSheetTask(taskId);
    updateGeneratorStatus('generator', {
      errorMessage: record.errorMessage || '',
      progress: record.progress,
      status: record.status,
      taskId: record.id,
    });
    updateResultStatus('result', {
      errorMessage: record.errorMessage || '',
      image: record.images[0] || null,
      label: record.name,
      progress: record.progress,
      status: record.status,
    });
    errorMessage.value = '';
    if (ACTIVE_STATUSES.includes(record.status)) {
      schedulePoll(taskId);
      return;
    }
    isSubmitting.value = false;
    if (record.status === 'completed') {
      toast.success(`“${record.name}”已生成并保存到资产库`);
    } else {
      errorMessage.value = record.errorMessage || '角色视觉生成任务未完成';
    }
  } catch (pollError: unknown) {
    isSubmitting.value = false;
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  }
}

async function generateFromNode(generatorId = 'generator'): Promise<void> {
  if (generateDisabled.value) {
    return;
  }
  const generator = findNode(generatorId);
  const assetNode = findIncomingNode(generatorId, 'asset');
  const promptNode = findIncomingNode(generatorId, 'prompt');
  const resultNode = findOutgoingNode(generatorId, 'result');
  if (
    !generator ||
    generator.data.kind !== 'generator' ||
    !assetNode ||
    assetNode.data.kind !== 'asset' ||
    !promptNode ||
    promptNode.data.kind !== 'prompt' ||
    !resultNode ||
    resultNode.data.kind !== 'result'
  ) {
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';
  updateGeneratorStatus(generatorId, { errorMessage: '', progress: 0, status: 'submitted' });
  updateResultStatus(resultNode.id, {
    errorMessage: '',
    image: null,
    label: generator.data.name.trim(),
    progress: 0,
    status: 'submitted',
  });
  try {
    const record = await window.desktop.generateCharacterSheet({
      name: generator.data.name.trim(),
      prompt: promptNode.data.prompt.trim(),
      referenceAsset: assetNode.data.selection,
      resolution: generator.data.resolution,
    });
    updateGeneratorStatus(generatorId, {
      progress: record.progress,
      status: record.status,
      taskId: record.id,
    });
    schedulePoll(record.id);
  } catch (generationError: unknown) {
    const message =
      generationError instanceof Error ? generationError.message : String(generationError);
    isSubmitting.value = false;
    errorMessage.value = message;
    updateGeneratorStatus(generatorId, { errorMessage: message, status: 'failed' });
    updateResultStatus(resultNode.id, { errorMessage: message, status: 'failed' });
  }
}

async function initialize(): Promise<void> {
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    const [workspace, status] = await Promise.all([
      window.desktop.getCharacterPortraitWorkspace(),
      window.desktop.getCredentialStatus('apimart'),
    ]);
    credentialStatus.value = status;
    assetOptions.value = createAssetOptions(workspace);
    initializeGraph(workspace, assetOptions.value);
  } catch (initializationError: unknown) {
    errorMessage.value =
      initializationError instanceof Error
        ? initializationError.message
        : String(initializationError);
  } finally {
    isInitializing.value = false;
  }
}

function resetGraph(): void {
  void initialize();
}

onMounted(() => {
  void initialize();
});

onBeforeUnmount(() => {
  isDisposed = true;
  clearPollTimer();
});
</script>

<template>
  <SagPage>
    <template #before-header>
      <CharacterContextBar active-section="character-portrait" />
    </template>

    <template #header>
      <Button
        size="sm"
        variant="ghost"
        class="shrink-0"
        @click="router.push('/character-portrait')"
      >
        <ArrowLeft class="size-4" />
        角色视觉
      </Button>
      <div class="hidden h-5 w-px bg-border sm:block" />
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <Workflow class="size-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">正式资产创作画布</h1>
            <Badge variant="secondary">{{ assetOptions.length }} 个参考</Badge>
          </div>
          <p class="truncate text-xs text-muted-foreground">角色视觉工作流</p>
        </div>
      </div>
      <Button size="icon" variant="ghost" aria-label="重置画布" @click="resetGraph">
        <RotateCcw class="size-4" />
      </Button>
      <Sheet v-model:open="inspectorOpen">
        <SheetTrigger as-child>
          <Button size="icon" variant="outline" class="md:hidden" aria-label="节点属性">
            <PanelRight class="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent class="w-[min(90vw,340px)] p-0" side="right">
          <SheetHeader class="sr-only">
            <SheetTitle>节点属性</SheetTitle>
            <SheetDescription>当前工作流节点属性</SheetDescription>
          </SheetHeader>
          <WorkflowInspector
            :asset-options="assetOptions"
            :generate-disabled="generateDisabled"
            :node="selectedNode"
            @generate="generateFromNode()"
            @update-asset="updateAsset"
            @update-name="updateGeneratorName"
            @update-prompt="updatePrompt"
            @update-resolution="updateGeneratorResolution"
          />
        </SheetContent>
      </Sheet>
    </template>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>工作流暂时中断</AlertTitle>
      <AlertDescription>{{ errorMessage }}</AlertDescription>
    </Alert>

    <div v-if="isInitializing" class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_320px]">
      <div class="space-y-4 p-6">
        <Skeleton class="h-56 w-72" />
        <Skeleton class="ml-80 h-48 w-72" />
      </div>
      <div class="hidden border-l p-4 md:block">
        <Skeleton class="h-9 w-full" />
        <Skeleton class="mt-6 h-64 w-full" />
      </div>
    </div>

    <div v-else-if="!hasOfficialAssets" class="flex min-h-0 flex-1 items-center justify-center p-6">
      <div class="max-w-sm text-center">
        <div class="mx-auto flex size-10 items-center justify-center rounded-md border bg-muted/30">
          <ImageOff class="size-4 text-muted-foreground" />
        </div>
        <h2 class="mt-4 text-sm font-medium">缺少正式角色视觉</h2>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">
          需要至少一张正式资产才能建立参考图生成流程。
        </p>
        <Button class="mt-4" variant="outline" @click="router.push('/character-portrait')">
          <ArrowLeft class="size-4" />
          返回角色视觉
        </Button>
      </div>
    </div>

    <div v-else class="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]">
      <section class="relative min-h-0 min-w-0" aria-label="角色视觉节点画布">
        <Canvas
          :default-edge-options="defaultEdgeOptions"
          :edges="edges"
          :is-valid-connection="isValidConnection"
          :nodes="nodes"
          class="h-full w-full"
          @connect="handleConnect"
          @node-click="handleNodeClick"
          @pane-click="selectedNodeId = ''"
          @update:edges="handleEdgesUpdate"
          @update:nodes="handleNodesUpdate"
        >
          <template #node-asset="nodeProps">
            <WorkflowNodeCard :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>
          <template #node-prompt="nodeProps">
            <WorkflowNodeCard :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>
          <template #node-generator="nodeProps">
            <WorkflowNodeCard
              :data="nodeProps.data"
              :generate-disabled="generateDisabled"
              :selected="nodeProps.selected"
              @generate="generateFromNode(nodeProps.id)"
            />
          </template>
          <template #node-result="nodeProps">
            <WorkflowNodeCard :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>

          <Controls position="bottom-left" />
          <Panel position="top-left" class="flex items-center gap-2 bg-background px-2.5 py-2">
            <span
              class="size-2 rounded-full"
              :class="keyConfigured ? 'bg-emerald-500' : 'bg-destructive'"
            />
            <span class="text-xs">{{ keyConfigured ? 'APIMart 已连接' : 'APIMart 未配置' }}</span>
          </Panel>
        </Canvas>
      </section>

      <div class="hidden min-h-0 border-l md:block">
        <WorkflowInspector
          :asset-options="assetOptions"
          :generate-disabled="generateDisabled"
          :node="selectedNode"
          @generate="generateFromNode()"
          @update-asset="updateAsset"
          @update-name="updateGeneratorName"
          @update-prompt="updatePrompt"
          @update-resolution="updateGeneratorResolution"
        />
      </div>
    </div>
  </SagPage>
</template>
