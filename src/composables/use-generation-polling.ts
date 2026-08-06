import { onScopeDispose, ref } from 'vue';
import type { Ref } from 'vue';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';

/** 可用于定位任务的轮询目标：任务 ID，或至少包含任务 ID 的对象。 */
export type GenerationPollingTarget = string | { taskId: string };

/**
 * 生成任务的轮询配置。
 *
 * @template TVersion 单次查询返回的任务数据类型。
 * @template TTarget 发起查询时传入的目标类型，必须能够提供任务 ID，默认为字符串。
 */
export interface GenerationPollingOptions<
  TVersion,
  TTarget extends GenerationPollingTarget = string,
> {
  /** 根据轮询目标查询最新任务数据。 */
  fetchTask: (target: TTarget) => Promise<TVersion>;
  /** 判断任务是否仍在运行；返回 true 时会安排下一次查询。 */
  isStillRunning: (version: TVersion) => boolean;
  /** 判断已经结束的任务是否成功完成。 */
  isTerminalSuccess: (version: TVersion) => boolean;
  /** 两次查询之间的等待时间，单位为毫秒。 */
  intervalMs?: number;
  /** 每次成功取得任务数据后触发。 */
  onPollSuccess?: (taskId: string, version: TVersion) => void;
  /** 任务成功结束后触发。 */
  onCompleted?: (taskId: string, version: TVersion) => void;
  /** 任务结束但未成功时触发。 */
  onFailed?: (taskId: string, version: TVersion) => void;
  /** 查询过程抛出错误时触发。 */
  onError?: (taskId: string, error: unknown) => void;
}

/** 轮询 composable 向调用方暴露的状态和操作。 */
export interface GenerationPollingBundle<TTarget extends GenerationPollingTarget = string> {
  /** 以任务 ID 为键记录每个任务当前的轮询阶段。 */
  pollingStates: Ref<GenerationPollingStateMap>;
  /** 立即查询指定任务。 */
  pollNow: (target: TTarget) => Promise<void>;
  /** 等待配置的间隔后查询指定任务。 */
  schedulePoll: (target: TTarget) => void;
  /** 取消指定任务的轮询并移除其状态。 */
  cancel: (taskId: string) => void;
  /** 取消当前 composable 管理的全部轮询。 */
  cancelAll: () => void;
}

/** 轮询中的有效阶段；没有对应状态记录时视为 idle。 */
type GenerationPollingPhase = 'waiting' | 'requesting' | 'paused';

/** 默认每 2.5 秒查询一次任务状态。 */
const DEFAULT_INTERVAL_MS = 2500;

/** 管理一个或多个生成任务的轮询状态、定时器和生命周期清理。 */
export function useGenerationPolling<TVersion, TTarget extends GenerationPollingTarget = string>(
  options: GenerationPollingOptions<TVersion, TTarget>,
): GenerationPollingBundle<TTarget> {
  /** 当前实例实际使用的轮询间隔。 */
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  /** 暴露给页面展示的任务轮询状态。 */
  const pollingStates = ref<GenerationPollingStateMap>({});
  /** 保存每个任务尚未触发的定时器。 */
  const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** 保存每个任务最新一次轮询的本地版本令牌。 */
  const pollVersions = new Map<string, number>();
  /** 生成单调递增的版本令牌，避免取消后重试与旧请求撞号。 */
  let nextPollVersion = 0;
  /** 标记 composable 是否已经随所属作用域销毁。 */
  let disposed = false;

  /** 从字符串或目标对象中取得统一的任务 ID。 */
  function getTaskId(target: TTarget): string {
    return typeof target === 'string' ? target : target.taskId;
  }

  /** 为一次新的轮询分配版本令牌，并将它设为该任务的最新轮询。 */
  function startPolling(target: TTarget): { taskId: string; version: number } {
    const taskId = getTaskId(target);
    const version = ++nextPollVersion;
    pollVersions.set(taskId, version);
    return { taskId, version };
  }

  /** 判断异步结果是否仍属于当前有效的轮询，过期结果会被忽略。 */
  function isCurrentPoll(taskId: string, version: number): boolean {
    return !disposed && pollVersions.get(taskId) === version;
  }

  /** 更新指定任务的前端轮询阶段。 */
  function setState(taskId: string, phase: GenerationPollingPhase): void {
    pollingStates.value = {
      ...pollingStates.value,
      [taskId]: { phase },
    };
  }

  /** 清除指定任务尚未触发的定时器。 */
  function clearTimer(taskId: string): void {
    const timer = pollTimers.get(taskId);
    if (timer !== undefined) {
      clearTimeout(timer);
      pollTimers.delete(taskId);
    }
  }

  /** 从页面可见的轮询状态中移除指定任务。 */
  function dropState(taskId: string): void {
    if (!(taskId in pollingStates.value)) {
      return;
    }
    const next = { ...pollingStates.value };
    delete next[taskId];
    pollingStates.value = next;
  }

  /** 执行一次查询，并根据结果继续调度或进入终态。 */
  async function pollTask(target: TTarget, version: number): Promise<void> {
    const taskId = getTaskId(target);
    if (!isCurrentPoll(taskId, version)) {
      return;
    }
    pollTimers.delete(taskId);
    setState(taskId, 'requesting');
    try {
      const taskVersion = await options.fetchTask(target);
      // 查询期间可能发生取消或重新轮询，只处理仍然有效的响应。
      if (!isCurrentPoll(taskId, version)) {
        return;
      }
      options.onPollSuccess?.(taskId, taskVersion);
      if (options.isStillRunning(taskVersion)) {
        schedulePoll(target);
        return;
      }
      // 任务进入终态后，不再保留定时器、版本令牌和展示状态。
      clearTimer(taskId);
      pollVersions.delete(taskId);
      dropState(taskId);
      if (options.isTerminalSuccess(taskVersion)) {
        options.onCompleted?.(taskId, taskVersion);
      } else {
        options.onFailed?.(taskId, taskVersion);
      }
    } catch (pollError: unknown) {
      if (!isCurrentPoll(taskId, version)) {
        return;
      }
      options.onError?.(taskId, pollError);
      clearTimer(taskId);
      setState(taskId, 'paused');
    }
  }

  /** 取消等待中的定时器并立即查询指定任务。 */
  async function pollNow(target: TTarget): Promise<void> {
    if (disposed) {
      return;
    }
    const { taskId, version } = startPolling(target);
    clearTimer(taskId);
    await pollTask(target, version);
  }

  /** 用新的版本令牌安排指定任务的下一次查询。 */
  function schedulePoll(target: TTarget): void {
    if (disposed) {
      return;
    }
    const { taskId, version } = startPolling(target);
    clearTimer(taskId);
    setState(taskId, 'waiting');
    pollTimers.set(
      taskId,
      setTimeout(() => {
        void pollTask(target, version);
      }, intervalMs),
    );
  }

  /** 取消单个任务，并使它尚未返回的异步查询失效。 */
  function cancel(taskId: string): void {
    clearTimer(taskId);
    pollVersions.delete(taskId);
    dropState(taskId);
  }

  /** 取消全部任务，并清空当前实例维护的所有轮询状态。 */
  function cancelAll(): void {
    for (const timer of pollTimers.values()) {
      clearTimeout(timer);
    }
    pollTimers.clear();
    pollVersions.clear();
    pollingStates.value = {};
  }

  // 所属 Vue 作用域销毁后，永久停止当前实例并释放所有定时器。
  onScopeDispose(() => {
    disposed = true;
    cancelAll();
  });

  return {
    cancel,
    cancelAll,
    pollNow,
    pollingStates,
    schedulePoll,
  };
}
