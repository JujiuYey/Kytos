import type { Node as FlowNode } from '@vue-flow/core';
import type {
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualAssetSelection,
} from '@/types';

export type WorkflowNodeKind = 'asset' | 'generator' | 'result';
export type WorkflowRunStatus =
  | 'idle'
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface WorkflowAssetOption {
  image: CharacterVisualImage;
  key: string;
  label: string;
  selection: CharacterVisualAssetSelection;
}

export interface WorkflowAssetNodeData {
  assetKey: string;
  image: CharacterVisualImage;
  kind: 'asset';
  label: string;
  selection: CharacterVisualAssetSelection;
}

export interface WorkflowGeneratorNodeData {
  errorMessage: string;
  kind: 'generator';
  label: string;
  name: string;
  prompt: string;
  progress: number;
  resolution: CharacterVisualResolution;
  status: WorkflowRunStatus;
  taskId: string;
}

export interface WorkflowResultNodeData {
  errorMessage: string;
  image: CharacterVisualImage | null;
  kind: 'result';
  label: string;
  progress: number;
  status: WorkflowRunStatus;
}

export type WorkflowNodeData =
  | WorkflowAssetNodeData
  | WorkflowGeneratorNodeData
  | WorkflowResultNodeData;

export interface WorkflowNode extends FlowNode<WorkflowNodeData> {
  data: WorkflowNodeData;
  type: WorkflowNodeKind;
}
