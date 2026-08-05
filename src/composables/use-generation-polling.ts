import { onScopeDispose, ref } from 'vue';
import type { Ref } from 'vue';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';

export interface GenerationPollingOptions<TVersion> {
  fetchTask: (taskId: string) => Promise<TVersion>;
  isStillRunning: (version: TVersion) => boolean;
  isTerminalSuccess: (version: TVersion) => boolean;
  intervalMs?: number;
  onPollSuccess?: (taskId: string, version: TVersion) => void;
  onCompleted?: (taskId: string, version: TVersion) => void;
  onFailed?: (taskId: string, version: TVersion) => void;
  onError?: (taskId: string, error: unknown) => void;
}

export interface GenerationPollingBundle {
  pollingStates: Ref<GenerationPollingStateMap>;
  schedulePoll: (taskId: string) => void;
  cancel: (taskId: string) => void;
  cancelAll: () => void;
}

type GenerationPollingPhase = 'waiting' | 'requesting' | 'paused';

const DEFAULT_INTERVAL_MS = 2500;

export function useGenerationPolling<TVersion>(
  options: GenerationPollingOptions<TVersion>,
): GenerationPollingBundle {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const pollingStates = ref<GenerationPollingStateMap>({});
  const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;

  function setState(taskId: string, phase: GenerationPollingPhase): void {
    pollingStates.value = {
      ...pollingStates.value,
      [taskId]: { phase },
    };
  }

  function clearTimer(taskId: string): void {
    const timer = pollTimers.get(taskId);
    if (timer !== undefined) {
      clearTimeout(timer);
      pollTimers.delete(taskId);
    }
  }

  function dropState(taskId: string): void {
    if (!(taskId in pollingStates.value)) {
      return;
    }
    const next = { ...pollingStates.value };
    delete next[taskId];
    pollingStates.value = next;
  }

  async function pollTask(taskId: string): Promise<void> {
    if (disposed) {
      return;
    }
    setState(taskId, 'requesting');
    try {
      const version = await options.fetchTask(taskId);
      options.onPollSuccess?.(taskId, version);
      if (options.isStillRunning(version)) {
        schedulePoll(taskId);
        return;
      }
      clearTimer(taskId);
      dropState(taskId);
      if (options.isTerminalSuccess(version)) {
        options.onCompleted?.(taskId, version);
      } else {
        options.onFailed?.(taskId, version);
      }
    } catch (pollError: unknown) {
      options.onError?.(taskId, pollError);
      clearTimer(taskId);
      setState(taskId, 'paused');
    }
  }

  function schedulePoll(taskId: string): void {
    if (disposed) {
      return;
    }
    clearTimer(taskId);
    setState(taskId, 'waiting');
    pollTimers.set(
      taskId,
      setTimeout(() => {
        void pollTask(taskId);
      }, intervalMs),
    );
  }

  function cancel(taskId: string): void {
    clearTimer(taskId);
    dropState(taskId);
  }

  function cancelAll(): void {
    disposed = true;
    for (const timer of pollTimers.values()) {
      clearTimeout(timer);
    }
    pollTimers.clear();
    pollingStates.value = {};
  }

  onScopeDispose(cancelAll);

  return {
    cancel,
    cancelAll,
    pollingStates,
    schedulePoll,
  };
}
