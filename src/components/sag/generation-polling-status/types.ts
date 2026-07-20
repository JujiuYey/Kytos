export type GenerationPollingPhase = 'idle' | 'paused' | 'requesting' | 'waiting';

export interface GenerationPollingState {
  attempt: number;
  phase: GenerationPollingPhase;
}

export interface GenerationTaskPollingState extends GenerationPollingState {
  taskId: string;
}

export type GenerationPollingStateMap = Record<string, GenerationPollingState>;
