/** 前端查询生成任务进度时所处的阶段。 */
export type GenerationPollingPhase =
  | 'idle' // 当前没有需要查询的任务
  | 'paused' // 查询失败后暂停，等待用户重试
  | 'requesting' // 正在向主进程请求最新任务状态
  | 'waiting'; // 已安排下一次查询，正在等待定时器触发

/** 生成任务在后端服务中的生命周期状态。 */
export type GenerationTaskStatus =
  | 'submitted' // 任务已提交
  | 'pending' // 任务正在排队
  | 'processing' // 任务正在生成
  | 'completed' // 任务已成功完成
  | 'failed' // 任务执行失败
  | 'cancelled'; // 任务已取消

/** 单个查询流程的前端状态。 */
export interface GenerationPollingState {
  /** 当前查询阶段，不代表生成任务本身的执行状态。 */
  phase: GenerationPollingPhase;
}

/** 带有任务标识的单任务查询状态。 */
export interface GenerationTaskPollingState extends GenerationPollingState {
  /** 当前查询阶段所对应的任务 ID；空字符串表示没有活动任务。 */
  taskId: string;
}

/** 以任务 ID 为键保存多个任务各自的查询状态。 */
export type GenerationPollingStateMap = Record<string, GenerationPollingState>;
