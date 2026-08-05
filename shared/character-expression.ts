// 角色表情模块的类型定义与请求/响应模型
import type {
  CharacterVisualAssetRecord,
  CharacterVisualResolution,
  CharacterVisualAssetSelection,
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
    Omit<CharacterVisualAssetRecord<CharacterExpressionSize>, 'referenceAssets'>,
    Omit<GenerateCharacterExpressionRequest, 'characterId'> {}

// 角色表情工作区状态
export interface CharacterExpressionWorkspaceState {
  // 表情记录列表
  records: CharacterExpressionRecord[];
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
  ) => Promise<CharacterExpressionRecord>;
  // 生成角色表情提示词
  generateCharacterExpressionPrompt: (
    request: GenerateCharacterExpressionPromptRequest,
  ) => Promise<string>;
  // 查询角色表情任务
  getCharacterExpressionTask: (
    request: GetCharacterExpressionTaskRequest,
  ) => Promise<CharacterExpressionRecord>;
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
