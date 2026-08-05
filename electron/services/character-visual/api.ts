// character-visual 模块的外部 API 客户端
// 通用 fetch / 任务响应解析已经抽离到 electron/utils，这里仅保留 re-export 以满足旧 import 路径
export { getApiErrorMessage, requestApi } from '../../utils';
export { getImageExtension } from '../../utils';
export { getSubmittedTaskId, parseTaskData } from '../../utils';
export type { ApiTaskData, ApiTaskImage } from '../../utils';
