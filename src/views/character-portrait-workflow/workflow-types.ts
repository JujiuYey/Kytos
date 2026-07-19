import type { Node as FlowNode } from '@vue-flow/core';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterVisualAssetSelection,
} from '@/types';

export type WorkflowNodeKind = 'asset' | 'prompt' | 'generator' | 'result';
export type WorkflowRunStatus =
  | 'idle'
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowAssetOption {
  image: CharacterPortraitImage;
  key: string;
  label: string;
  selection: CharacterVisualAssetSelection;
}

export interface WorkflowAssetNodeData {
  assetKey: string;
  image: CharacterPortraitImage;
  kind: 'asset';
  label: string;
  selection: CharacterVisualAssetSelection;
}

export interface WorkflowPromptNodeData {
  kind: 'prompt';
  label: string;
  prompt: string;
}

export interface WorkflowGeneratorNodeData {
  errorMessage: string;
  kind: 'generator';
  label: string;
  name: string;
  progress: number;
  resolution: CharacterPortraitResolution;
  status: WorkflowRunStatus;
  taskId: string;
}

export interface WorkflowResultNodeData {
  errorMessage: string;
  image: CharacterPortraitImage | null;
  kind: 'result';
  label: string;
  progress: number;
  status: WorkflowRunStatus;
}

export type WorkflowNodeData =
  | WorkflowAssetNodeData
  | WorkflowPromptNodeData
  | WorkflowGeneratorNodeData
  | WorkflowResultNodeData;

export interface WorkflowNode extends FlowNode<WorkflowNodeData> {
  data: WorkflowNodeData;
  type: WorkflowNodeKind;
}
