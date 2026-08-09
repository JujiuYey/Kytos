// 插画模块的类型定义与请求/响应模型
import type { UIMessage } from 'ai';
import type {
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualTaskStatus,
} from './character-visual';

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

// 插画调整底图引用：可以来自当前主题的生成版本，也可以来自上传插画。
export type IllustrationRevisionReference =
  | {
      fileName: string;
      source: 'generated';
      versionId: string;
    }
  | {
      fileName: string;
      source: 'uploaded';
      uploadId: string;
    };

// 参考图用途：同一张图在 Agent 和生图阶段不能被当成同一种证据处理。
export type IllustrationReferencePurpose = 'style' | 'content' | 'character';

// 画面素材引用：角色素材和插画素材分别保留自己的来源定位
export type IllustrationReference =
  | {
      characterId: string;
      fileName: string;
      kind: 'character-expression' | 'character-visual';
      purpose?: IllustrationReferencePurpose;
      taskId: string;
    }
  | {
      fileName: string;
      kind: 'illustration';
      purpose?: IllustrationReferencePurpose;
      source: 'generated' | 'uploaded';
      topicId: string | null;
      uploadId: string | null;
      versionId: string | null;
    };

// 插画版本
export interface IllustrationVersion {
  // 基础版本
  baseVersion: IllustrationVersionReference | null;
  // 生成时使用的画面素材快照
  references: IllustrationReference[];
  // 创建时间
  createdAt: string;
  // 错误信息
  errorMessage: string | null;
  // 版本ID
  id: string;
  // 图片列表
  images: CharacterVisualImage[];
  // 生成进度
  progress: number;
  // 提示词
  prompt: string;
  // 分辨率
  resolution: CharacterVisualResolution;
  // 尺寸
  size: IllustrationSize;
  // 任务状态
  status: CharacterVisualTaskStatus;
  // 更新时间
  updatedAt: string;
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
  // 当前画面使用的素材
  references: IllustrationReference[];
  // 标题
  title: string;
  // 更新时间
  updatedAt: string;
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
export interface CreateIllustrationTopicRequest {}

// 更新插画主题请求
export interface UpdateIllustrationTopicRequest {
  // 标题
  title?: string;
  // 主题ID
  topicId: string;
  // 画面素材
  references?: IllustrationReference[];
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
  // 调整底图
  revisionBase: IllustrationRevisionReference | null;
  // 本次生成使用的画面素材
  references: IllustrationReference[];
  // 提示词
  prompt: string;
  // 修订提示词
  revisionPrompt: string | null;
  // 分辨率
  resolution: CharacterVisualResolution;
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
  createIllustrationTopic: (request: CreateIllustrationTopicRequest) => Promise<IllustrationTopic>;
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
