// 插画模块的类型定义与请求/响应模型
import type { UIMessage } from 'ai';
import type {
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from './character-portrait';
import type { CharacterExpressionReferenceSelection } from './character-expression';

// 插画 Agent 端点
export const ILLUSTRATION_AGENT_ENDPOINT = 'app://bundle/api/illustration-agent';
// 插画支持的尺寸比例
export const ILLUSTRATION_SIZES = ['1:1', '3:4', '4:5', '16:9', '9:16'] as const;
// 单次生成最多可使用的参考图数量
export const MAX_ILLUSTRATION_REFERENCE_IMAGES = 16;
// 插画尺寸比例
export type IllustrationSize = (typeof ILLUSTRATION_SIZES)[number];

// 插画简报
export interface IllustrationBrief {
  // 动作
  action: string;
  // 画面构图
  composition: string;
  // 细节
  details: string;
  // 环境
  environment: string;
  // 最终提示词
  finalPrompt: string;
  // 氛围
  mood: string;
  // 风格
  style: string;
  // 主体
  subject: string;
}

// 插画简报更新结果
export interface IllustrationBriefUpdateResult {
  // 简报
  brief: IllustrationBrief;
  // 是否就绪
  ready: boolean;
  // 标题
  title: string;
}

// 插画 Agent 工具集合
type IllustrationAgentTools = {
  // 呈现插画方案
  presentIllustrationPlan: {
    input: IllustrationBrief & { title: string };
    output: IllustrationBriefUpdateResult;
  };
  // 更新插画简报
  updateIllustrationBrief: {
    input: Partial<IllustrationBrief> & { title?: string };
    output: IllustrationBriefUpdateResult;
  };
};

// 插画 Agent 会话消息
export type IllustrationAgentMessage = UIMessage<unknown, never, IllustrationAgentTools>;

// 插画版本引用
export interface IllustrationVersionReference {
  // 文件名
  fileName: string;
  // 版本ID
  versionId: string;
}

// 插画版本
export interface IllustrationVersion {
  // 基础版本
  baseVersion: IllustrationVersionReference | null;
  // 角色引用列表
  characterReferences: CharacterExpressionReferenceSelection[];
  // 创建时间
  createdAt: string;
  // 错误信息
  errorMessage: string | null;
  // 版本ID
  id: string;
  // 图片列表
  images: CharacterPortraitImage[];
  // 生成进度
  progress: number;
  // 提示词
  prompt: string;
  // 引用头像
  referencePortrait: CharacterPortraitSelection | null;
  // 引用设定图
  referenceSheet: CharacterPortraitSelection | null;
  // 分辨率
  resolution: CharacterPortraitResolution;
  // 尺寸
  size: IllustrationSize;
  // 任务状态
  status: CharacterPortraitTaskStatus;
  // 更新时间
  updatedAt: string;
  // 是否使用角色
  useCharacter: boolean;
  // 版本号
  versionNumber: number;
}

// 插画主题
export interface IllustrationTopic {
  // 简报
  brief: IllustrationBrief;
  // 创建时间
  createdAt: string;
  // 主题ID
  id: string;
  // 会话消息
  messages: IllustrationAgentMessage[];
  // 是否就绪
  ready: boolean;
  // 标题
  title: string;
  // 更新时间
  updatedAt: string;
  // 是否使用角色
  useCharacter: boolean;
  // 版本列表
  versions: IllustrationVersion[];
}

// 已上传插画
export interface UploadedIllustration {
  // 创建时间
  createdAt: string;
  // 文件名
  fileName: string;
  // 上传记录ID
  id: string;
  // MIME 类型
  mimeType: string;
  // 原始文件名
  originalName: string;
  // 文件大小
  size: number;
  // 访问地址
  url: string;
}

// 插画工作区状态
export interface IllustrationWorkspaceState {
  // 主题列表
  topics: IllustrationTopic[];
  // 上传列表
  uploads: UploadedIllustration[];
}

// 创建插画主题请求
export interface CreateIllustrationTopicRequest {
  // 是否使用角色
  useCharacter: boolean;
}

// 更新插画主题请求
export interface UpdateIllustrationTopicRequest {
  // 标题
  title?: string;
  // 主题ID
  topicId: string;
  // 是否使用角色
  useCharacter?: boolean;
}

// 保存插画会话请求
export interface SaveIllustrationConversationRequest {
  // 会话消息
  messages: IllustrationAgentMessage[];
  // 主题ID
  topicId: string;
}

// 生成插画请求
export interface GenerateIllustrationRequest {
  // 基础版本
  baseVersion: IllustrationVersionReference | null;
  // 角色引用列表
  characterReferences: CharacterExpressionReferenceSelection[];
  // 提示词
  prompt: string;
  // 修订提示词
  revisionPrompt: string | null;
  // 分辨率
  resolution: CharacterPortraitResolution;
  // 尺寸
  size: IllustrationSize;
  // 主题ID
  topicId: string;
}

// 删除插画主题请求
export interface DeleteIllustrationTopicRequest {
  // 主题ID
  topicId: string;
}

// 删除插画版本请求
export interface DeleteIllustrationVersionRequest {
  // 主题ID
  topicId: string;
  // 版本ID
  versionId: string;
}

// 删除已上传插画请求
export interface DeleteIllustrationUploadRequest {
  // 上传记录ID
  uploadId: string;
}

// 上传插画请求
export interface UploadIllustrationRequest {
  // 文件二进制内容
  fileData: Uint8Array;
  // 文件名
  fileName: string;
  // MIME 类型
  mimeType: string;
}

// 创建空的插画简报
export function createEmptyIllustrationBrief(): IllustrationBrief {
  return {
    action: '',
    composition: '',
    details: '',
    environment: '',
    finalPrompt: '',
    mood: '',
    style: '',
    subject: '',
  };
}

// 插画 API
export interface IllustrationApi {
  // 创建插画主题
  createIllustrationTopic: (
    request: CreateIllustrationTopicRequest,
  ) => Promise<IllustrationTopic>;
  // 删除插画主题
  deleteIllustrationTopic: (
    request: DeleteIllustrationTopicRequest,
  ) => Promise<IllustrationWorkspaceState>;
  // 删除插画版本
  deleteIllustrationVersion: (
    request: DeleteIllustrationVersionRequest,
  ) => Promise<IllustrationTopic>;
  // 删除已上传插画
  deleteIllustrationUpload: (
    request: DeleteIllustrationUploadRequest,
  ) => Promise<IllustrationWorkspaceState>;
  // 生成插画
  generateIllustration: (request: GenerateIllustrationRequest) => Promise<IllustrationVersion>;
  // 查询插画任务
  getIllustrationTask: (taskId: string) => Promise<IllustrationVersion>;
  // 查询插画工作区
  getIllustrationWorkspace: () => Promise<IllustrationWorkspaceState>;
  // 保存插画会话
  saveIllustrationConversation: (
    request: SaveIllustrationConversationRequest,
  ) => Promise<IllustrationTopic>;
  // 更新插画主题
  updateIllustrationTopic: (request: UpdateIllustrationTopicRequest) => Promise<IllustrationTopic>;
  // 上传插画
  uploadIllustration: (request: UploadIllustrationRequest) => Promise<UploadedIllustration>;
}
