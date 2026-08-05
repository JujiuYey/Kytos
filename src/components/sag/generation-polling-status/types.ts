export type GenerationPollingPhase = 'idle' | 'paused' | 'requesting' | 'waiting';

export type GenerationTaskStatus =
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GenerationPollingState {
  phase: GenerationPollingPhase;
}

export interface GenerationTaskPollingState extends GenerationPollingState {
  taskId: string;
}

export type GenerationPollingStateMap = Record<string, GenerationPollingState>;
