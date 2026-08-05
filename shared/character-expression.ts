// 角色表情模块的类型定义与请求/响应模型
import type {
  CharacterVisualAssetRecord,
  CharacterVisualResolution,
  CharacterVisualAssetSelection,
  CharacterVisualTaskStatus,
} from './character-visual';
import type { CharacterScopeRequest } from './character-library';
import type { ChatModel } from './chat-model';
import type { SavedFileResult } from './desktop';

// 角色表情支持的尺寸
export const CHARACTER_EXPRESSION_SIZES = ['1:1', '3:4', '4:5'] as const;
// 角色表情单次生成最多可使用的参考图数量
export const MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES = 16;

// 角色表情尺寸
export type CharacterExpressionSize = (typeof CHARACTER_EXPRESSION_SIZES)[number];
// 角色表情引用类型
export type CharacterExpressionReferenceKind = 'visual' | 'expression';

// 角色表情引用选择
export interface CharacterExpressionReferenceSelection extends CharacterVisualAssetSelection {
  // 引用类型
  kind: CharacterExpressionReferenceKind;
}

// 生成角色表情请求
export interface GenerateCharacterExpressionRequest extends CharacterScopeRequest {
  // 生成数量
  count: number;
  // 表情描述
  description: string;
  // 表情名称
  name: string;
  // 参考素材列表
  referenceAssets: CharacterExpressionReferenceSelection[];
  // 分辨率
  resolution: CharacterVisualResolution;
  // 尺寸
  size: CharacterExpressionSize;
}

// 角色表情记录
export interface CharacterExpressionRecord
  extends
    Omit<CharacterVisualAssetRecord<CharacterExpressionSize>, 'referenceAssets' | 'status'>,
    Omit<GenerateCharacterExpressionRequest, 'characterId'> {
  status: 'completed';
}

// 尚未转为正式表情资产的异步生成任务
export interface CharacterExpressionTask extends Omit<
  GenerateCharacterExpressionRequest,
  'characterId'
> {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  progress: number;
  prompt: string;
  status: Exclude<CharacterVisualTaskStatus, 'completed'>;
  updatedAt: string;
}

// 单次任务查询结果：处理中返回 task，完成后返回正式 record
export interface CharacterExpressionTaskResult {
  record: CharacterExpressionRecord | null;
  task: CharacterExpressionTask | null;
}

// 角色表情工作区状态
export interface CharacterExpressionWorkspaceState {
  // 表情记录列表
  records: CharacterExpressionRecord[];
  // 尚未完成或需要展示错误状态的任务
  tasks: CharacterExpressionTask[];
}

// 删除角色表情请求
export interface DeleteCharacterExpressionRequest extends CharacterScopeRequest {
  // 文件名
  fileName: string;
  // 任务ID
  taskId: string;
}

// 重命名角色表情请求
export interface RenameCharacterExpressionRequest extends CharacterScopeRequest {
  // 新名称
  name: string;
  // 任务ID
  taskId: string;
}

// 上传角色表情请求
export interface UploadCharacterExpressionRequest extends CharacterScopeRequest {
  // 文件二进制内容
  fileData: Uint8Array;
  // 文件名
  fileName: string;
  // MIME 类型
  mimeType: string;
  // 表情名称
  name: string;
}

// 查询角色表情任务请求
export interface GetCharacterExpressionTaskRequest extends CharacterScopeRequest {
  // 任务ID
  taskId: string;
}

// 查询角色表情工作区请求
export type GetCharacterExpressionWorkspaceRequest = CharacterScopeRequest;

// 生成角色表情提示词请求
export interface GenerateCharacterExpressionPromptRequest {
  // 使用的模型
  model: ChatModel;
  // 表情名称
  name: string;
}

// 角色表情 API
export interface CharacterExpressionApi {
  // 删除角色表情
  deleteCharacterExpression: (
    request: DeleteCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  // 生成角色表情
  generateCharacterExpression: (
    request: GenerateCharacterExpressionRequest,
  ) => Promise<CharacterExpressionTask>;
  // 生成角色表情提示词
  generateCharacterExpressionPrompt: (
    request: GenerateCharacterExpressionPromptRequest,
  ) => Promise<string>;
  // 查询角色表情任务
  getCharacterExpressionTask: (
    request: GetCharacterExpressionTaskRequest,
  ) => Promise<CharacterExpressionTaskResult>;
  // 查询角色表情工作区
  getCharacterExpressionWorkspace: (
    request: GetCharacterExpressionWorkspaceRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  // 重命名角色表情
  renameCharacterExpression: (
    request: RenameCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  // 上传角色表情
  uploadCharacterExpression: (
    request: UploadCharacterExpressionRequest,
  ) => Promise<SavedFileResult>;
}
