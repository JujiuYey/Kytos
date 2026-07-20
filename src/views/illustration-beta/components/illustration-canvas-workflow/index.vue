<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { Connection, Edge, NodeMouseEvent, ValidConnectionFunc } from '@vue-flow/core';
import { MarkerType, useVueFlow } from '@vue-flow/core';
import { AlertCircle, ImageOff, PanelRight, Plus, RotateCcw } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Canvas } from '@/components/ai-elements/canvas';
import { Controls } from '@/components/ai-elements/controls';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Panel } from '@/components/ai-elements/panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  CharacterImageRecord,
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  CharacterVisualAssetSelection,
  CredentialStatus,
} from '@/types';
import { MAX_CHARACTER_SHEET_REFERENCE_IMAGES } from '@/types';
import WorkflowInspector from './components/workflow-inspector.vue';
import WorkflowNodeCard from './components/workflow-node.vue';
import type {
  WorkflowAssetNodeData,
  WorkflowAssetOption,
  WorkflowGeneratorNodeData,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowResultNodeData,
  WorkflowRunStatus,
} from './workflow-types';

const emit = defineEmits<{
  (event: 'workspace-updated'): void;
}>();

const nodes = shallowRef<WorkflowNode[]>([]);
const edges = shallowRef<Edge[]>([]);
const assetOptions = ref<WorkflowAssetOption[]>([]);
const selectedNodeId = ref('generator');
const credentialStatus = ref<CredentialStatus | null>(null);
const isInitializing = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref('');
const inspectorOpen = ref(false);
const canvasSection = ref<HTMLElement | null>(null);
const { addEdges, addNodes, removeNodes, screenToFlowCoordinate } = useVueFlow(
  'illustration-canvas-workflow',
);

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;
let nextAssetNodeIndex = 1;

const ACTIVE_STATUSES: WorkflowRunStatus[] = ['submitted', 'pending', 'processing'];
const FIXED_RESULT_EDGE_ID = 'generator-result';

const selectedNode = computed(
  () => nodes.value.find(node => node.id === selectedNodeId.value) ?? null,
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const hasOfficialAssets = computed(() => assetOptions.value.length > 0);
const generatorNode = computed(() => nodes.value.find(node => node.type === 'generator') ?? null);
const connectedAssetNodes = computed(() => {
  const generator = generatorNode.value;
  return generator ? findIncomingNodes(generator.id, 'asset') : [];
});
const connectedAssetCount = computed(() => connectedAssetNodes.value.length);
const availableAssetOptions = computed(() => {
  const assetKeys = new Set(
    nodes.value.flatMap(node => (node.data.kind === 'asset' ? [node.data.assetKey] : [])),
  );
  return assetOptions.value.filter(option => !assetKeys.has(option.key));
});

const generateDisabled = computed(() => {
  const generator = generatorNode.value;
  if (!generator || generator.data.kind !== 'generator') {
    return true;
  }
  const resultNode = findOutgoingNode(generator.id, 'result');
  return (
    isInitializing.value ||
    isSubmitting.value ||
    ACTIVE_STATUSES.includes(generator.data.status) ||
    !keyConfigured.value ||
    connectedAssetCount.value < 1 ||
    connectedAssetCount.value > MAX_CHARACTER_SHEET_REFERENCE_IMAGES ||
    !resultNode ||
    !generator.data.prompt.trim() ||
    generator.data.prompt.length > 20_000 ||
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
  const assetNodes: WorkflowNode[] = options.slice(0, 1).map((option, index) => ({
    ariaLabel: `参考图：${option.label}`,
    data: {
      assetKey: option.key,
      image: option.image,
      kind: 'asset',
      label: option.label,
      selection: option.selection,
    },
    deletable: true,
    id: `asset-${index + 1}`,
    position: { x: 0, y: 120 + index * 230 },
    type: 'asset',
  }));
  const generatorNodeData: WorkflowGeneratorNodeData = {
    errorMessage: latestSheet?.errorMessage || '',
    kind: 'generator',
    label: '图片生成',
    name: latestSheet?.name || '角色表',
    prompt: latestSheet?.prompt || buildSheetPrompt(),
    progress: latestSheet?.progress || 0,
    resolution: latestSheet?.resolution || '1k',
    status: toRunStatus(latestSheet?.status),
    taskId: latestSheet?.id || '',
  };
  const generator: WorkflowNode = {
    ariaLabel: '图片生成',
    data: generatorNodeData,
    deletable: false,
    draggable: false,
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
    draggable: false,
    id: 'result',
    position: { x: 820, y: 120 },
    type: 'result',
  };

  nodes.value = [...assetNodes, generator, result];
  nextAssetNodeIndex = assetNodes.length + 1;
  edges.value = [
    ...(assetNodes[0] ? [createReferenceEdge('asset-generator', assetNodes[0].id)] : []),
    createFixedResultEdge(),
  ];

  if (latestSheet && ACTIVE_STATUSES.includes(latestSheet.status)) {
    isSubmitting.value = true;
    schedulePoll(latestSheet.id);
  }
}

function findNode(id: string): WorkflowNode | null {
  return nodes.value.find(node => node.id === id) ?? null;
}

function findIncomingNodes(targetId: string, kind: WorkflowNodeKind): WorkflowNode[] {
  const sourceIds = edges.value.filter(edge => edge.target === targetId).map(edge => edge.source);
  return nodes.value.filter(node => sourceIds.includes(node.id) && node.type === kind);
}

function findOutgoingNode(sourceId: string, kind: WorkflowNodeKind): WorkflowNode | null {
  const targetIds = edges.value.filter(edge => edge.source === sourceId).map(edge => edge.target);
  return nodes.value.find(node => targetIds.includes(node.id) && node.type === kind) ?? null;
}

const isValidConnection: ValidConnectionFunc = (
  connection,
  { edges: graphEdges, sourceNode, targetNode },
) => {
  if (connection.source === 'generator' && connection.target === 'result') {
    return true;
  }
  if (sourceNode.type !== 'asset' || targetNode.type !== 'generator') {
    return false;
  }
  const sourceAlreadyConnected = graphEdges.some(
    edge => edge.source === connection.source && edge.target === connection.target,
  );
  const connectedReferenceCount = new Set(
    graphEdges.filter(edge => edge.target === 'generator').map(edge => edge.source),
  ).size;
  return sourceAlreadyConnected || connectedReferenceCount < MAX_CHARACTER_SHEET_REFERENCE_IMAGES;
};

function createFixedResultEdge(): Edge {
  return {
    deletable: false,
    id: FIXED_RESULT_EDGE_ID,
    markerEnd: MarkerType.ArrowClosed,
    selectable: false,
    source: 'generator',
    target: 'result',
    type: 'smoothstep',
    updatable: false,
  };
}

function createReferenceEdge(id: string, source: string): Edge {
  return {
    deletable: true,
    id,
    markerEnd: MarkerType.ArrowClosed,
    source,
    target: 'generator',
    type: 'smoothstep',
  };
}

function handleConnect(connection: Connection): void {
  const sourceNode = findNode(connection.source);
  const targetNode = findNode(connection.target);
  if (!sourceNode || !targetNode) {
    return;
  }
  const alreadyConnected = edges.value.some(
    edge => edge.source === connection.source && edge.target === connection.target,
  );
  if (alreadyConnected) {
    return;
  }
  if (
    sourceNode.type !== 'asset' ||
    targetNode.type !== 'generator' ||
    findIncomingNodes(targetNode.id, 'asset').length >= MAX_CHARACTER_SHEET_REFERENCE_IMAGES
  ) {
    return;
  }
  addEdges({
    ...createReferenceEdge(
      `${connection.source}-${connection.target}-${Date.now()}`,
      connection.source,
    ),
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
  });
}

function addAssetNode(option: WorkflowAssetOption): void {
  const bounds = canvasSection.value?.getBoundingClientRect();
  const center = bounds
    ? screenToFlowCoordinate({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      })
    : { x: 144, y: 170 };
  let id = `asset-${nextAssetNodeIndex}`;
  while (findNode(id)) {
    nextAssetNodeIndex += 1;
    id = `asset-${nextAssetNodeIndex}`;
  }
  nextAssetNodeIndex += 1;

  const node: WorkflowNode = {
    ariaLabel: `参考图：${option.label}`,
    data: {
      assetKey: option.key,
      image: option.image,
      kind: 'asset',
      label: option.label,
      selection: option.selection,
    },
    deletable: true,
    id,
    position: { x: center.x - 144, y: center.y - 170 },
    type: 'asset',
  };

  addNodes(node);
  selectedNodeId.value = node.id;
}

function deleteNode(nodeId: string): void {
  const node = findNode(nodeId);
  if (!node?.deletable) {
    return;
  }
  removeNodes(nodeId, true);
  if (selectedNodeId.value === nodeId) {
    selectedNodeId.value = '';
  }
}

function handleNodeClick(event: NodeMouseEvent): void {
  selectedNodeId.value = event.node.id;
}

function updateAsset(value: string): void {
  const node = selectedNode.value;
  const option = assetOptions.value.find(asset => asset.key === value);
  if (!node || node.data.kind !== 'asset' || !option) {
    return;
  }
  if (
    nodes.value.some(
      item =>
        item.id !== node.id && item.data.kind === 'asset' && item.data.assetKey === option.key,
    )
  ) {
    toast.error('这张参考图已在画布中');
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
  const node = findNode('generator');
  if (!node || node.data.kind !== 'generator') {
    return;
  }
  node.data = { ...node.data, prompt: value };
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
      emit('workspace-updated');
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
  const assetNodes = findIncomingNodes(generatorId, 'asset');
  const resultNode = findOutgoingNode(generatorId, 'result');
  if (
    !generator ||
    generator.data.kind !== 'generator' ||
    assetNodes.length < 1 ||
    assetNodes.length > MAX_CHARACTER_SHEET_REFERENCE_IMAGES ||
    !resultNode ||
    resultNode.data.kind !== 'result'
  ) {
    return;
  }
  const referenceAssets = assetNodes.flatMap<CharacterVisualAssetSelection>(node => {
    if (node.data.kind !== 'asset') {
      return [];
    }
    const { fileName, kind, taskId } = node.data.selection;
    return [{ fileName, kind, taskId }];
  });
  if (referenceAssets.length !== assetNodes.length) {
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
      prompt: generator.data.prompt.trim(),
      referenceAssets,
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
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
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
      </div>
    </div>

    <div
      v-else
      class="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]"
    >
      <section ref="canvasSection" class="relative min-h-0 min-w-0" aria-label="角色视觉节点画布">
        <Canvas
          id="illustration-canvas-workflow"
          :default-edge-options="defaultEdgeOptions"
          :is-valid-connection="isValidConnection"
          v-model:edges="edges"
          v-model:nodes="nodes"
          class="h-full w-full"
          @connect="handleConnect"
          @node-click="handleNodeClick"
          @pane-click="selectedNodeId = ''"
        >
          <template #node-asset="nodeProps">
            <WorkflowNodeCard
              :data="nodeProps.data"
              :deletable="nodeProps.deletable"
              :selected="nodeProps.selected || selectedNodeId === nodeProps.id"
              @delete="deleteNode(nodeProps.id)"
            />
          </template>
          <template #node-generator="nodeProps">
            <WorkflowNodeCard
              :data="nodeProps.data"
              :generate-disabled="generateDisabled"
              :reference-count="connectedAssetCount"
              :selected="nodeProps.selected || selectedNodeId === nodeProps.id"
              @generate="generateFromNode(nodeProps.id)"
              @update-prompt="updatePrompt"
            />
          </template>
          <template #node-result="nodeProps">
            <WorkflowNodeCard
              :data="nodeProps.data"
              :selected="nodeProps.selected || selectedNodeId === nodeProps.id"
            />
          </template>

          <Controls position="bottom-left" />
          <Panel position="top-left" class="flex items-center gap-2 bg-background px-2.5 py-2">
            <span
              class="size-2 rounded-full"
              :class="keyConfigured ? 'bg-emerald-500' : 'bg-destructive'"
            />
            <span class="text-xs">{{ keyConfigured ? 'APIMart 已连接' : 'APIMart 未配置' }}</span>
          </Panel>
          <Panel position="top-right" class="flex items-center gap-1 bg-background p-1">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button size="sm" variant="ghost">
                  <Plus class="size-4" />
                  添加参考图
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-64">
                <DropdownMenuLabel>选择正式资产</DropdownMenuLabel>
                <DropdownMenuItem
                  v-for="asset in availableAssetOptions"
                  :key="asset.key"
                  class="min-w-0"
                  @select="addAssetNode(asset)"
                >
                  <AiImage
                    :alt="asset.label"
                    :src="asset.image.url"
                    class="size-9 shrink-0 border bg-muted/30 object-contain"
                  />
                  <span class="min-w-0 truncate">{{ asset.label }}</span>
                </DropdownMenuItem>
                <DropdownMenuItem v-if="availableAssetOptions.length === 0" disabled>
                  所有正式资产已在画布中
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="icon" variant="ghost" aria-label="重置画布" @click="resetGraph">
              <RotateCcw class="size-4" />
            </Button>
            <Sheet v-model:open="inspectorOpen">
              <SheetTrigger as-child>
                <Button size="icon" variant="ghost" class="md:hidden" aria-label="节点属性">
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
                  :reference-count="connectedAssetCount"
                  @generate="generateFromNode()"
                  @update-asset="updateAsset"
                  @update-name="updateGeneratorName"
                  @update-prompt="updatePrompt"
                  @update-resolution="updateGeneratorResolution"
                />
              </SheetContent>
            </Sheet>
          </Panel>
        </Canvas>
      </section>

      <div class="hidden min-h-0 min-w-0 p-3 md:flex md:p-4">
        <WorkflowInspector
          :asset-options="assetOptions"
          :generate-disabled="generateDisabled"
          :node="selectedNode"
          :reference-count="connectedAssetCount"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @generate="generateFromNode()"
          @update-asset="updateAsset"
          @update-name="updateGeneratorName"
          @update-prompt="updatePrompt"
          @update-resolution="updateGeneratorResolution"
        />
      </div>
    </div>
  </div>
</template>
